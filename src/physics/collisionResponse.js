/**
 * 공통 충돌 응답 모듈.
 *
 * 충돌 판정(contact detection)은 CollisionShape/terrainCollision/wall bounce가 담당하고,
 * 이 모듈은 판정 결과(normal, contactPoint, approachSpeed) → impulse(linear + angular) 계산을 담당한다.
 *
 * 모든 body는 duck typing으로 능력을 감지:
 * - applyImpulse(impulse): Vector2 또는 {x, y} 객체를 받아 선형 impulse 적용
 * - applyAngularImpulse(value): number를 받아 각운동량 L 누적
 *
 * 충돌 판정과 충돌 응답은 분리되어 있다.
 * 새로운 충돌 대상(벽/terrain/투사체 등)은 별도 회전 보정 코드를 만들지 말고
 * 이 모듈의 공통 helper를 호출해야 한다.
 */

/**
 * 단일 body에 collision angular impulse를 적용한다.
 * torque arm이 0에 가까우면 접선 속도만으로 spin을 생성한다.
 *
 * @param {object} body - 회전 가능한 body (position, applyAngularImpulse)
 * @param {{x:number, y:number}} normal - 표면 법선 (body 방향)
 * @param {{x:number, y:number}} contactPoint - 접점 (월드 좌표)
 * @param {number} impulseMag - 법선 impulse 크기 (|approachSpeed| * (1 + restitution))
 * @param {number} angularFactor - 법선 impulse에서 회전으로 전달되는 비율
 * @param {number} [tangentialSpeed=0] - 접선 방향 pre-collision 속도 성분
 * @param {number} [tangentialFriction=0] - 접선 마찰 계수
 * @returns {number} 적용된 angular impulse (body에 applyAngularImpulse가 없으면 0)
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

    // 법선 impulse torque: τ_n = (r × N̂) * |J_n| * angularFactor
    const rxn = r.x * normal.y - r.y * normal.x;
    const normalTorque = rxn * impulseMag * angularFactor;

    let totalTorque = normalTorque;

    // 접선 마찰 torque: τ_t = (r × T̂) * v_t * friction
    if (tangentialFriction > 0 && tangentialSpeed !== 0) {
        const tangent = { x: -normal.y, y: normal.x };
        const rxt = r.x * tangent.y - r.y * tangent.x;
        const frictionTorque = rxt * tangentialSpeed * tangentialFriction;
        totalTorque += frictionTorque;
    }

    if (Number.isFinite(totalTorque) && totalTorque !== 0) {
        body.applyAngularImpulse(totalTorque);
        return totalTorque;
    }
    return 0;
}

/**
 * 동적 body와 표면(정적/동적) 간 충돌 응답.
 *
 * body의 duck typing으로 linear/angular impulse 적용 여부를 결정한다.
 * - applyImpulse가 있으면 선형 impulse 적용
 * - applyAngularImpulse가 있으면 angular impulse 적용
 * - applyImpulse가 없는 body에는 선형 impulse를 적용하지 않는다 (정적 표면).
 * - applyAngularImpulse가 없는 body에는 angular impulse를 적용하지 않는다.
 *
 * @param {object} body - 충돌하는 동적 body (position, velocity 필수)
 * @param {{x:number, y:number}} normal - 표면 → body 방향 법선
 * @param {{x:number, y:number}} contactPoint - 접점 (월드 좌표)
 * @param {{x:number, y:number}} preCollisionVelocity - 충돌 직전 body의 절대 속도
 * @param {object} [options]
 * @param {number} [options.restitution=0.92] - 반발 계수
 * @param {number} [options.angularFactor=0.15] - 법선 impulse 회전 전달 계수
 * @param {number} [options.tangentialFriction=0.03] - 접선 마찰 계수
 * @param {{x:number, y:number}} [options.surfaceVelocity] - 표면 속도 (기본 {0,0})
 */
export function applyCollisionResponse(body, normal, contactPoint, preCollisionVelocity, options = {}) {
    const restitution = options.restitution ?? 0.92;
    const angularFactor = options.angularFactor ?? 0.15;
    const tangentialFriction = options.tangentialFriction ?? 0.03;
    const surfaceVel = options.surfaceVelocity ?? { x: 0, y: 0 };

    // body의 표면에 대한 상대 속도
    const relVel = {
        x: preCollisionVelocity.x - surfaceVel.x,
        y: preCollisionVelocity.y - surfaceVel.y
    };

    const approachSpeed = relVel.x * normal.x + relVel.y * normal.y;
    if (approachSpeed >= 0) return;

    const impulseMag = Math.abs(approachSpeed) * (1 + restitution);

    // 접선 방향
    const tangent = { x: -normal.y, y: normal.x };
    const tangentialSpeed = relVel.x * tangent.x + relVel.y * tangent.y;

    // 선형 impulse (body에 applyImpulse가 있으면)
    if (typeof body.applyImpulse === "function") {
        const impulseX = normal.x * impulseMag + tangent.x * tangentialSpeed * tangentialFriction;
        const impulseY = normal.y * impulseMag + tangent.y * tangentialSpeed * tangentialFriction;
        body.applyImpulse({ x: impulseX, y: impulseY });
    }

    // Angular impulse (body에 applyAngularImpulse가 있으면)
    applyCollisionAngularImpulse(
        body,
        normal,
        contactPoint,
        impulseMag,
        angularFactor,
        tangentialSpeed,
        tangentialFriction
    );
}

/**
 * 동적-동적 충돌 응답 (fighter-fighter 등).
 * 양쪽 body의 duck typing으로 linear/angular impulse 적용 여부를 결정한다.
 *
 * 입력 normal은 A→B 방향이다.
 *
 * @param {object} bodyA - 첫 번째 동적 body
 * @param {object} bodyB - 두 번째 동적 body
 * @param {{x:number, y:number}} normal - A→B 방향 법선
 * @param {{x:number, y:number}} contactPoint - 접점 (월드 좌표)
 * @param {number} approachSpeed - 충돌 전 relative velocity dot normal (양수=접근)
 * @param {object} [options]
 * @param {number} [options.restitution=0.92] - 반발 계수
 * @param {number} [options.angularFactor=0.15] - 법선 impulse 회전 전달 계수
 * @param {number} [options.tangentialFriction=0.03] - 접선 마찰 계수
 */
export function applyDynamicCollisionResponse(bodyA, bodyB, normal, contactPoint, approachSpeed, options = {}) {
    if (approachSpeed >= 0) return;

    const restitution = options.restitution ?? 0.92;
    const angularFactor = options.angularFactor ?? 0.15;
    const impulseMag = Math.abs(approachSpeed) * (1 + restitution);

    // Body A: normal 방향 torque
    applyCollisionAngularImpulse(bodyA, normal, contactPoint, impulseMag, angularFactor);

    // Body B: -normal 방향 torque (반대 방향)
    const inverseNormal = { x: -normal.x, y: -normal.y };
    applyCollisionAngularImpulse(bodyB, inverseNormal, contactPoint, impulseMag, angularFactor);
}
