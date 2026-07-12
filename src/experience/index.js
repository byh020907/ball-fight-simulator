export {
    XP_SCALE,
    STAGE_MULTIPLIERS,
    COMEBACK_THRESHOLD,
    COMEBACK_WEIGHT,
    MAX_DEAL_RATIO,
    MAX_LEVEL,
    LEVEL_COST_MULTIPLIER,
    LEVEL_COSTS,
    getLevelRequirement
} from "./experienceConfig.js";

export {
    getStageMultiplier,
    calcMatchXp,
    getLevelFromXp,
    getXpForNextLevel,
    getXpProgressInLevel,
    calcTournamentXp
} from "./experienceState.js";

export {
    grantExperienceFromTournamentReport,
    grantExperienceFromMatchReport,
    getCharacterTotalXp,
    getCharacterExperienceSummary,
    getExperienceRewardText,
    getExperienceRewardsBetween,
    matchReportToXpInput,
    collectActiveExperienceProgression,
    applyExperienceProgressionToBall,
    applyExperienceProgressionToBaseSpec
} from "./experienceService.js";

export {
    getCharacterLevelProgression,
    getCharacterLevelRewardsBetween,
    getNextCharacterLevelReward
} from "./characterLevelProgression.js";
