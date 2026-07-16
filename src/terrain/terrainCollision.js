import { TERRAIN_SHAPES } from "./terrainConfig.js";
import { applyCollisionResponse } from "../physics/collisionResponse.js";
import { resolvePolygonTerrainCollision } from "../physics/CollisionShape.js";
import { Vector2 } from "../core.js";

function resolveCircleTerrainCollision(entity, terrain) {
    if (!Number.isFinite(terrain.x) || !Number.isFinite(terrain.y) || !Number.isFinite(terrain.radius)) return null;

    const entityRadius = entity.radius ?? 0;
    const dx = entity.position.x - terrain.x;
    const dy = entity.position.y - terrain.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const minDist = entityRadius + terrain.radius;
    if (dist >= minDist) return null;

    const nx = dist > 0 ? dx / dist : 1;
    const ny = dist > 0 ? dy / dist : 0;

    const overlap = minDist - (dist > 0 ? dist : 0);
    entity.position.x += nx * overlap;
    entity.position.y += ny * overlap;

    const normal = new Vector2(nx, ny);
    const contactPoint = new Vector2(
        entity.position.x - normal.x * entityRadius,
        entity.position.y - normal.y * entityRadius
    );
    const preVel = new Vector2(entity.velocity.x, entity.velocity.y);
    applyCollisionResponse(entity, normal, contactPoint, preVel, {
        surfaceMaterial: "wood"
    });

    return { normal, contactPoint };
}

export function resolveTerrainCollision(entity, terrain) {
    if (!terrain || !terrain.blocking) return null;
    let result = null;
    if (terrain.shape === TERRAIN_SHAPES.CIRCLE) {
        result = resolveCircleTerrainCollision(entity, terrain);
    } else if (terrain.shape === TERRAIN_SHAPES.POLYGON) {
        result = resolvePolygonTerrainCollision(entity, terrain);
    }
    if (result) terrain.onTerrainCollision?.(entity);
    return result;
}

export function resolveTerrainCollisions(entity, terrainList) {
    if (!terrainList || terrainList.length === 0) return null;
    let lastResult = null;
    for (const terrain of terrainList) {
        const result = resolveTerrainCollision(entity, terrain);
        if (result) lastResult = result;
    }
    return lastResult;
}
