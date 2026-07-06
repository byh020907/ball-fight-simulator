/**
 * shape 기반 충돌 helper (circle-polygon, polygon-circle).
 *
 * 모든 벡터 연산은 Vector2를 사용합니다.
 */
import { Vector2 } from "../core.js";
import { applyCollisionResponse } from "./collisionResponse.js";

/**
 * local coordinates의 polygon 점 배열을 world coordinates로 변환.
 * @param {{ points: Array<{x:number,y:number}>, x: number, y: number, angle?: number }} shape
 * @returns {Array<{x:number,y:number}>}
 */
export function getWorldPolygonPoints(shape) {
    const points = shape.points;
    if (!Array.isArray(points) || points.length < 3) return [];
    const angle = shape.angle ?? 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map((p) => ({
        x: shape.x + p.x * cos - p.y * sin,
        y: shape.y + p.x * sin + p.y * cos
    }));
}

/**
 * convex polygon의 bounding radius 추정 (중심에서 가장 먼 vertex까지 거리).
 */
export function polygonBoundingRadius(points) {
    if (!Array.isArray(points) || points.length === 0) return 0;
    let maxSq = 0;
    for (const p of points) {
        const sq = p.x * p.x + p.y * p.y;
        if (sq > maxSq) maxSq = sq;
    }
    return Math.sqrt(maxSq);
}

/**
 * 점이 convex polygon 내부에 있는지 판정 (winding order 가정).
 * @param {{x:number,y:number}} point
 * @param {Array<{x:number,y:number}>} worldPoints
 * @returns {boolean}
 */
function pointInConvexPolygon(point, worldPoints) {
    const n = worldPoints.length;
    if (n < 3) return false;
    let sign = null;
    for (let i = 0; i < n; i++) {
        const a = worldPoints[i];
        const b = worldPoints[(i + 1) % n];
        const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
        if (sign === null) {
            sign = cross > 0;
        } else if (cross > 0 !== sign) {
            return false;
        }
    }
    return true;
}

/**
 * convex polygon과 원형 entity 간 충돌 해결 (SAT 기반).
 * 겹침 시 entity를 바깥으로 밀고 velocity를 반사.
 * @param {{position:{x,y},velocity:{x,y},radius:number,applyImpulse:(v:Vector2)=>void}} entity
 * @param {{shape:string,x:number,y:number,points:Array<{x:number,y:number}>,blocking:boolean,angle?:number}} terrain
 * @returns {boolean}
 */
export function resolvePolygonTerrainCollision(entity, terrain) {
    if (!terrain || !terrain.blocking) return false;
    const worldPoints = getWorldPolygonPoints(terrain);
    if (worldPoints.length < 3) return false;

    const cx = entity.position.x;
    const cy = entity.position.y;
    const r = entity.radius ?? 0;

    // 1. polygon 내부에 entity center가 완전히 들어갔는지 확인
    if (pointInConvexPolygon({ x: cx, y: cy }, worldPoints)) {
        const edgeResult = closestEdgeNormal(cx, cy, worldPoints);
        const overlap = r + edgeResult.distance;
        entity.position.x += edgeResult.nx * overlap;
        entity.position.y += edgeResult.ny * overlap;
        const normal = { x: edgeResult.nx, y: edgeResult.ny };
        const contactPoint = edgeResult.contactPoint ?? {
            x: entity.position.x,
            y: entity.position.y
        };
        const preVel = { x: entity.velocity.x, y: entity.velocity.y };
        applyCollisionResponse(entity, normal, contactPoint, preVel, {
            restitution: 0.92,
            angularFactor: 0.15,
            tangentialFriction: 0.03
        });
        return true;
    }

    // 2. 각 edge에 대해 circle center와의 거리 검사
    let bestOverlap = -Infinity;
    let bestNx = 0;
    let bestNy = 0;
    let bestContactX = cx;
    let bestContactY = cy;

    const n = worldPoints.length;
    for (let i = 0; i < n; i++) {
        const a = worldPoints[i];
        const b = worldPoints[(i + 1) % n];
        // edge normal (polygon 바깥 방향 가정: CCW winding)
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const len = Math.sqrt(ex * ex + ey * ey);
        if (len === 0) continue;
        const nx = -ey / len;
        const ny = ex / len;

        // circle center를 edge line에 projection
        const t = ((cx - a.x) * ex + (cy - a.y) * ey) / (len * len);
        const clampedT = Math.max(0, Math.min(1, t));
        const closestX = a.x + ex * clampedT;
        const closestY = a.y + ey * clampedT;

        const dx = cx - closestX;
        const dy = cy - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const penetration = r - dist;
        if (penetration > bestOverlap) {
            bestOverlap = penetration;
            bestNx = dist > 0 ? dx / dist : nx;
            bestNy = dist > 0 ? dy / dist : ny;
            bestContactX = closestX;
            bestContactY = closestY;
        }
    }

    if (bestOverlap <= 0) return false;

    // 밀어내기
    entity.position.x += bestNx * bestOverlap;
    entity.position.y += bestNy * bestOverlap;

    const normal = { x: bestNx, y: bestNy };
    const contactPoint = { x: bestContactX, y: bestContactY };
    const preVel = { x: entity.velocity.x, y: entity.velocity.y };
    applyCollisionResponse(entity, normal, contactPoint, preVel, {
        restitution: 0.92,
        angularFactor: 0.15,
        tangentialFriction: 0.03
    });
    return true;
}

function closestEdgeNormal(cx, cy, worldPoints) {
    const n = worldPoints.length;
    let minDist = Infinity;
    let bestNx = 1;
    let bestNy = 0;
    let bestContactX = cx;
    let bestContactY = cy;

    for (let i = 0; i < n; i++) {
        const a = worldPoints[i];
        const b = worldPoints[(i + 1) % n];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const len = Math.sqrt(ex * ex + ey * ey);
        if (len === 0) continue;
        const nx = -ey / len;
        const ny = ex / len;

        // circle center에서 edge 직선까지 거리
        const dist = Math.abs((cx - a.x) * nx + (cy - a.y) * ny);
        if (dist < minDist) {
            minDist = dist;
            bestNx = nx;
            bestNy = ny;
            // closest point on edge segment
            const t = ((cx - a.x) * ex + (cy - a.y) * ey) / (len * len);
            const clampedT = Math.max(0, Math.min(1, t));
            bestContactX = a.x + ex * clampedT;
            bestContactY = a.y + ey * clampedT;
        }
    }
    return {
        nx: bestNx,
        ny: bestNy,
        distance: minDist,
        contactPoint: { x: bestContactX, y: bestContactY }
    };
}

// ──────────────────────────────────────────────
// Fighter shape collision (circle / polygon)
// ──────────────────────────────────────────────

/**
 * _drawPolygonBody와 일치하는 정다각형 로컬 꼭짓점 배열을 반환합니다.
 * @param {number} sides - 변 개수 (≥3)
 * @param {number} radius - 외접원 반지름
 * @returns {Array<{x:number,y:number}>}
 */
export function computeRegularPolygonLocalPoints(sides, radius) {
    if (sides < 3) return [];
    const a = (Math.PI * 2) / sides;
    const offset = -Math.PI / 2 - a / 2;
    const points = [];
    for (let i = 0; i < sides; i++) {
        const angle = i * a + offset;
        points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    return points;
}

/**
 * Fighter의 충돌 shape 정보를 반환합니다.
 * 다각형 몹이면 polygon shape, 아니면 circle shape.
 * @param {object} entity — BattleBall 인스턴스
 * @returns {{ type: "circle"|"polygon", x: number, y: number, radius: number, sides?: number, angle?: number, localPoints?: Array<{x:number,y:number}>, worldPoints?: Array<{x:number,y:number}> }}
 */
export function getFighterCollisionShape(entity) {
    const sides = entity.appearance?.sides ?? 0;
    const x = entity.position.x;
    const y = entity.position.y;
    const radius = entity.radius;
    if (sides > 0) {
        const angle = entity.angle ?? 0;
        const localPoints = computeRegularPolygonLocalPoints(sides, radius);
        const worldPoints = getWorldPolygonPoints({ points: localPoints, x, y, angle });
        return { type: "polygon", x, y, radius, sides, angle, localPoints, worldPoints };
    }
    return { type: "circle", x, y, radius };
}

/**
 * 두 fighter 간 shape 기반 충돌 해결.
 * circle-circle, circle-polygon, polygon-polygon 조합을 지원합니다.
 *
 * @param {object} a — BattleBall 인스턴스
 * @param {object} b — BattleBall 인스턴스
 * @returns {{ normal: Vector2|null, overlap: number, separationOverlap: number }} — normal은 a→b 방향, overlap은 SAT 침투 깊이, separationOverlap은 분리에 사용할 값
 */
export function resolveFighterShapeCollision(a, b) {
    const shapeA = getFighterCollisionShape(a);
    const shapeB = getFighterCollisionShape(b);

    // Broad phase: bounding circle overlap
    const dx = shapeB.x - shapeA.x;
    const dy = shapeB.y - shapeA.y;
    const distSq = dx * dx + dy * dy;
    const radSum = shapeA.radius + shapeB.radius;
    if (distSq >= radSum * radSum) return { normal: null, overlap: 0, separationOverlap: 0 };

    if (shapeA.type === "circle" && shapeB.type === "circle") {
        const result = _resolveCircleCircle(shapeA, shapeB);
        result.contactPoint = _computeCircleCircleContact(shapeA, shapeB, result.normal, result.overlap);
        return { ...result, separationOverlap: result.overlap };
    }
    if (shapeA.type === "circle" && shapeB.type === "polygon") {
        const result = _resolveCirclePolygon(shapeA, shapeB);
        if (result.normal && result.overlap > 0) {
            result.separationOverlap = _computeSeparationOverlap(shapeA, shapeB, result.normal, result.overlap);
            result.separationVec = _computeSeparationVector(shapeA, shapeB, result.separationOverlap, result.normal);
            result.contactPoint = result._closestPoint ?? _computeCirclePolyContactFallback(shapeA, result.normal);
        } else {
            result.separationOverlap = 0;
            result.separationVec = null;
        }
        return result;
    }
    if (shapeA.type === "polygon" && shapeB.type === "circle") {
        const result = _resolveCirclePolygon(shapeB, shapeA);
        if (result.normal) {
            result.normal = result.normal.clone().scale(-1);
            result.separationOverlap = _computeSeparationOverlap(shapeA, shapeB, result.normal, result.overlap);
            result.separationVec = _computeSeparationVector(shapeA, shapeB, result.separationOverlap, result.normal);
            result.contactPoint =
                result._closestPoint ?? _computeCirclePolyContactFallback(shapeB, result.normal.clone().scale(-1));
        } else {
            result.separationOverlap = 0;
            result.separationVec = null;
        }
        return result;
    }
    // polygon vs polygon
    const result = _resolvePolygonPolygon(shapeA, shapeB);
    if (result.normal && result.overlap > 0) {
        result.separationOverlap = _computeSeparationOverlap(shapeA, shapeB, result.normal, result.overlap);
        result.separationVec = _computeSeparationVector(shapeA, shapeB, result.separationOverlap, result.normal);
        result.contactPoint = _computePolygonContactPoint(shapeA, shapeB);
    } else {
        result.separationOverlap = 0;
        result.separationVec = null;
    }
    return result;
}

/**
 * SAT normal이 center-to-center와 어긋날 때를 보정한 분리용 overlap을 계산합니다.
 * SAT normal 대신 center-to-center 방향으로 밀어내는 방식을 사용합니다.
 * SAT normal이 center-to-center와 θ만큼 차이나면, SAT overlap/cos(θ) 만큼 center-to-center 방향으로 분리.
 */
function _computeSeparationOverlap(shapeA, shapeB, normal, satOverlap) {
    const dx = shapeB.x - shapeA.x;
    const dy = shapeB.y - shapeA.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < 0.0001) return satOverlap * 1.5;
    const dist = Math.sqrt(distSq);
    const centerDirX = dx / dist;
    const centerDirY = dy / dist;
    const alignment = Math.abs(normal.x * centerDirX + normal.y * centerDirY);
    // bounding circle overlap 대비 SAT overlap 비율로 스케일 보정
    // → SAT normal 방향으로 완전 분리되도록 overlap 증폭
    const circleOverlap = shapeA.radius + shapeB.radius - dist;
    const scale = circleOverlap / Math.max(satOverlap, 0.001);
    const result = satOverlap * Math.max(scale, 1.0) * 1.05;
    return result;
}

/**
 * 분리 벡터를 계산합니다. SAT normal 방향으로 separationOverlap만큼 밀어냅니다.
 * SAT normal은 polygon 회전에 따라 변하므로, 회전된 shape 기준 충돌 결과가 달라집니다.
 */
function _computeSeparationVector(shapeA, shapeB, separationOverlap, normal) {
    return { x: normal.x * separationOverlap, y: normal.y * separationOverlap };
}

/**
 * 두 convex polygon의 SAT 기반 접촉 후보를 수집하여 평균 contactPoint를 반환합니다.
 * 후보 = A의 vertex 중 B 내부/경계 점 + B의 vertex 중 A 내부/경계 점 + edge-edge 교차점.
 * 후보가 없으면 center midpoint fallback.
 */
function _computePolygonContactPoint(shapeA, shapeB) {
    const candidates = [];

    const ptsA = shapeA.worldPoints;
    const ptsB = shapeB.worldPoints;

    // 1. A의 vertex 중 B 내부/경계에 있는 점
    for (const p of ptsA) {
        if (pointInConvexPolygon(p, ptsB)) {
            candidates.push({ x: p.x, y: p.y });
        }
    }

    // 2. B의 vertex 중 A 내부/경계에 있는 점
    for (const p of ptsB) {
        if (pointInConvexPolygon(p, ptsA)) {
            candidates.push({ x: p.x, y: p.y });
        }
    }

    // 3. edge-edge 교차점
    for (let i = 0; i < ptsA.length; i++) {
        const a1 = ptsA[i];
        const a2 = ptsA[(i + 1) % ptsA.length];
        for (let j = 0; j < ptsB.length; j++) {
            const b1 = ptsB[j];
            const b2 = ptsB[(j + 1) % ptsB.length];
            const ip = _segmentIntersection(a1, a2, b1, b2);
            if (ip) {
                candidates.push(ip);
            }
        }
    }

    if (candidates.length > 0) {
        let sumX = 0;
        let sumY = 0;
        for (const c of candidates) {
            sumX += c.x;
            sumY += c.y;
        }
        const avgX = sumX / candidates.length;
        const avgY = sumY / candidates.length;
        if (Number.isFinite(avgX) && Number.isFinite(avgY)) {
            return { x: avgX, y: avgY };
        }
    }

    // fallback: center midpoint
    return { x: (shapeA.x + shapeB.x) / 2, y: (shapeA.y + shapeB.y) / 2 };
}

/**
 * circle-polygon 충돌의 fallback contactPoint.
 * SAT 정상에서 _closestPoint가 없을 때 circle surface point를 반환합니다.
 * @param {{ x: number, y: number, radius: number }} circleShape
 * @param {{ x: number, y: number }} normal — circle → polygon 방향
 * @returns {{ x: number, y: number }}
 */
function _computeCirclePolyContactFallback(circleShape, normal) {
    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    if (len < 1e-10) return { x: circleShape.x, y: circleShape.y };
    const nx = normal.x / len;
    const ny = normal.y / len;
    return {
        x: circleShape.x - nx * circleShape.radius,
        y: circleShape.y - ny * circleShape.radius
    };
}

/**
 * 두 선분 (p1→p2)와 (p3→p4)의 교차점을 반환합니다.
 * 교차하지 않으면 null을 반환합니다.
 */
function _segmentIntersection(p1, p2, p3, p4) {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-10) return null; // parallel

    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
    const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { x: p1.x + t * d1x, y: p1.y + t * d1y };
    }
    return null;
}

/** circle vs circle — 기존 radius overlap 계산과 동일 */
function _resolveCircleCircle(shapeA, shapeB) {
    const dx = shapeB.x - shapeA.x;
    const dy = shapeB.y - shapeA.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const overlap = shapeA.radius + shapeB.radius - dist;
    const normal = dist > 0.0001 ? new Vector2(dx / dist, dy / dist) : new Vector2(1, 0);
    return { normal, overlap };
}

/** circle-circle 충돌의 접촉점 (두 원의 중첩 영역 중점) */
function _computeCircleCircleContact(shapeA, shapeB, normal, overlap) {
    const contactX = shapeA.x + normal.x * (shapeA.radius - overlap * 0.5);
    const contactY = shapeA.y + normal.y * (shapeA.radius - overlap * 0.5);
    return { x: contactX, y: contactY };
}

/**
 * SAT 기반 polygon vs polygon 충돌.
 * @returns {{ normal: Vector2|null, overlap: number }}
 */
function _resolvePolygonPolygon(shapeA, shapeB) {
    const pointsA = shapeA.worldPoints;
    const pointsB = shapeB.worldPoints;
    if (pointsA.length < 3 || pointsB.length < 3) return { normal: null, overlap: 0 };

    let bestOverlap = Infinity;
    let bestNormal = null;

    // polygon A의 각 edge normal 검사
    _satCheck(
        pointsA,
        pointsB,
        (best) => {
            if (best.overlap < bestOverlap) {
                bestOverlap = best.overlap;
                bestNormal = best.normal;
            }
        },
        false
    );

    // polygon B의 각 edge normal 검사
    _satCheck(
        pointsB,
        pointsA,
        (best) => {
            if (best.overlap < bestOverlap) {
                bestOverlap = best.overlap;
                bestNormal = best.normal;
            }
        },
        false
    );

    if (bestOverlap <= 0 || bestOverlap >= Infinity) return { normal: null, overlap: 0 };

    // normal 방향을 a→b로 일관되게 맞춤
    const centerToCenter = new Vector2(shapeB.x - shapeA.x, shapeB.y - shapeA.y);
    if (bestNormal.dot(centerToCenter) < 0) {
        bestNormal = bestNormal.clone().scale(-1);
    }
    return { normal: bestNormal, overlap: bestOverlap };
}

/**
 * SAT 기반 circle vs polygon 충돌.
 * shapeA = circle, shapeB = polygon.
 * @returns {{ normal: Vector2|null, overlap: number }}
 */
function _resolveCirclePolygon(circleShape, polyShape) {
    const worldPoints = polyShape.worldPoints;
    if (worldPoints.length < 3) return { normal: null, overlap: 0 };

    const cx = circleShape.x;
    const cy = circleShape.y;
    const r = circleShape.radius;

    let bestOverlap = Infinity;
    let bestNormal = null;

    // polygon의 각 edge normal에 대한 SAT
    const n = worldPoints.length;
    for (let i = 0; i < n; i++) {
        const a = worldPoints[i];
        const b = worldPoints[(i + 1) % n];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const len = Math.sqrt(ex * ex + ey * ey);
        if (len === 0) continue;
        const nx = -ey / len;
        const ny = ex / len;

        // circle projection: center ± r * normal
        const circleProj = cx * nx + cy * ny;
        const circleMin = circleProj - r;
        const circleMax = circleProj + r;

        // polygon projection
        let polyMin = Infinity;
        let polyMax = -Infinity;
        for (const p of worldPoints) {
            const proj = p.x * nx + p.y * ny;
            if (proj < polyMin) polyMin = proj;
            if (proj > polyMax) polyMax = proj;
        }

        const overlap = Math.min(circleMax, polyMax) - Math.max(circleMin, polyMin);
        if (overlap <= 0) return { normal: null, overlap: 0 };
        if (overlap < bestOverlap) {
            bestOverlap = overlap;
            bestNormal = new Vector2(nx, ny);
        }
    }

    // 추가: 가장 가까운 polygon vertex 축
    let closestDistSq = Infinity;
    let closestVertex = null;
    for (const p of worldPoints) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < closestDistSq) {
            closestDistSq = dSq;
            closestVertex = p;
        }
    }
    let _closestPoint = null;
    if (closestVertex && closestDistSq > 0.0001) {
        const dist = Math.sqrt(closestDistSq);
        const vnx = (cx - closestVertex.x) / dist;
        const vny = (cy - closestVertex.y) / dist;
        const vOverlap = r - dist;
        if (vOverlap > 0) {
            _closestPoint = { x: closestVertex.x, y: closestVertex.y };
        }
        if (vOverlap > 0 && vOverlap < bestOverlap) {
            bestOverlap = vOverlap;
            bestNormal = new Vector2(vnx, vny);
        }
    }

    if (bestOverlap <= 0 || bestOverlap >= Infinity) return { normal: null, overlap: 0 };

    // normal 방향을 circle→polygon 방향으로 (circle이 A였을 때)
    // circle center → polygon center
    const pcx = polyShape.x;
    const pcy = polyShape.y;
    const toPoly = new Vector2(pcx - cx, pcy - cy);
    if (bestNormal.dot(toPoly) < 0) {
        bestNormal = bestNormal.clone().scale(-1);
    }
    const result = { normal: bestNormal, overlap: bestOverlap };
    if (_closestPoint) result._closestPoint = _closestPoint;
    return result;
}

/**
 * SAT helper: 한 polygon의 edge normal들에 대해 두 polygon의 projection overlap을 검사.
 * @param {Array<{x:number,y:number}>} pointsA - edge normal을 추출할 polygon
 * @param {Array<{x:number,y:number}>} pointsB - 상대 polygon
 * @param {(best: {overlap:number, normal:Vector2}) => void} onBest
 * @param {boolean} swapNormal - true면 normal 방향을 반전 (B의 edge를 A→B 방향으로)
 */
function _satCheck(pointsA, pointsB, onBest, swapNormal) {
    const n = pointsA.length;
    for (let i = 0; i < n; i++) {
        const a = pointsA[i];
        const b = pointsA[(i + 1) % n];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const len = Math.sqrt(ex * ex + ey * ey);
        if (len === 0) continue;
        const nx = swapNormal ? ey / len : -ey / len;
        const ny = swapNormal ? -ex / len : ex / len;

        let minA = Infinity;
        let maxA = -Infinity;
        for (const p of pointsA) {
            const proj = p.x * nx + p.y * ny;
            if (proj < minA) minA = proj;
            if (proj > maxA) maxA = proj;
        }

        let minB = Infinity;
        let maxB = -Infinity;
        for (const p of pointsB) {
            const proj = p.x * nx + p.y * ny;
            if (proj < minB) minB = proj;
            if (proj > maxB) maxB = proj;
        }

        const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
        if (overlap <= 0) {
            onBest({ overlap: 0, normal: null });
            return false; // separating axis found — no collision
        }
        if (overlap < Infinity) {
            onBest({ overlap, normal: new Vector2(nx, ny) });
        }
    }
    return true;
}
