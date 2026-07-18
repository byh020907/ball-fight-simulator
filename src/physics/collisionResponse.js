/**
 * 공통 충돌 응답 모듈 — contact point 기반 2D rigid-body impulse solver.
 *
 * 충돌 판정(contact detection)은 CollisionShape/terrainCollision/wall bounce가 담당하고,
 * 이 모듈은 판정 결과(normal, contactPoint, approachSpeed) → impulse(linear + angular) 계산을 담당한다.
 *
 * 모든 body는 duck typing으로 능력을 감지:
 * - position ({x, y})
 * - velocity ({x, y}) (선택적)
 * - mass (number)
 * - radius (number)
 * - angularVelocity (number) (선택적)
 * - applyImpulse(impulse) — deltaV를 {x,y}로 받음
 * - applyAngularImpulse(value) — angular impulse L을 받음
 * - physicsMaterial (string|object, 선택적) — 재질 식별자
 *
 * 충돌 판정과 충돌 응답은 분리되어 있다.
 * 새로운 충돌 대상(벽/terrain/투사체 등)은 이 모듈의 공통 helper를 호출해야 한다.
 *
 * restitution/friction은 더 이상 호출자가 하드코딩하지 않고,
 * body.physicsMaterial 또는 options.surfaceMaterial/materialA/materialB를 통해
 * PhysicsMaterial 모듈이 결정한다. 명시적 options.restitution/options.tangentialFriction은
 * 재질 조합 결과를 덮어쓴다 (backward compat).
 *
 * impulse 흐름:
 *   1. 접촉점 상대 속도 계산 (선형 + ω×r 기여)
 *   2. effective mass denominator = 1/mA + 1/mB + (rA×d)²/IA + (rB×d)²/IB
 *   3. normal impulse: jn = -(1+e) * vn / denom_n
 *   4. tangent impulse: jt = -vt / denom_t, clamp by |jt| ≤ friction * |jn|
 *   5. 적용: 각 body에 -J·invMass (선형) + r×J (angular) 전달
 */

import { resolvePhysicsMaterial, combinePhysicsMaterials } from "./PhysicsMaterial.js";
import { Vector2 } from "../core.js";

/**
 * 2D cross product: r × v = r.x * v.y - r.y * v.x (스칼라)
 */
function cross2D(r, v) {
    return r.x * v.y - r.y * v.x;
}

/**
 * body의 inverse mass를 반환한다.
 * @param {object|null} body — null이면 0 반환 (정적)
 * @returns {number}
 */
function _getInvMass(body) {
    if (body === null) return 0;
    return 1 / Math.max(0.001, body.mass ?? 1);
}

/**
 * body의 inverse inertia를 반환한다.
 * _inverseMomentOfInertia가 유효하면 그것을, 없으면 solid disk 가정으로 계산한다.
 * @param {object|null} body — null이면 0 반환 (정적)
 * @returns {number}
 */
function _getInvInertia(body) {
    if (body === null) return 0;
    if (typeof body._inverseMomentOfInertia === "number" && Number.isFinite(body._inverseMomentOfInertia)) {
        return body._inverseMomentOfInertia;
    }
    const mass = body.mass ?? 1;
    const radius = body.radius ?? 10;
    const moi = 0.5 * mass * radius * radius;
    return moi > 0.0001 ? 1 / moi : 0;
}

/**
 * body의 접촉점에서의 속도 (선형 + 각속도 ω×r 기여).
 * @param {object} body
 * @param {{x:number,y:number}} contactPoint
 * @param {{x:number,y:number}} [velocityOverride] — velocity 대신 사용할 값
 * @returns {{x:number, y:number}}
 */
function _contactPointVelocity(body, contactPoint, velocityOverride) {
    if (body === null) {
        return velocityOverride?.clone?.() ?? new Vector2(velocityOverride?.x ?? 0, velocityOverride?.y ?? 0);
    }
    const v = velocityOverride ?? body.velocity ?? { x: 0, y: 0 };
    if (typeof body.angularVelocity !== "number" || body.angularVelocity === 0) {
        return v.clone?.() ?? new Vector2(v.x, v.y);
    }
    const r = {
        x: contactPoint.x - body.position.x,
        y: contactPoint.y - body.position.y
    };
    // ω × r: (-ω * r.y, ω * r.x)
    return new Vector2(v.x - body.angularVelocity * r.y, v.y + body.angularVelocity * r.x);
}

/**
 * effective mass denominator 계산:
 *   1/mA + 1/mB + (rA×d)²/IA + (rB×d)²/IB
 *
 * @param {object|null} bodyA
 * @param {object|null} bodyB
 * @param {{x:number,y:number}} direction — normal 또는 tangent 방향
 * @param {{x:number,y:number}} contactPoint
 * @returns {number}
 */
function _effectiveMassDenom(bodyA, bodyB, direction, contactPoint) {
    const invMassA = _getInvMass(bodyA);
    const invMassB = _getInvMass(bodyB);
    let denom = invMassA + invMassB;

    const invIA = _getInvInertia(bodyA);
    if (bodyA !== null && invIA > 0) {
        const rA = {
            x: contactPoint.x - bodyA.position.x,
            y: contactPoint.y - bodyA.position.y
        };
        const rA_cross_dir = cross2D(rA, direction);
        denom += rA_cross_dir * rA_cross_dir * invIA;
    }

    const invIB = _getInvInertia(bodyB);
    if (bodyB !== null && invIB > 0) {
        const rB = {
            x: contactPoint.x - bodyB.position.x,
            y: contactPoint.y - bodyB.position.y
        };
        const rB_cross_dir = cross2D(rB, direction);
        denom += rB_cross_dir * rB_cross_dir * invIB;
    }

    return denom > 0.0001 ? denom : 0.0001;
}

/**
 * 공통 impulse solver: normal + tangent impulse 계산 후 두 body에 적용.
 *
 * bodyA가 null이면 정적 표면으로 간주한다 (velA = surfaceVelocity).
 *
 * normal 방향 규칙: 법선은 bodyA → bodyB 방향.
 * bodyA가 -J를, bodyB가 +J를 받는다.
 *
 * @param {object|null} bodyA
 * @param {object|null} bodyB
 * @param {{x:number,y:number}} normal — A→B 방향 법선
 * @param {{x:number,y:number}} contactPoint — 접촉점 (월드 좌표)
 * @param {object} options
 * @param {number} [options.restitution=0.92] — 반발 계수
 * @param {number} [options.tangentialFriction=0.20] — 접선 마찰 계수
 * @param {{x:number,y:number}} [options.velocityA] — bodyA velocity override
 * @param {{x:number,y:number}} [options.velocityB] — bodyB velocity override
 * @param {number} [options.linearScaleA=1] — bodyA 선형 impulse 배율
 * @param {number} [options.linearScaleB=1] — bodyB 선형 impulse 배율
 * @param {number} [options.angularScaleA=1] — bodyA angular impulse 배율
 * @param {number} [options.angularScaleB=1] — bodyB angular impulse 배율
 * @returns {{ normalImpulse: number, tangentImpulse: number }}
 */
function _createContactImpulseResponse(bodyA, bodyB, normal, contactPoint, options = {}) {
    normal = normal.clone?.() ?? new Vector2(normal.x, normal.y);
    contactPoint = contactPoint.clone?.() ?? new Vector2(contactPoint.x, contactPoint.y);
    const restitution = options.restitution ?? 0.92;
    const friction = options.tangentialFriction ?? 0.2;
    const linearScaleA = options.linearScaleA ?? 1;
    const linearScaleB = options.linearScaleB ?? 1;
    const angularScaleA = options.angularScaleA ?? 1;
    const angularScaleB = options.angularScaleB ?? 1;

    const tangent = new Vector2(-normal.y, normal.x);

    // 접촉점 상대 속도
    const velA = _contactPointVelocity(bodyA, contactPoint, options.velocityA);
    const velB = _contactPointVelocity(bodyB, contactPoint, options.velocityB);
    const relVel = Vector2.subtract(velB ?? new Vector2(), velA ?? new Vector2());

    const vn = relVel.x * normal.x + relVel.y * normal.y;
    if (vn > 0) {
        return {
            normalImpulse: 0,
            tangentImpulse: 0,
            impulse: new Vector2(),
            bodyA: null,
            bodyB: null
        };
    }

    const vt = relVel.x * tangent.x + relVel.y * tangent.y;

    // effective mass denominator (normal / tangent 각각)
    const denomN = _effectiveMassDenom(bodyA, bodyB, normal, contactPoint);
    const denomT = _effectiveMassDenom(bodyA, bodyB, tangent, contactPoint);

    // Normal impulse
    const jn = (-(1 + restitution) * vn) / denomN;

    // Tangent impulse (friction), Coulomb clamp
    let jt = -vt / denomT;
    const maxFriction = Math.abs(friction * jn);
    if (Math.abs(jt) > maxFriction) {
        jt = Math.sign(jt) * maxFriction;
    }

    // 총 impulse vector J = jn * n + jt * t
    const impulse = normal.clone().scale(jn).add(tangent.clone().scale(jt));

    const invMassA = _getInvMass(bodyA);
    const invMassB = _getInvMass(bodyB);
    const createBodyDelta = (body, linearImpulse, angularScale) => {
        if (body === null) return null;
        const r = {
            x: contactPoint.x - body.position.x,
            y: contactPoint.y - body.position.y
        };
        return {
            body,
            linearDelta: linearImpulse
                .clone()
                .scale(body === bodyA ? invMassA * linearScaleA : invMassB * linearScaleB),
            angularImpulse: cross2D(r, linearImpulse) * angularScale
        };
    };

    return {
        normalImpulse: jn,
        tangentImpulse: jt,
        impulse,
        bodyA: createBodyDelta(bodyA, impulse.clone().scale(-1), angularScaleA),
        bodyB: createBodyDelta(bodyB, impulse, angularScaleB)
    };
}

function _applyContactImpulseResponse(response, isBodyActive = () => true) {
    for (const delta of [response.bodyA, response.bodyB]) {
        if (!delta || !isBodyActive(delta.body)) continue;
        if (typeof delta.body.applyImpulse === "function") {
            delta.body.applyImpulse(delta.linearDelta);
        }
        if (typeof delta.body.applyAngularImpulse === "function" && Number.isFinite(delta.angularImpulse)) {
            delta.body.applyAngularImpulse(delta.angularImpulse);
        }
    }
    return response;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * 단일 body와 정적 표면(벽/terrain) 간 충돌 응답.
 *
 * 공통 _resolveContactImpulse를 호출하며, bodyA=null로 정적 표면을 나타낸다.
 * 표면 속도는 options.surfaceVelocity로 전달한다.
 *
 * restitution/friction은 body.physicsMaterial과 options.surfaceMaterial의
 * 조합으로 결정된다. 명시적 options.restitution/options.tangentialFriction이 있으면
 * 그것이 재질 조합을 덮어쓴다.
 *
 * @param {object} body — 충돌하는 동적 body
 * @param {{x:number, y:number}} normal — 표면 → body 방향 법선
 * @param {{x:number, y:number}} contactPoint — 접점 (월드 좌표)
 * @param {{x:number, y:number}} preCollisionVelocity — 충돌 직전 body의 절대 속도
 * @param {object} [options]
 * @param {number} [options.restitution] — 재질 조합 덮어쓰기
 * @param {number} [options.angularFactor=1]
 * @param {number} [options.tangentialFriction] — 재질 조합 덮어쓰기
 * @param {string|{restitution:number,friction:number}} [options.surfaceMaterial] — 정적 표면 재질
 * @param {{x:number, y:number}} [options.surfaceVelocity={0,0}]
 */
export function applyCollisionResponse(body, normal, contactPoint, preCollisionVelocity, options = {}) {
    const bodyMat = resolvePhysicsMaterial(body?.physicsMaterial);
    const surfaceMat = resolvePhysicsMaterial(options.surfaceMaterial);
    const combined = combinePhysicsMaterials(bodyMat, surfaceMat);
    const restitution = options.restitution ?? combined.restitution;
    const angularFactor = options.angularFactor ?? 1;
    const tangentialFriction = options.tangentialFriction ?? combined.friction;
    const surfaceVel = options.surfaceVelocity ?? { x: 0, y: 0 };

    // body의 표면에 대한 상대 속도 (접근 검사)
    const relVel = {
        x: preCollisionVelocity.x - surfaceVel.x,
        y: preCollisionVelocity.y - surfaceVel.y
    };
    const approachSpeed = relVel.x * normal.x + relVel.y * normal.y;
    if (approachSpeed >= 0) return;

    // 정적 표면 충돌: bodyA=null(표면), bodyB=body(이동체).
    // normal이 표면→body 방향이므로 A→B = 표면→body가 일치한다.
    _applyContactImpulseResponse(
        _createContactImpulseResponse(null, body, normal, contactPoint, {
            restitution,
            tangentialFriction,
            velocityA: surfaceVel,
            velocityB: preCollisionVelocity,
            angularScaleB: angularFactor
        })
    );
}

/**
 * 동적-동적 충돌 응답 (fighter-fighter 등).
 *
 * 공통 _resolveContactImpulse를 호출하여 normal/tangent impulse를
 * 두 body의 선형/각운동량에 모두 적용한다.
 * 입력 normal은 A→B 방향이다.
 *
 * restitution/friction은 bodyA.physicsMaterial과 bodyB.physicsMaterial의
 * 조합으로 결정된다. 명시적 options.restitution/options.tangentialFriction이 있으면
 * 그것이 재질 조합을 덮어쓴다.
 *
 * @param {object} bodyA
 * @param {object} bodyB
 * @param {{x:number, y:number}} normal — A→B 방향 법선
 * @param {{x:number, y:number}} contactPoint — 접점 (월드 좌표)
 * @param {number} approachSpeed — 충돌 전 relative velocity dot normal (양수=분리)
 * @param {object} [options]
 * @param {number} [options.restitution] — 재질 조합 덮어쓰기
 * @param {number} [options.angularFactor=1]
 * @param {number} [options.tangentialFriction] — 재질 조합 덮어쓰기
 * @param {number} [options.impactA=1] — bodyB에 적용할 impulse 배율
 * @param {number} [options.impactB=1] — bodyA에 적용할 impulse 배율
 * @param {number} [options.angularScaleA] — bodyA에 적용할 최종 각충격 배율
 * @param {number} [options.angularScaleB] — bodyB에 적용할 최종 각충격 배율
 * @param {{x:number,y:number}} [options.preCollisionVel]
 */
export function applyDynamicCollisionResponse(bodyA, bodyB, normal, contactPoint, approachSpeed, options = {}) {
    const response = captureDynamicCollisionResponse(bodyA, bodyB, normal, contactPoint, approachSpeed, options);
    if (!response) return;
    applyCapturedDynamicCollisionResponse(response);
    return response;
}

/**
 * 동적 충돌의 공통 impulse 결과를 현재 접점 상태에서 계산만 한다.
 * 저장한 결과는 이후 applyCapturedDynamicCollisionResponse로 재계산 없이 적용할 수 있다.
 */
export function captureDynamicCollisionResponse(bodyA, bodyB, normal, contactPoint, approachSpeed, options = {}) {
    if (approachSpeed >= 0) return null;

    const matA = resolvePhysicsMaterial(bodyA?.physicsMaterial);
    const matB = resolvePhysicsMaterial(bodyB?.physicsMaterial);
    const combined = combinePhysicsMaterials(matA, matB);
    const restitution = options.restitution ?? combined.restitution;
    const angularFactor = options.angularFactor ?? 1;
    const tangentialFriction = options.tangentialFriction ?? combined.friction;
    const impactA = options.impactA ?? 1;
    const impactB = options.impactB ?? 1;
    const angularScaleA = options.angularScaleA ?? angularFactor * impactB;
    const angularScaleB = options.angularScaleB ?? angularFactor * impactA;

    // impact 의미: impactA는 bodyA의 outgoing → bodyB에 적용
    //               impactB는 bodyB의 outgoing → bodyA에 적용
    return _createContactImpulseResponse(bodyA, bodyB, normal, contactPoint, {
        restitution,
        tangentialFriction,
        linearScaleA: impactB,
        linearScaleB: impactA,
        angularScaleA,
        angularScaleB
    });
}

/** 저장된 동적 충돌 impulse를 피해/훅 없이 한 번만 적용한다. */
export function applyCapturedDynamicCollisionResponse(response, options = {}) {
    if (!response || response.applied) return false;
    const isBodyActive = options.isBodyActive ?? (() => true);
    _applyContactImpulseResponse(response, isBodyActive);
    response.applied = true;
    return true;
}

/**
 * 단일 body에 collision angular impulse를 적용한다 (legacy wrapper).
 *
 * DEPRECATED — _resolveContactImpulse가 angular impulse를 통합 처리한다.
 * 기존 호출자가 없으면 제거할 것.
 *
 * @param {object} body
 * @param {{x:number, y:number}} normal
 * @param {{x:number, y:number}} contactPoint
 * @param {number} impulseMag
 * @param {number} angularFactor
 * @param {number} [tangentialSpeed=0]
 * @param {number} [tangentialFriction=0]
 * @returns {number}
 */
export function applyCollisionAngularImpulse(
    body,
    normal,
    contactPoint,
    impulseMag,
    angularFactor,
    tangentialSpeed = 0,
    tangentialFriction = 0
) {
    if (typeof body.applyAngularImpulse !== "function") return 0;

    const r = {
        x: contactPoint.x - body.position.x,
        y: contactPoint.y - body.position.y
    };

    const torqueArmLen = Math.sqrt(r.x * r.x + r.y * r.y);
    if (torqueArmLen < 0.001) {
        const spinImpulse = tangentialSpeed * tangentialFriction;
        if (Number.isFinite(spinImpulse) && spinImpulse !== 0) {
            body.applyAngularImpulse(spinImpulse);
            return spinImpulse;
        }
        return 0;
    }

    const rxn = cross2D(r, normal);
    const normalTorque = rxn * impulseMag * angularFactor;

    let totalTorque = normalTorque;

    if (tangentialFriction > 0 && tangentialSpeed !== 0) {
        const tangent = { x: -normal.y, y: normal.x };
        const rxt = cross2D(r, tangent);
        const frictionTorque = -rxt * tangentialSpeed * tangentialFriction;
        totalTorque += frictionTorque;
    }

    if (Number.isFinite(totalTorque) && totalTorque !== 0) {
        body.applyAngularImpulse(totalTorque);
        return totalTorque;
    }
    return 0;
}
