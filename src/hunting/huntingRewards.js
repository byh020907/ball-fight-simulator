import {
    HUNTING_CHEST_BREAK_WEIGHTS,
    HUNTING_CHEST_OPEN_COSTS,
    HUNTING_CHEST_RARITIES,
    HUNTING_CHEST_REWARD_TYPES,
    HUNTING_DEFEAT_PRESERVE
} from "./huntingConfig.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const DEFAULT_RNG = () => Math.random();

export const HUNTING_CHEST_REWARD_TABLE_VERSION = REWARD_BALANCE.hunting.chest.rewardTableVersion;

export const HUNTING_CHEST_REWARD_TABLE = REWARD_BALANCE.hunting.chest.rewardTables;

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

export function createHuntingChest({
    rarity = "common",
    id = null,
    acquiredAt = Date.now(),
    openCost = null,
    rewardPreview = null,
    guaranteedEquipment = null
} = {}) {
    const safeRarity = HUNTING_CHEST_RARITIES.includes(rarity) ? rarity : "common";
    return {
        id: id ?? `chest-${safeRarity}-${acquiredAt}-${Math.floor(Math.random() * 1_000_000)}`,
        rarity: safeRarity,
        acquiredAt,
        openCost: Number.isFinite(openCost) && openCost >= 0 ? openCost : getChestOpenCost(safeRarity),
        rewardTableVersion: HUNTING_CHEST_REWARD_TABLE_VERSION,
        rewardPreview: rewardPreview ?? guaranteedEquipment?.name ?? describeHuntingChestRewards(safeRarity),
        guaranteedEquipment
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
