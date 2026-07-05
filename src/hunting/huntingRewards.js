import {
    HUNTING_CHEST_BREAK_WEIGHTS,
    HUNTING_CHEST_OPEN_COSTS,
    HUNTING_CHEST_RARITIES,
    HUNTING_CHEST_REWARD_TYPES,
    HUNTING_DEFEAT_PRESERVE,
    HUNTING_ENEMY_TYPES,
    HUNTING_SHARD_REWARDS,
    HUNTING_SCALING
} from "./huntingConfig.js";

const DEFAULT_RNG = () => Math.random();

export const HUNTING_CHEST_REWARD_TABLE_VERSION = 1;

export const HUNTING_CHEST_REWARD_TABLE = Object.freeze({
    common: Object.freeze([
        Object.freeze({
            id: "common-key-shards",
            weight: 45,
            type: HUNTING_CHEST_REWARD_TYPES.SHARDS,
            amount: 18,
            text: "파편 +18"
        }),
        Object.freeze({
            id: "common-field-heal",
            weight: 35,
            type: HUNTING_CHEST_REWARD_TYPES.INSTANT_HEAL,
            healRatio: 0.18,
            text: "다음 사냥터 HP 회복 +18%"
        }),
        Object.freeze({
            id: "common-damage-boost",
            weight: 20,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "damage",
            multiplier: 1.08,
            floors: 1,
            text: "다음 1층 피해 +8%"
        })
    ]),
    uncommon: Object.freeze([
        Object.freeze({
            id: "uncommon-key-shards",
            weight: 35,
            type: HUNTING_CHEST_REWARD_TYPES.SHARDS,
            amount: 45,
            text: "파편 +45"
        }),
        Object.freeze({
            id: "uncommon-field-heal",
            weight: 30,
            type: HUNTING_CHEST_REWARD_TYPES.INSTANT_HEAL,
            healRatio: 0.3,
            text: "다음 사냥터 HP 회복 +30%"
        }),
        Object.freeze({
            id: "uncommon-defense-boost",
            weight: 20,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "defense",
            multiplier: 1.12,
            floors: 2,
            text: "다음 2층 방어 +12%"
        }),
        Object.freeze({
            id: "uncommon-speed-boost",
            weight: 15,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "speed",
            multiplier: 1.08,
            floors: 2,
            text: "다음 2층 속도 +8%"
        })
    ]),
    rare: Object.freeze([
        Object.freeze({
            id: "rare-key-shards",
            weight: 30,
            type: HUNTING_CHEST_REWARD_TYPES.SHARDS,
            amount: 105,
            text: "파편 +105"
        }),
        Object.freeze({
            id: "rare-fuller-heal",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.INSTANT_HEAL,
            healRatio: 0.45,
            text: "다음 사냥터 HP 회복 +45%"
        }),
        Object.freeze({
            id: "rare-damage-boost",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "damage",
            multiplier: 1.15,
            floors: 2,
            text: "다음 2층 피해 +15%"
        }),
        Object.freeze({
            id: "rare-skill-boost",
            weight: 20,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "skill",
            multiplier: 1.12,
            floors: 2,
            text: "다음 2층 기술 +12%"
        })
    ]),
    epic: Object.freeze([
        Object.freeze({
            id: "epic-key-shards",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.SHARDS,
            amount: 230,
            text: "파편 +230"
        }),
        Object.freeze({
            id: "epic-survival-heal",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.INSTANT_HEAL,
            healRatio: 0.65,
            text: "다음 사냥터 HP 회복 +65%"
        }),
        Object.freeze({
            id: "epic-damage-boost",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "damage",
            multiplier: 1.22,
            floors: 3,
            text: "다음 3층 피해 +22%"
        }),
        Object.freeze({
            id: "epic-defense-boost",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "defense",
            multiplier: 1.2,
            floors: 3,
            text: "다음 3층 방어 +20%"
        })
    ]),
    legendary: Object.freeze([
        Object.freeze({
            id: "legendary-key-shards",
            weight: 20,
            type: HUNTING_CHEST_REWARD_TYPES.SHARDS,
            amount: 520,
            text: "파편 +520"
        }),
        Object.freeze({
            id: "legendary-full-heal",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.INSTANT_HEAL,
            healRatio: 1,
            text: "다음 사냥터 HP 완전 회복"
        }),
        Object.freeze({
            id: "legendary-damage-boost",
            weight: 30,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "damage",
            multiplier: 1.35,
            floors: 3,
            text: "다음 3층 피해 +35%"
        }),
        Object.freeze({
            id: "legendary-all-rounder",
            weight: 25,
            type: HUNTING_CHEST_REWARD_TYPES.TEMP_STAT,
            stat: "speed",
            multiplier: 1.25,
            floors: 3,
            text: "다음 3층 속도 +25%"
        })
    ])
});

function clampFloor(floor) {
    if (!Number.isFinite(floor)) return 1;
    return Math.max(1, Math.floor(floor));
}

function rollInteger(min, max, rng = DEFAULT_RNG) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(Math.max(0, Math.min(0.999999, rng())) * (hi - lo + 1));
}

export function getRewardMultiplier(floor) {
    return 1 + (clampFloor(floor) - 1) * HUNTING_SCALING.REWARD_PER_FLOOR;
}

function cloneRewardDefinition(reward) {
    return { ...reward };
}

export function getHuntingChestRewardTable(rarity = "common") {
    const safeRarity = HUNTING_CHEST_RARITIES.includes(rarity) ? rarity : "common";
    return HUNTING_CHEST_REWARD_TABLE[safeRarity].map(cloneRewardDefinition);
}

export function describeHuntingChestRewards(rarity = "common") {
    return getHuntingChestRewardTable(rarity)
        .map((reward) => reward.text)
        .join(" / ");
}

export function rollHuntingChestReward(chestOrRarity = "common", { rng = DEFAULT_RNG } = {}) {
    const rarity = typeof chestOrRarity === "string" ? chestOrRarity : chestOrRarity?.rarity;
    const table = getHuntingChestRewardTable(rarity);
    const totalWeight = table.reduce((sum, reward) => sum + Math.max(0, reward.weight ?? 0), 0);
    let roll = Math.max(0, Math.min(0.999999, rng())) * totalWeight;

    for (const reward of table) {
        roll -= Math.max(0, reward.weight ?? 0);
        if (roll < 0) {
            return {
                ...cloneRewardDefinition(reward),
                rarity: HUNTING_CHEST_RARITIES.includes(rarity) ? rarity : "common",
                tableVersion: HUNTING_CHEST_REWARD_TABLE_VERSION
            };
        }
    }

    const fallback = table[0];
    return {
        ...cloneRewardDefinition(fallback),
        rarity: HUNTING_CHEST_RARITIES.includes(rarity) ? rarity : "common",
        tableVersion: HUNTING_CHEST_REWARD_TABLE_VERSION
    };
}

export function rollShardReward({ floor = 1, enemyType = HUNTING_ENEMY_TYPES.NORMAL, rng = DEFAULT_RNG } = {}) {
    const range = HUNTING_SHARD_REWARDS[enemyType] ?? HUNTING_SHARD_REWARDS[HUNTING_ENEMY_TYPES.NORMAL];
    const base = rollInteger(range.min, range.max, rng);
    const clearBonus = 10;
    const deepBonus = 1 + (clampFloor(floor) - 1) * HUNTING_SCALING.DEEP_FLOOR_BONUS;
    return Math.max(0, Math.round((base + clearBonus) * deepBonus));
}

export function createHuntingChest({ rarity = "common", id = null, acquiredAt = Date.now() } = {}) {
    const safeRarity = HUNTING_CHEST_RARITIES.includes(rarity) ? rarity : "common";
    return {
        id: id ?? `chest-${safeRarity}-${acquiredAt}-${Math.floor(Math.random() * 1_000_000)}`,
        rarity: safeRarity,
        acquiredAt,
        openCost: getChestOpenCost(safeRarity),
        rewardTableVersion: HUNTING_CHEST_REWARD_TABLE_VERSION,
        rewardPreview: describeHuntingChestRewards(safeRarity)
    };
}

export function createEmptyHuntingLoot() {
    return {
        shards: 0,
        chests: [],
        xp: 0
    };
}

export function mergeHuntingLoot(base = createEmptyHuntingLoot(), addition = createEmptyHuntingLoot()) {
    return {
        shards: Math.max(0, Math.floor((base.shards ?? 0) + (addition.shards ?? 0))),
        chests: [...(base.chests ?? []), ...(addition.chests ?? [])],
        xp: Math.max(0, Math.floor((base.xp ?? 0) + (addition.xp ?? 0)))
    };
}

export function destroyChestsOnDefeat(chests = [], rng = DEFAULT_RNG) {
    const ordered = [...chests]
        .map((chest, index) => ({ chest, index, tie: rng() }))
        .sort((a, b) => {
            const weightA = HUNTING_CHEST_BREAK_WEIGHTS[a.chest?.rarity] ?? 0;
            const weightB = HUNTING_CHEST_BREAK_WEIGHTS[b.chest?.rarity] ?? 0;
            if (weightB !== weightA) return weightB - weightA;
            return a.tie - b.tie;
        });

    const destroyedIds = new Set();
    const destroyedChests = [];
    let probability = 1;
    for (const item of ordered) {
        if (rng() > probability) break;
        destroyedIds.add(item.chest.id);
        destroyedChests.push(item.chest);
        probability *= 0.5;
    }

    return {
        destroyedChests,
        preservedChests: chests.filter((chest) => !destroyedIds.has(chest.id))
    };
}

export function applyDefeatPreservation(pendingLoot = createEmptyHuntingLoot(), rng = DEFAULT_RNG) {
    const { destroyedChests, preservedChests } = destroyChestsOnDefeat(pendingLoot.chests ?? [], rng);
    return {
        preservedLoot: {
            shards: Math.floor((pendingLoot.shards ?? 0) * HUNTING_DEFEAT_PRESERVE.SHARDS),
            chests: preservedChests,
            xp: Math.floor((pendingLoot.xp ?? 0) * HUNTING_DEFEAT_PRESERVE.XP)
        },
        lostLoot: {
            shards: Math.ceil((pendingLoot.shards ?? 0) * (1 - HUNTING_DEFEAT_PRESERVE.SHARDS)),
            chests: destroyedChests,
            xp: Math.ceil((pendingLoot.xp ?? 0) * (1 - HUNTING_DEFEAT_PRESERVE.XP))
        }
    };
}

export function getChestOpenCost(rarity) {
    return HUNTING_CHEST_OPEN_COSTS[rarity] ?? HUNTING_CHEST_OPEN_COSTS.common;
}
