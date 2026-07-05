/**
 * shape 기반 충돌 helper (circle-polygon, polygon-circle).
 *
 * 모든 벡터 연산은 Vector2를 사용합니다.
 */
import { Vector2 } from "../core.js";

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
        // 가장 가까운 edge의 바깥 normal 방향으로 밀어내기
        const result = closestEdgeNormal(cx, cy, worldPoints);
        const overlap = r + result.distance;
        entity.position.x += result.nx * overlap;
        entity.position.y += result.ny * overlap;
        reflectVelocity(entity, result.nx, result.ny);
        return true;
    }

    // 2. 각 edge에 대해 circle center와의 거리 검사
    let bestOverlap = -Infinity;
    let bestNx = 0;
    let bestNy = 0;

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
        }
    }

    if (bestOverlap <= 0) return false;

    // 밀어내기
    entity.position.x += bestNx * bestOverlap;
    entity.position.y += bestNy * bestOverlap;

    // velocity 반사
    reflectVelocity(entity, bestNx, bestNy);
    return true;
}

function closestEdgeNormal(cx, cy, worldPoints) {
    const n = worldPoints.length;
    let minDist = Infinity;
    let bestNx = 1;
    let bestNy = 0;

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
        }
    }
    return { nx: bestNx, ny: bestNy, distance: minDist };
}

function reflectVelocity(entity, nx, ny) {
    const dot = entity.velocity.x * nx + entity.velocity.y * ny;
    if (dot < 0) {
        const reflectedVx = entity.velocity.x - 2 * dot * nx;
        const reflectedVy = entity.velocity.y - 2 * dot * ny;
        entity.applyImpulse(new Vector2(reflectedVx - entity.velocity.x, reflectedVy - entity.velocity.y));
    }
}
