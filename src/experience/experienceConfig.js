export const XP_SCALE = 20;

export const STAGE_MULTIPLIERS = Object.freeze({
    round1: 1.0,
    round2: 1.2,
    final: 2.5,
    winBonus: 1.0
});

export const COMEBACK_THRESHOLD = 0.3;
export const COMEBACK_WEIGHT = 0.5;

export const MAX_DEAL_RATIO = 2.0;

export const MAX_LEVEL = 10;

export const LEVEL_COST_MULTIPLIER = 1.35;

export const LEVEL_COSTS = Object.freeze(buildLevelCosts(MAX_LEVEL, LEVEL_COST_MULTIPLIER));

function buildLevelCosts(maxLevel, multiplier) {
    const costs = [0];
    let cumulative = 0;
    let cost = 100;
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

export const LEVEL_REWARDS = Object.freeze([
    null,
    null,
    { hp: 2 },
    { damage: 1 },
    { abilityCooldownPercent: -2 },
    { signatureBonusPercent: 3 },
    { hp: 2 },
    { damage: 1 },
    { actionHpCostPercent: -2 },
    { abilityCooldownPercent: -2 },
    { title: true }
]);
