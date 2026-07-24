export const HUNTING_COMBAT_INTERACTION_CONFIG = Object.freeze({
    perfectSwap: Object.freeze({
        enabled: false,
        effectId: "hunting_perfect_swap",
        windowSeconds: 0.2,
        missedAttemptCooldownSeconds: 1.5,
        successfulSwapCooldownSeconds: 5
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
