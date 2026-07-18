import { Vector2 } from "../core.js";
import { polygonBoundingRadius } from "../physics/CollisionShape.js";
import { TERRAIN_SHAPES } from "../terrain/terrainConfig.js";

const TURRET_PLACEMENT_DISTANCE = 80;
const TURRET_PLACEMENT_FALLBACK_DISTANCES = [120, 160];
const TURRET_PLACEMENT_DIRECTION_COUNT = 16;
const TURRET_PLACEMENT_ARENA_PADDING = 30;
const TURRET_PLACEMENT_OCCUPANCY_PADDING = 28;

export const GUNNER_TURRET_PLACEMENT_DEFAULTS = {
    distances: [TURRET_PLACEMENT_DISTANCE, ...TURRET_PLACEMENT_FALLBACK_DISTANCES],
    directionCount: TURRET_PLACEMENT_DIRECTION_COUNT,
    arenaPadding: TURRET_PLACEMENT_ARENA_PADDING,
    occupancyPadding: TURRET_PLACEMENT_OCCUPANCY_PADDING
};

export function findGunnerTurretPlacement({
    ownerPosition,
    owner,
    direction,
    arena,
    entities,
    terrain,
    options = GUNNER_TURRET_PLACEMENT_DEFAULTS,
    isOccupied = isGunnerTurretPlacementOccupied
}) {
    const baseAngle = Math.atan2(direction.y, direction.x);
    for (const distance of options.distances) {
        for (const offset of getPlacementAngleOffsets(options.directionCount)) {
            const candidate = Vector2.add(ownerPosition, Vector2.fromAngle(baseAngle + offset, distance));
            candidate.x = Math.max(options.arenaPadding, Math.min(arena.width - options.arenaPadding, candidate.x));
            candidate.y = Math.max(options.arenaPadding, Math.min(arena.height - options.arenaPadding, candidate.y));
            if (!isOccupied(candidate, { owner, entities, terrain, occupancyPadding: options.occupancyPadding })) {
                return candidate;
            }
        }
    }
    return ownerPosition.clone();
}

export function isGunnerTurretPlacementOccupied(candidate, { owner, entities, terrain, occupancyPadding }) {
    const entityOverlap = entities.some(
        (entity) =>
            !entity.isExpired &&
            entity !== owner &&
            entity.radius > 0 &&
            Vector2.subtract(entity.position, candidate).length() < entity.radius + occupancyPadding
    );
    if (entityOverlap) return true;
    return terrain.some((terrainEntity) => {
        if (!terrainEntity?.blocking || !Number.isFinite(terrainEntity.x) || !Number.isFinite(terrainEntity.y))
            return false;
        const radius =
            terrainEntity.shape === TERRAIN_SHAPES.CIRCLE
                ? (terrainEntity.radius ?? 0)
                : terrainEntity.shape === TERRAIN_SHAPES.POLYGON
                  ? polygonBoundingRadius(terrainEntity.points)
                  : 0;
        return (
            Vector2.subtract(new Vector2(terrainEntity.x, terrainEntity.y), candidate).length() <
            radius + occupancyPadding
        );
    });
}

function getPlacementAngleOffsets(directionCount) {
    return Array.from({ length: directionCount }, (_, index) => {
        const step = Math.ceil(index / 2);
        return (index % 2 === 0 ? step : -step) * ((Math.PI * 2) / directionCount);
    });
}
