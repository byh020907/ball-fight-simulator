import { Vector2 } from "../core.js";

export const HUNTING_COMBAT_INTERACTION_CONFIG = Object.freeze({
    perfectSwap: Object.freeze({
        enabled: true,
        effectId: "hunting_perfect_swap",
        windowSeconds: 0.2,
        missedAttemptCooldownSeconds: 1.5,
        successfulSwapCooldownSeconds: 5
    }),
    tapAcceleration: Object.freeze({
        enabled: true,
        impulseBaseSpeedRatio: 0.2,
        maximumSpeedMultiplier: 1.6,
        minimumDirectionSpeed: 5,
        particleCount: 3
    })
});

export function createPerfectSwapAttempt({
    onSuccess,
    onMiss,
    config = HUNTING_COMBAT_INTERACTION_CONFIG.perfectSwap
}) {
    let resolved = false;
    const effect = {
        remaining: config.windowSeconds,
        onFighterCollision(owner, opponent, outgoingDamage, incomingDamage, simulation) {
            if (resolved || !simulation.isHostile(owner, opponent)) return null;
            resolved = true;
            effect.isExpired = true;
            onSuccess?.({ owner, opponent, simulation });
            return { outgoingDamage, incomingDamage: 0 };
        },
        tick() {
            if (resolved || effect.remaining > 0) return;
            resolved = true;
            onMiss?.();
        }
    };
    return effect;
}

function getTapAccelerationBaseSpeed(fighter, simulation) {
    const modifiers = fighter.getStatModifiers?.() ?? { speed: 1 };
    const slowMultiplier = fighter.state?.slow?.amount ?? 1;
    const simulationMultiplier = simulation.getSpeedMultiplier?.(fighter) ?? 1;
    return Math.max(0, fighter.stats.baseSpeed * (modifiers.speed ?? 1) * slowMultiplier * simulationMultiplier);
}

export function applyHuntingTapAcceleration(
    fighter,
    simulation,
    config = HUNTING_COMBAT_INTERACTION_CONFIG.tapAcceleration
) {
    if (!config.enabled || !fighter || !simulation) return { applied: false, reason: "unavailable" };
    if (fighter.flags.defeated || fighter.state.swallowed || fighter.participation?.canAct === false) {
        return { applied: false, reason: "inactive" };
    }
    if (fighter.state.movement) return { applied: false, reason: "ability_movement" };

    const currentSpeed = fighter.velocity.length();
    if (currentSpeed < config.minimumDirectionSpeed) return { applied: false, reason: "no_direction" };

    const baseSpeed = getTapAccelerationBaseSpeed(fighter, simulation);
    const maximumSpeed = baseSpeed * config.maximumSpeedMultiplier;
    if (baseSpeed <= 0 || currentSpeed >= maximumSpeed) {
        return { applied: false, reason: "maximum_speed", speed: currentSpeed, maximumSpeed };
    }

    const nextSpeed = Math.min(maximumSpeed, currentSpeed + baseSpeed * config.impulseBaseSpeedRatio);
    const direction = fighter.velocity.clone().normalize();
    fighter.applyImpulse(direction.scale(nextSpeed).subtract(fighter.velocity));

    return {
        applied: true,
        speed: fighter.velocity.length(),
        maximumSpeed,
        progress: Math.max(
            0,
            Math.min(1, (fighter.velocity.length() - baseSpeed) / Math.max(1, maximumSpeed - baseSpeed))
        )
    };
}

export function getTapAccelerationTrailOrigin(fighter) {
    const direction = fighter.velocity.length() > 0 ? fighter.velocity.clone().normalize() : new Vector2(1, 0);
    return fighter.position.clone().subtract(direction.scale(fighter.radius * 0.85));
}
