import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const EXPERIENCE = REWARD_BALANCE.experience;

export const XP_SCALE = EXPERIENCE.xpScale;

export const STAGE_MULTIPLIERS = EXPERIENCE.stageMultipliers;

export const COMEBACK_THRESHOLD = EXPERIENCE.comebackThreshold;
export const COMEBACK_WEIGHT = EXPERIENCE.comebackWeight;

export const MAX_DEAL_RATIO = EXPERIENCE.maxDealRatio;

export const MAX_LEVEL = EXPERIENCE.maxLevel;

export const LEVEL_COST_MULTIPLIER = EXPERIENCE.levelCost.multiplier;

export const LEVEL_COSTS = Object.freeze(buildLevelCosts(MAX_LEVEL, LEVEL_COST_MULTIPLIER));

function buildLevelCosts(maxLevel, multiplier) {
    const costs = [0];
    let cumulative = 0;
    let cost = EXPERIENCE.levelCost.first;
    for (let level = 2; level <= maxLevel; level++) {
        cumulative += cost;
        costs.push(cumulative);
        cost = Math.round(cost * multiplier);
    }
    return costs;
}

export function getLevelRequirement(level) {
    if (level < 1) return 0;
    if (level > MAX_LEVEL) return LEVEL_COSTS[MAX_LEVEL - 1] + 1;
    return LEVEL_COSTS[level - 1] ?? 0;
}

export const LEVEL_REWARDS = EXPERIENCE.levelRewards;
