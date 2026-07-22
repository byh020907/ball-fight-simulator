export const HUNTING_COMPANION_CONFIG = Object.freeze({
    radiusScale: 0.82
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
