import {
    HUNTING_CHEST_BREAK_WEIGHTS,
    HUNTING_CHEST_OPEN_COSTS,
    HUNTING_CHEST_RARITIES,
    HUNTING_DEFEAT_PRESERVE,
    HUNTING_ENEMY_TYPES,
    HUNTING_KEY_SHARD_RANGES,
    HUNTING_SCALING
} from "./huntingConfig.js";

const DEFAULT_RNG = () => Math.random();

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

export function rollKeyShardReward({ floor = 1, enemyType = HUNTING_ENEMY_TYPES.NORMAL, rng = DEFAULT_RNG } = {}) {
    const range = HUNTING_KEY_SHARD_RANGES[enemyType] ?? HUNTING_KEY_SHARD_RANGES[HUNTING_ENEMY_TYPES.NORMAL];
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
        acquiredAt
    };
}

export function createEmptyHuntingLoot() {
    return {
        keyShards: 0,
        chests: [],
        xp: 0
    };
}

export function mergeHuntingLoot(base = createEmptyHuntingLoot(), addition = createEmptyHuntingLoot()) {
    return {
        keyShards: Math.max(0, Math.floor((base.keyShards ?? 0) + (addition.keyShards ?? 0))),
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
            keyShards: Math.floor((pendingLoot.keyShards ?? 0) * HUNTING_DEFEAT_PRESERVE.KEY_SHARDS),
            chests: preservedChests,
            xp: Math.floor((pendingLoot.xp ?? 0) * HUNTING_DEFEAT_PRESERVE.XP)
        },
        lostLoot: {
            keyShards: Math.ceil((pendingLoot.keyShards ?? 0) * (1 - HUNTING_DEFEAT_PRESERVE.KEY_SHARDS)),
            chests: destroyedChests,
            xp: Math.ceil((pendingLoot.xp ?? 0) * (1 - HUNTING_DEFEAT_PRESERVE.XP))
        }
    };
}

export function getChestOpenCost(rarity) {
    return HUNTING_CHEST_OPEN_COSTS[rarity] ?? HUNTING_CHEST_OPEN_COSTS.common;
}
