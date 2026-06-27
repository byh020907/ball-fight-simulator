export { DEFAULT_STAT_RULES, CHALLENGE_CONFIG } from "./progressionConfig.js";
export {
    PROGRESSION_BONUS_CAPS,
    computeEffectiveBonuses,
    applyProgressionBonus,
    applyAchievementRewards,
    formatRewardDescription,
    completeChallengeTournament
} from "./progressionState.js";
export {
    getAiTotalStatPoints,
    getAiBalancedWeight,
    getAiPowerMultiplier,
    createAiStatAllocation
} from "./challengeRules.js";
