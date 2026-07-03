export {
    XP_SCALE,
    STAGE_MULTIPLIERS,
    COMEBACK_THRESHOLD,
    COMEBACK_WEIGHT,
    MAX_DEAL_RATIO,
    MAX_LEVEL,
    LEVEL_COST_MULTIPLIER,
    LEVEL_COSTS,
    getLevelRequirement,
    LEVEL_REWARDS
} from "./experienceConfig.js";

export {
    getStageMultiplier,
    calcMatchXp,
    getLevelFromXp,
    getXpForNextLevel,
    getXpProgressInLevel,
    calcTournamentXp
} from "./experienceState.js";
