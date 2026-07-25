import {
    HUNTING_CHEST_BREAK_WEIGHTS,
    HUNTING_CHEST_OPEN_COSTS,
    HUNTING_CHEST_RARITIES,
    HUNTING_CHEST_REWARD_TYPES,
    HUNTING_DEFEAT_PRESERVE
} from "./huntingConfig.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import {
    EQUIPMENT_RARITIES,
    EQUIPMENT_SPECIAL_OPTION_SUFFIXES,
    getEquipmentMaxEnhanceLevel,
    STAT_TYPES
} from "./equipmentConfig.js";
import { formatEquipmentSpecialName } from "./equipmentNaming.js";
import { getEquipmentTemplate } from "./equipmentTemplates.js";

const DEFAULT_RNG = () => Math.random();

const DEFAULT_MAX_CHEST_COUNT = 200;

function sanitizeNumber(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
}

function sanitizeTimestamp(value) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
}

function sanitizeChestOpenCost(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function sanitizeGuaranteedEquipment(item) {
    if (!item || typeof item !== "object") return null;

    const rarity = EQUIPMENT_RARITIES.includes(item.rarity) ? item.rarity : null;
    const slot = ["weapon", "armor", "accessory"].includes(item.slot) ? item.slot : null;
    const name = typeof item.name === "string" && item.name.length > 0 ? item.name : null;
    if (!rarity || !slot || !name) return null;

    const description = typeof item.description === "string" ? item.description : "";
    const stats = Array.isArray(item.stats)
        ? item.stats
              .map((stat) => {
                  const type = STAT_TYPES.includes(stat?.type) ? stat.type : null;
                  const value = sanitizeNumber(stat?.value);
                  const min = sanitizeNumber(stat?.min ?? stat?.value);
                  const max = sanitizeNumber(stat?.max ?? stat?.value);
                  return type && value > 0 ? { type, value, min, max } : null;
              })
              .filter(Boolean)
        : [];

    if (stats.length === 0) return null;

    const specialOptions = Array.isArray(item.specialOptions)
        ? item.specialOptions
              .map((option) => {
                  const type = typeof option?.type === "string" ? option.type : null;
                  const value = sanitizeNumber(option?.value);
                  if (!type || value <= 0) return null;
                  return { type, value };
              })
              .filter(Boolean)
        : null;

    const formattedName = formatEquipmentSpecialName(name, specialOptions ?? [], EQUIPMENT_SPECIAL_OPTION_SUFFIXES);

    return {
        instanceId:
            typeof item.instanceId === "string" && item.instanceId.length > 0
                ? item.instanceId
                : `legacy-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        rarity,
        slot,
        name: formattedName,
        baseName: typeof item.baseName === "string" ? item.baseName : name,
        primaryStatType: stats[0].type,
        specialOptionType: specialOptions?.[0]?.type ?? null,
        description,
        stats,
        specialOptions,
        enhanceLevel: Math.min(getEquipmentMaxEnhanceLevel(rarity), Math.max(0, sanitizeNumber(item.enhanceLevel, 0))),
        draw: typeof item.draw === "string" ? item.draw : slot,
        isGuaranteed: true
    };
}

export function sanitizeHuntingChest(chest) {
    if (!chest || typeof chest !== "object") return null;
    const id = typeof chest.id === "string" && chest.id.length > 0 ? chest.id : null;
    if (!id) return null;

    const rarity = HUNTING_CHEST_RARITIES.includes(chest.rarity) ? chest.rarity : "common";
    const guaranteedEquipment = sanitizeGuaranteedEquipment(chest.guaranteedEquipment);

    return {
        id,
        rarity,
        acquiredAt: sanitizeTimestamp(chest.acquiredAt) ?? Date.now(),
        openCost: sanitizeChestOpenCost(chest.openCost, getChestOpenCost(rarity)),
        rewardTableVersion: HUNTING_CHEST_REWARD_TABLE_VERSION,
        rewardPreview:
            typeof chest.rewardPreview === "string" ? chest.rewardPreview : (guaranteedEquipment?.name ?? null),
        guaranteedEquipment
    };
}

export function normalizeHuntingChests(chests = [], { dedupe = false, maxCount = null } = {}) {
    const rawList = Array.isArray(chests) ? chests : [];
    const seen = new Set();
    const result = [];

    for (const rawChest of rawList) {
        const chest = sanitizeHuntingChest(rawChest);
        if (!chest) continue;
        if (dedupe && seen.has(chest.id)) continue;
        seen.add(chest.id);
        result.push(chest);
    }

    if (typeof maxCount === "number" && maxCount >= 0) return result.slice(-maxCount);
    return result;
}

export function sanitizeEquipmentMap(raw = {}) {
    if (!raw || typeof raw !== "object") return {};
    const result = {};
    for (const [templateId, count] of Object.entries(raw)) {
        const safeCount = Math.floor(Number(count) || 0);
        const template = getEquipmentTemplate(templateId);
        if (template && template.tier === "basic" && safeCount > 0) {
            result[templateId] = safeCount;
        }
    }
    return result;
}

export function normalizeHuntingLoot(loot = {}) {
    return {
        shards: Math.max(0, sanitizeNumber(loot?.shards)),
        enhancementStones: Math.max(0, sanitizeNumber(loot?.enhancementStones)),
        chests: normalizeHuntingChests(loot?.chests),
        equipment: sanitizeEquipmentMap(loot?.equipment)
    };
}

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
    return normalizeHuntingLoot();
}

export function mergeHuntingLoot(base = createEmptyHuntingLoot(), addition = createEmptyHuntingLoot()) {
    const baseLoot = normalizeHuntingLoot(base);
    const additionLoot = normalizeHuntingLoot(addition);

    const mergedEquipment = { ...baseLoot.equipment };
    for (const [id, count] of Object.entries(additionLoot.equipment)) {
        mergedEquipment[id] = (mergedEquipment[id] ?? 0) + count;
    }

    return {
        shards: Math.max(0, Math.floor(baseLoot.shards + additionLoot.shards)),
        enhancementStones: Math.max(0, Math.floor(baseLoot.enhancementStones + additionLoot.enhancementStones)),
        chests: [...baseLoot.chests, ...additionLoot.chests],
        equipment: mergedEquipment
    };
}

export function destroyChestsOnDefeat(chests = [], rng = DEFAULT_RNG) {
    const normalizedChests = normalizeHuntingChests(chests, { maxCount: DEFAULT_MAX_CHEST_COUNT });
    const ordered = [...normalizedChests]
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
        preservedChests: normalizedChests.filter((chest) => !destroyedIds.has(chest.id))
    };
}

export function applyDefeatPreservation(pendingLoot = createEmptyHuntingLoot(), rng = DEFAULT_RNG) {
    const normalizedLoot = normalizeHuntingLoot(pendingLoot);
    const { destroyedChests, preservedChests } = destroyChestsOnDefeat(normalizedLoot.chests, rng);
    return {
        preservedLoot: {
            shards: Math.floor(normalizedLoot.shards * HUNTING_DEFEAT_PRESERVE.SHARDS),
            enhancementStones: Math.floor(normalizedLoot.enhancementStones * HUNTING_DEFEAT_PRESERVE.SHARDS),
            chests: preservedChests,
            equipment: { ...normalizedLoot.equipment }
        },
        lostLoot: {
            shards: Math.ceil(normalizedLoot.shards * (1 - HUNTING_DEFEAT_PRESERVE.SHARDS)),
            enhancementStones: Math.ceil(normalizedLoot.enhancementStones * (1 - HUNTING_DEFEAT_PRESERVE.SHARDS)),
            chests: destroyedChests,
            equipment: {}
        }
    };
}

export function getChestOpenCost(rarity) {
    return HUNTING_CHEST_OPEN_COSTS[rarity] ?? HUNTING_CHEST_OPEN_COSTS.common;
}
