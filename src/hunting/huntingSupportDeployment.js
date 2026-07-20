import { COMBAT_PARTICIPATION_MODES } from "../simulation/combatParticipation.js";

export const HUNTING_SUPPORT_DEPLOYMENT_CONFIG = Object.freeze({
    duration: 4,
    abilityTimeScale: 2,
    spawnOffsetRadiusMultiplier: 2.4
});

export function createHuntingSupportCombatSpec(baseSpec, slotIndex, config = HUNTING_SUPPORT_DEPLOYMENT_CONFIG) {
    return {
        ...baseSpec,
        combatParticipation: {
            mode: COMBAT_PARTICIPATION_MODES.SUPPORT,
            abilityTimeScale: config.abilityTimeScale
        },
        hunting: {
            ...(baseSpec.hunting ?? {}),
            supportSlotIndex: slotIndex
        }
    };
}

export function createHuntingSupportDeployment(fighter, slotIndex, config = HUNTING_SUPPORT_DEPLOYMENT_CONFIG) {
    return {
        fighter,
        slotIndex,
        remaining: config.duration,
        withdrawing: false
    };
}

export function advanceHuntingSupportDeployment(deployment, delta) {
    if (!deployment || deployment.withdrawing) return deployment;
    const remaining = Math.max(0, deployment.remaining - Math.max(0, delta));
    return { ...deployment, remaining, withdrawing: remaining === 0 };
}
