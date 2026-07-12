import { TERRAIN_SHAPES } from "./terrainConfig.js";
import { applyCollisionResponse } from "../physics/collisionResponse.js";
import { resolvePolygonTerrainCollision } from "../physics/CollisionShape.js";

/**
 * 원형 entity vs 원형 terrain 충돌 해결.
 */
function resolveCircleTerrainCollision(entity, terrain) {
    if (!Number.isFinite(terrain.x) || !Number.isFinite(terrain.y) || !Number.isFinite(terrain.radius)) return false;

    const entityRadius = entity.radius ?? 0;
    const dx = entity.position.x - terrain.x;
    const dy = entity.position.y - terrain.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const minDist = entityRadius + terrain.radius;
    if (dist >= minDist) return false;

    const nx = dist > 0 ? dx / dist : 1;
    const ny = dist > 0 ? dy / dist : 0;

    const overlap = minDist - (dist > 0 ? dist : 0);
    entity.position.x += nx * overlap;
    entity.position.y += ny * overlap;

    const normal = { x: nx, y: ny };
    const contactPoint = {
        x: entity.position.x - normal.x * entityRadius,
        y: entity.position.y - normal.y * entityRadius
    };
    const preVel = { x: entity.velocity.x, y: entity.velocity.y };
    applyCollisionResponse(entity, normal, contactPoint, preVel, {
        surfaceMaterial: "wood"
    });

    return true;
}

/**
 * shape dispatcher: entity vs terrain.
 */
export function resolveTerrainCollision(entity, terrain) {
    if (!terrain || !terrain.blocking) return false;
    if (terrain.shape === TERRAIN_SHAPES.CIRCLE) {
        return resolveCircleTerrainCollision(entity, terrain);
    }
    if (terrain.shape === TERRAIN_SHAPES.POLYGON) {
        return resolvePolygonTerrainCollision(entity, terrain);
    }
    return false;
}

export function resolveTerrainCollisions(entity, terrainList) {
    if (!terrainList || terrainList.length === 0) return false;
    let collided = false;
    for (const terrain of terrainList) {
        collided = resolveTerrainCollision(entity, terrain) || collided;
    }
    return collided;
}
