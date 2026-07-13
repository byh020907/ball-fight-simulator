import { Vector2 } from "../core.js";

export function getCombatMovementSpeed(entity) {
    const modifiers = entity.getStatModifiers?.() ?? { speed: 1 };
    const slowMultiplier = entity.state?.slow ? entity.state.slow.amount : 1;
    const boostMultiplier = entity.state?.speedBoost ? entity.state.speedBoost.multiplier : 1;
    const movementSpeed = entity.state?.movement?.getSpeed?.(entity);
    return movementSpeed ?? entity.stats.baseSpeed * modifiers.speed * slowMultiplier * boostMultiplier;
}

export function applyMagneticAttraction(
    entity,
    collector,
    delta,
    { radius, responseRate = 0, attractionSpeed = 0 } = {}
) {
    if (!collector || collector.flags?.defeated || !Number.isFinite(radius) || radius <= 0) return false;

    const toCollector = Vector2.subtract(collector.position, entity.position);
    const distance = toCollector.length();
    const pickupRadius = collector.radius + entity.radius;
    if (distance <= pickupRadius || distance > radius) return false;

    const desiredVelocity = toCollector.normalize().scale(Math.max(0, attractionSpeed));
    const correction = 1 - Math.exp(-Math.max(0, responseRate) * Math.max(0, delta));
    entity.applyImpulse(Vector2.subtract(desiredVelocity, entity.velocity).scale(correction));
    return true;
}
