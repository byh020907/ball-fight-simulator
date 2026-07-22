import { Vector2 } from "../core.js";

const COMPANION_SPAWN_ANGLES = Object.freeze([Math.PI * 0.75, Math.PI * 1.25]);

export const HUNTING_COMPANION_CONFIG = Object.freeze({
    radiusScale: 0.7,
    spawnDistanceMultiplier: 1.15,
    soloSpawnAngle: Math.PI,
    spawnAngles: COMPANION_SPAWN_ANGLES,
    arenaPaddingMultiplier: 1.05
});

export function applyHuntingCompanionScale(spec, config = HUNTING_COMPANION_CONFIG) {
    const radiusScale = Math.max(0, Number(config.radiusScale) || 0);
    const massScale = radiusScale * radiusScale;
    return {
        ...spec,
        stats: {
            ...spec.stats,
            radius: spec.stats.radius * radiusScale,
            mass: spec.stats.mass * massScale
        }
    };
}

function getCompanionSpawnAngle(index, companionCount, config) {
    if (companionCount === 1) return config.soloSpawnAngle;
    return config.spawnAngles[index % config.spawnAngles.length];
}

function clampToArena(value, radius, arenaLength, paddingMultiplier) {
    const padding = radius * paddingMultiplier;
    return Math.max(padding, Math.min(arenaLength - padding, value));
}

export function placeHuntingCompanionsNearLeader(leader, companions = [], arena, config = HUNTING_COMPANION_CONFIG) {
    if (!leader?.position || !Number.isFinite(arena?.width) || !Number.isFinite(arena?.height)) return [];

    const activeCompanions = companions.filter((companion) => companion?.position);
    for (const [index, companion] of activeCompanions.entries()) {
        const angle = getCompanionSpawnAngle(index, activeCompanions.length, config);
        const distance = (leader.radius + companion.radius) * config.spawnDistanceMultiplier;
        const position = leader.position.clone().add(Vector2.fromAngle(angle, distance));
        companion.position = new Vector2(
            clampToArena(position.x, companion.radius, arena.width, config.arenaPaddingMultiplier),
            clampToArena(position.y, companion.radius, arena.height, config.arenaPaddingMultiplier)
        );
    }

    return activeCompanions;
}
