import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const EMPTY_UPGRADE = Object.freeze({});
const upgradeCache = new Map();

export function getAbilityUpgrade(abilityId, tier = 0) {
    const definition = REWARD_BALANCE.experience.abilityUpgrades[abilityId];
    if (!definition) return EMPTY_UPGRADE;

    const normalizedTier = Math.max(0, Math.min(definition.tiers.length - 1, Math.floor(tier)));
    const cacheKey = `${abilityId}:${normalizedTier}`;
    const cached = upgradeCache.get(cacheKey);
    if (cached) return cached;

    const upgrade = Object.freeze(
        definition.tiers.slice(0, normalizedTier + 1).reduce((result, tierUpgrade) => ({ ...result, ...tierUpgrade }), {
            ...definition.base
        })
    );
    upgradeCache.set(cacheKey, upgrade);
    return upgrade;
}
