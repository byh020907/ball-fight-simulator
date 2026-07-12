import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { getLevelRewardEffectText, LEVEL_REWARD_EFFECT_TYPES } from "./reward-effects/effectRegistry.js";

const EMPTY_REWARDS = Object.freeze([]);
const progressionCache = new Map();

function normalizeLevel(level) {
    const maxLevel = REWARD_BALANCE.experience.maxLevel;
    return Math.max(1, Math.min(maxLevel, Math.floor(Number.isFinite(level) ? level : 1)));
}

function getEntries(characterId) {
    return REWARD_BALANCE.experience.characterLevelProgressions[characterId] ?? EMPTY_REWARDS;
}

function createBaseStatEffects(baseStats) {
    return Object.entries(baseStats ?? {}).map(([stat, value]) =>
        Object.freeze({ type: LEVEL_REWARD_EFFECT_TYPES.STAT, stat, value })
    );
}

function createAbilityTierEffect(abilityTier, gameText) {
    if (!Number.isInteger(abilityTier) || abilityTier <= 0) return null;
    if (typeof gameText !== "string" || !gameText.trim()) {
        throw new Error(`Missing game text for ability tier reward: ${abilityTier}`);
    }
    return Object.freeze({ type: LEVEL_REWARD_EFFECT_TYPES.ABILITY_TIER, tier: abilityTier, gameText });
}

function createReward(characterId, entry) {
    const abilityTierEffect = createAbilityTierEffect(entry.abilityTier, entry.gameText);
    const effects = [...createBaseStatEffects(entry.baseStats), abilityTierEffect].filter(Boolean);
    return Object.freeze({
        id: `${characterId}-level-${entry.level}`,
        level: entry.level,
        baseStats: Object.freeze({ ...(entry.baseStats ?? {}) }),
        abilityTier: entry.abilityTier ?? 0,
        effects: Object.freeze(effects),
        text: effects.map(getLevelRewardEffectText).join(" · ")
    });
}

function sumBaseStatBonuses(rewards) {
    const bonuses = {};
    for (const reward of rewards) {
        for (const [stat, value] of Object.entries(reward.baseStats)) {
            bonuses[stat] = (bonuses[stat] ?? 0) + value;
        }
    }
    return bonuses;
}

function createSnapshot(characterId, level) {
    const rewards = getEntries(characterId)
        .filter((entry) => entry.level <= level)
        .map((entry) => createReward(characterId, entry));
    const baseStatBonuses = sumBaseStatBonuses(rewards);
    const abilityTier = rewards.reduce((tier, reward) => Math.max(tier, reward.abilityTier), 0);

    return Object.freeze({
        characterId,
        level,
        rewards: Object.freeze(rewards),
        effects: Object.freeze(rewards.flatMap((reward) => reward.effects)),
        baseStatBonuses: Object.freeze(baseStatBonuses),
        abilityTier,
        rewardIds: Object.freeze(rewards.map((reward) => reward.id))
    });
}

export function getCharacterLevelProgression(characterId, level) {
    const normalizedLevel = normalizeLevel(level);
    const cacheKey = `${characterId}:${normalizedLevel}`;
    const cached = progressionCache.get(cacheKey);
    if (cached) return cached;

    const progression = createSnapshot(characterId, normalizedLevel);
    progressionCache.set(cacheKey, progression);
    return progression;
}

export function getCharacterLevelRewardsBetween(characterId, previousLevel, level) {
    const maxLevel = REWARD_BALANCE.experience.maxLevel;
    const startLevel = Math.max(2, Math.floor(Number.isFinite(previousLevel) ? previousLevel : 1) + 1);
    const endLevel = Math.min(maxLevel, Math.floor(Number.isFinite(level) ? level : 1));
    if (endLevel < startLevel) return EMPTY_REWARDS;
    return getEntries(characterId)
        .filter((entry) => entry.level >= startLevel && entry.level <= endLevel)
        .map((entry) => createReward(characterId, entry));
}

export function getCharacterLevelRewards(characterId) {
    return getEntries(characterId).map((entry) => createReward(characterId, entry));
}

export function getNextCharacterLevelReward(characterId, level) {
    const normalizedLevel = normalizeLevel(level);
    const entry = getEntries(characterId).find((candidate) => candidate.level > normalizedLevel);
    return entry ? createReward(characterId, entry) : null;
}
