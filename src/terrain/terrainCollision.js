import { Vector2 } from "../core.js";
import { TERRAIN_SHAPES } from "./terrainConfig.js";

/**
 * 원형 terrain과 원형 entity 간 충돌 해결.
 * 겹침 발생 시 entity를 terrain 바깥으로 밀어내고 velocity를 반사.
 * @returns {boolean} 충돌 발생 여부
 */
export function resolveTerrainCollision(entity, terrain) {
    if (!terrain || !terrain.blocking) return false;
    if (terrain.shape !== TERRAIN_SHAPES.CIRCLE) return false;
    if (!Number.isFinite(terrain.x) || !Number.isFinite(terrain.y) || !Number.isFinite(terrain.radius)) return false;

    const entityRadius = entity.radius ?? 0;
    const dx = entity.position.x - terrain.x;
    const dy = entity.position.y - terrain.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const minDist = entityRadius + terrain.radius;
    if (dist >= minDist) return false;

    // coincident center fallback: push along x-axis
    const nx = dist > 0 ? dx / dist : 1;
    const ny = dist > 0 ? dy / dist : 0;

    // push entity outside terrain
    const overlap = minDist - (dist > 0 ? dist : 0);
    entity.position.x += nx * overlap;
    entity.position.y += ny * overlap;

    // reflect velocity
    const dot = entity.velocity.x * nx + entity.velocity.y * ny;
    if (dot < 0) {
        const reflectedVx = entity.velocity.x - 2 * dot * nx;
        const reflectedVy = entity.velocity.y - 2 * dot * ny;
        entity.applyImpulse(new Vector2(reflectedVx - entity.velocity.x, reflectedVy - entity.velocity.y));
    }

    return true;
}

/**
 * entity와 terrain 목록 전체 충돌 해결.
 */
export function resolveTerrainCollisions(entity, terrainList) {
    if (!terrainList || terrainList.length === 0) return;
    for (const terrain of terrainList) {
        resolveTerrainCollision(entity, terrain);
    }
}
