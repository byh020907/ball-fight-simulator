import { Vector2 } from "../core.js";

export const HUNTING_COMPANION_CONFIG = Object.freeze({
    radiusScale: 0.82,
    roamRadiusMultiplier: 2.2,
    returnSpeedPerDistance: 3,
    maximumReturnSpeedMultiplier: 1.2,
    turningRate: 7
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

export function canApplyHuntingCompanionCohesion(companion, leader) {
    return Boolean(
        companion &&
        leader &&
        companion !== leader &&
        !companion.flags?.defeated &&
        !companion.flags?.destroyed &&
        !companion.state?.swallowed &&
        !companion.state?.movement &&
        !companion.state?.forcedHeading &&
        !leader.flags?.defeated &&
        !leader.flags?.destroyed
    );
}

export function getHuntingCompanionCohesionImpulse(companion, leader, delta, config = HUNTING_COMPANION_CONFIG) {
    if (!canApplyHuntingCompanionCohesion(companion, leader) || !Number.isFinite(delta) || delta <= 0) return null;

    const offsetToLeader = Vector2.subtract(leader.position, companion.position);
    const distance = offsetToLeader.length();
    const combinedRadius = Math.max(0, leader.radius) + Math.max(0, companion.radius);
    const roamRadius = combinedRadius * config.roamRadiusMultiplier;
    if (distance <= roamRadius || distance <= 0.001) return null;

    const excessDistance = distance - roamRadius;
    const maximumReturnSpeed = companion.stats.baseSpeed * config.maximumReturnSpeedMultiplier;
    const returnSpeed = Math.min(maximumReturnSpeed, excessDistance * config.returnSpeedPerDistance);
    const desiredVelocity = leader.velocity.clone().add(offsetToLeader.normalize().scale(returnSpeed));
    const correctionRatio = 1 - Math.exp(-config.turningRate * delta);
    return Vector2.subtract(desiredVelocity, companion.velocity).scale(correctionRatio);
}
