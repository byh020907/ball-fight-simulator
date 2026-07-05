import { EQUIPMENT } from "./equipmentData.js";
import { getLevelFromXp } from "../experience/experienceState.js";

export const EQUIPMENT_SLOTS = Object.freeze(Object.values(EQUIPMENT.SLOTS));
export const EQUIPMENT_RARITIES = EQUIPMENT.RARITIES;
export const EQUIPMENT_STAT_RANGES = Object.freeze(
    Object.fromEntries(
        EQUIPMENT.RARITIES.map((r, i) => {
            const key = r.toUpperCase();
            const val = EQUIPMENT.STAT_RANGES[key] ?? EQUIPMENT.STAT_RANGES.COMMON;
            return [r, val];
        })
    )
);
export const SPECIAL_OPTION_CHANCES = Object.freeze(
    Object.fromEntries(
        EQUIPMENT.RARITIES.map((r, i) => {
            const key = r.toUpperCase();
            return [r, EQUIPMENT.SPECIALS.CHANCES[key] ?? 0];
        })
    )
);
export const SPECIAL_OPTION_POOL = EQUIPMENT.SPECIALS.POOL;
export const STAT_TYPES = EQUIPMENT.STAT_TYPES;
export const EQUIPMENT_LEVEL_REQUIREMENTS = Object.freeze(
    Object.fromEntries(Object.entries(EQUIPMENT.LEVEL_REQUIREMENTS).map(([key, val]) => [key.toLowerCase(), val]))
);
export const INVENTORY_DEFAULT_SLOTS = EQUIPMENT.INVENTORY.DEFAULT_SLOTS;
export const INVENTORY_EXPAND_COST = EQUIPMENT.INVENTORY.EXPAND_COST;
export const INVENTORY_EXPAND_GAIN = EQUIPMENT.INVENTORY.EXPAND_GAIN;
export const INVENTORY_MAX_SLOTS = EQUIPMENT.INVENTORY.MAX_SLOTS;
export const ENHANCE_MAX_LEVEL = EQUIPMENT.ENHANCE.MAX_LEVEL;
export const ENHANCE_MAX_FAILURE_RATE = EQUIPMENT.ENHANCE.MAX_FAILURE_RATE;
export const ENHANCE_STAT_BONUS_PER_LEVEL = EQUIPMENT.ENHANCE.STAT_BONUS_PER_LEVEL;
export const ENHANCE_COST_TABLE = EQUIPMENT.ENHANCE.COST;
export const DISASSEMBLE_REWARDS = Object.freeze(
    Object.fromEntries(Object.entries(EQUIPMENT.DISASSEMBLE).map(([key, val]) => [key.toLowerCase(), val]))
);
export const SELL_REWARDS = Object.freeze(
    Object.fromEntries(Object.entries(EQUIPMENT.SELL).map(([key, val]) => [key.toLowerCase(), val]))
);
export const FUSION_COSTS = Object.freeze(
    Object.fromEntries(Object.entries(EQUIPMENT.FUSION.COST).map(([key, val]) => [key.toLowerCase(), val]))
);
export const EQUIPMENT_DRAW_KEYS = Object.freeze(
    Object.fromEntries(Object.entries(EQUIPMENT.DRAW).map(([key, val]) => [key.toLowerCase(), val]))
);
export const EQUIPMENT_NAMES = Object.freeze(
    Object.fromEntries(
        Object.entries(EQUIPMENT.NAMES).map(([slotKey, namesByRarity]) => [
            slotKey.toLowerCase(),
            Object.freeze(
                Object.fromEntries(
                    Object.entries(namesByRarity).map(([rarityKey, names]) => [rarityKey.toLowerCase(), names])
                )
            )
        ])
    )
);
export const EQUIPMENT_DESCRIPTIONS = Object.freeze(
    Object.fromEntries(
        Object.entries(EQUIPMENT.DESCRIPTIONS).map(([slotKey, descByRarity]) => [
            slotKey.toLowerCase(),
            Object.freeze(
                Object.fromEntries(
                    Object.entries(descByRarity).map(([rarityKey, desc]) => [rarityKey.toLowerCase(), desc])
                )
            )
        ])
    )
);

let _eqCounter = 0;

function defaultRng() {
    return Math.random();
}

function pickRandom(arr, rng = defaultRng) {
    return arr[Math.floor(rng() * arr.length)];
}

function rollInt(min, max, rng = defaultRng) {
    return Math.floor(min + rng() * (max - min + 1));
}

export function createEquipmentInstance({ rarity = "common", slot = null, rng = defaultRng } = {}) {
    const safeRarity = EQUIPMENT_RARITIES.includes(rarity) ? rarity : "common";
    const range = EQUIPMENT_STAT_RANGES[safeRarity];

    const assignedSlot =
        slot && EQUIPMENT_SLOTS.some((s) => s.id === slot) ? slot : pickRandom(EQUIPMENT_SLOTS, rng).id;

    const name = pickRandom(EQUIPMENT_NAMES[assignedSlot][safeRarity], rng);
    const description = EQUIPMENT_DESCRIPTIONS[assignedSlot][safeRarity];

    const statCount = rollInt(range.statCount.min, range.statCount.max, rng);
    const availableStats = [...STAT_TYPES];
    const stats = [];
    for (let i = 0; i < statCount && availableStats.length > 0; i++) {
        const statIndex = Math.floor(rng() * availableStats.length);
        const statType = availableStats.splice(statIndex, 1)[0];
        const value = rollInt(range.min, range.max, rng);
        stats.push({ type: statType, value, min: range.min, max: range.max });
    }

    let specialOptions = null;
    const specialChance = SPECIAL_OPTION_CHANCES[safeRarity];
    if (specialChance > 0 && rng() < specialChance && SPECIAL_OPTION_POOL.length > 0) {
        const option = pickRandom(SPECIAL_OPTION_POOL, rng);
        const value = rollInt(option.min, option.max, rng);
        specialOptions = [{ type: option.type, value }];
    }

    _eqCounter++;
    return {
        instanceId: `eq-${Date.now()}-${_eqCounter}-${Math.floor(rng() * 1_000_000)}`,
        rarity: safeRarity,
        slot: assignedSlot,
        name,
        description,
        stats,
        specialOptions,
        enhanceLevel: 0,
        draw: EQUIPMENT_DRAW_KEYS[assignedSlot] ?? assignedSlot
    };
}

export function generateEquipmentFromRarity(rarity, rng = defaultRng) {
    return createEquipmentInstance({ rarity, rng });
}

export function getEquipmentRequiredLevel(itemOrRarity) {
    const rarity = typeof itemOrRarity === "string" ? itemOrRarity : itemOrRarity?.rarity;
    return EQUIPMENT_LEVEL_REQUIREMENTS[rarity] ?? 1;
}

export function getCharacterEquipmentLevel(profile, characterId) {
    if (!characterId) return Infinity;
    const totalXp = Math.max(0, profile?.experience?.byCharacter?.[characterId]?.currentXp ?? 0);
    return getLevelFromXp(totalXp);
}

export function canCharacterEquipItem(profile, itemOrRarity, characterId) {
    return getCharacterEquipmentLevel(profile, characterId) >= getEquipmentRequiredLevel(itemOrRarity);
}

export function getEquippedStatBonuses(profile, characterId = null) {
    const bonuses = { hp: 0, damage: 0, defense: 0, speed: 0 };
    const equipment = profile?.equipment;
    if (!equipment || !Array.isArray(equipment.inventory)) return bonuses;

    const equippedIds = Object.values(equipment.equipped ?? {}).filter(Boolean);
    if (equippedIds.length === 0) return bonuses;

    for (const item of equipment.inventory) {
        if (!equippedIds.includes(item.instanceId)) continue;
        if (!canCharacterEquipItem(profile, item, characterId)) continue;
        if (!Array.isArray(item.stats)) continue;
        const enhanceMult = 1 + (item.enhanceLevel ?? 0) * ENHANCE_STAT_BONUS_PER_LEVEL;
        for (const stat of item.stats) {
            if (stat.type in bonuses) {
                bonuses[stat.type] += Math.round(stat.value * enhanceMult);
            }
        }
    }
    return bonuses;
}

export function getEquippedItems(profile, characterId = null) {
    const equipment = profile?.equipment;
    if (!equipment || !Array.isArray(equipment.inventory)) return [];

    const equippedIds = Object.values(equipment.equipped ?? {}).filter(Boolean);
    if (equippedIds.length === 0) return [];

    return equippedIds
        .map((id) => equipment.inventory.find((item) => item.instanceId === id))
        .filter(Boolean)
        .filter((item) => canCharacterEquipItem(profile, item, characterId))
        .map((item) => ({
            ...item,
            draw: item.draw ?? EQUIPMENT_DRAW_KEYS[item.slot] ?? item.slot
        }));
}

export function applyEquipmentStats(spec, profile) {
    const characterId = spec?.id ?? null;
    const bonuses = getEquippedStatBonuses(profile, characterId);
    const stats = { ...spec.stats };
    for (const [key, value] of Object.entries(bonuses)) {
        if (value !== 0 && key in stats) {
            stats[key] = Number((stats[key] + value).toFixed(3));
        }
    }
    return {
        ...spec,
        stats,
        equipment: {
            ...(spec.equipment ?? {}),
            equippedItems: getEquippedItems(profile, characterId)
        }
    };
}

export function equipEquipmentItem(profile, instanceId, characterId = null) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory)) return null;
    eq.equipped ||= { weapon: null, armor: null, accessory1: null, accessory2: null };
    const item = eq.inventory.find((i) => i.instanceId === instanceId);
    if (!item) return null;
    const characterLevel = getCharacterEquipmentLevel(profile, characterId);
    const requiredLevel = getEquipmentRequiredLevel(item);
    if (characterLevel < requiredLevel) {
        return { error: "level", item, characterLevel, requiredLevel };
    }

    const slot = item.slot;
    if (slot === "accessory") {
        if (!eq.equipped.accessory1) {
            eq.equipped.accessory1 = instanceId;
            return { item, slot: "accessory1" };
        }
        if (!eq.equipped.accessory2) {
            eq.equipped.accessory2 = instanceId;
            return { item, slot: "accessory2" };
        }
        return { error: "slot_full", item };
    }

    eq.equipped[slot] = instanceId;
    return { item, slot };
}

export function getInventorySlots(profile) {
    return Math.max(INVENTORY_DEFAULT_SLOTS, profile?.equipment?.maxInventorySlots ?? INVENTORY_DEFAULT_SLOTS);
}

export function getInventoryUsed(profile) {
    return profile?.equipment?.inventory?.length ?? 0;
}

export function isInventoryFull(profile) {
    return getInventoryUsed(profile) >= getInventorySlots(profile);
}

export function canExpandInventory(profile) {
    if (!profile?.hunting) return false;
    const slots = getInventorySlots(profile);
    if (slots >= INVENTORY_MAX_SLOTS) return false;
    return (profile.hunting.shards ?? 0) >= INVENTORY_EXPAND_COST;
}

export function expandInventory(profile) {
    if (!canExpandInventory(profile)) return false;
    profile.hunting.shards -= INVENTORY_EXPAND_COST;
    profile.equipment.maxInventorySlots += INVENTORY_EXPAND_GAIN;
    return true;
}

export function getDisassembleReward(rarity) {
    return DISASSEMBLE_REWARDS[rarity] ?? 0;
}

export function getSellReward(rarity) {
    return SELL_REWARDS[rarity] ?? 0;
}

export function getFusionCost(rarity) {
    return FUSION_COSTS[rarity] ?? null;
}

export function getNextEquipmentRarity(rarity) {
    const index = EQUIPMENT_RARITIES.indexOf(rarity);
    if (index < 0 || index >= EQUIPMENT_RARITIES.length - 1) return null;
    return EQUIPMENT_RARITIES[index + 1];
}

function findInventoryIndex(eq, instanceId) {
    return eq.inventory.findIndex((i) => i.instanceId === instanceId);
}

function unequipItem(eq, instanceId) {
    const equipped = eq.equipped ?? {};
    for (const [slot, id] of Object.entries(equipped)) {
        if (id === instanceId) {
            equipped[slot] = null;
        }
    }
}

function removeEquipmentItem(eq, instanceId) {
    const index = findInventoryIndex(eq, instanceId);
    if (index < 0) return null;
    const [item] = eq.inventory.splice(index, 1);
    unequipItem(eq, instanceId);
    return item;
}

export function disassembleEquipment(profile, instanceId) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory)) return null;

    const item = removeEquipmentItem(eq, instanceId);
    if (!item) return null;
    const baseStones = getDisassembleReward(item.rarity);
    const enhanceBonus = (item.enhanceLevel ?? 0) * 0.5;
    const totalStones = Math.floor(baseStones * (1 + enhanceBonus));
    eq.enhancementStones = (eq.enhancementStones ?? 0) + totalStones;

    return { item, stones: totalStones };
}

export function sellEquipment(profile, instanceId) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory) || !profile?.hunting) return null;

    const item = removeEquipmentItem(eq, instanceId);
    if (!item) return null;
    const shards = getSellReward(item.rarity);
    profile.hunting.shards = (profile.hunting.shards ?? 0) + shards;

    return { item, shards };
}

export function findFusionPartner(profile, instanceId) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory)) return null;
    const item = eq.inventory.find((i) => i.instanceId === instanceId);
    if (!item || !getNextEquipmentRarity(item.rarity)) return null;
    return (
        eq.inventory.find((candidate) => candidate.instanceId !== instanceId && candidate.rarity === item.rarity) ??
        null
    );
}

export function canFuseEquipment(profile, instanceId) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory) || !profile?.hunting) return false;
    const item = eq.inventory.find((i) => i.instanceId === instanceId);
    const partner = findFusionPartner(profile, instanceId);
    if (!item || !partner) return false;
    const cost = getFusionCost(item.rarity);
    if (!cost) return false;
    if ((eq.enhancementStones ?? 0) < cost.stones) return false;
    return (profile.hunting.shards ?? 0) >= cost.shards;
}

export function fuseEquipment(profile, instanceId, partnerInstanceId = null, rng = defaultRng) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory) || !profile?.hunting) return null;

    const item = eq.inventory.find((i) => i.instanceId === instanceId);
    if (!item) return null;

    const partner = partnerInstanceId
        ? eq.inventory.find((candidate) => candidate.instanceId === partnerInstanceId)
        : findFusionPartner(profile, instanceId);
    if (!partner || partner.instanceId === item.instanceId) return { error: "partner" };
    if (partner.rarity !== item.rarity) return { error: "rarity" };

    const nextRarity = getNextEquipmentRarity(item.rarity);
    if (!nextRarity) return { error: "max_rarity" };

    const cost = getFusionCost(item.rarity);
    if (!cost) return { error: "cost" };
    if ((eq.enhancementStones ?? 0) < cost.stones) return { error: "stones" };
    if ((profile.hunting.shards ?? 0) < cost.shards) return { error: "shards" };

    eq.enhancementStones -= cost.stones;
    profile.hunting.shards -= cost.shards;
    const consumedIds = [item.instanceId, partner.instanceId];
    for (const id of consumedIds) {
        removeEquipmentItem(eq, id);
    }

    const resultItem = createEquipmentInstance({ rarity: nextRarity, rng });
    eq.inventory.push(resultItem);

    return {
        item: resultItem,
        consumed: [item, partner],
        cost,
        fromRarity: item.rarity,
        toRarity: nextRarity
    };
}

export function calculateEnhanceCost(currentLevel) {
    const index = Math.min(currentLevel, ENHANCE_COST_TABLE.length - 1);
    return ENHANCE_COST_TABLE[index];
}

export function calculateEnhanceFailureRate(currentLevel) {
    if (currentLevel >= ENHANCE_MAX_LEVEL) return 1;
    return (ENHANCE_MAX_FAILURE_RATE * (currentLevel + 1)) / ENHANCE_MAX_LEVEL;
}

export function enhanceEquipment(profile, instanceId, rng = defaultRng) {
    const eq = profile?.equipment;
    if (!eq || !Array.isArray(eq.inventory)) return null;

    const item = eq.inventory.find((i) => i.instanceId === instanceId);
    if (!item) return null;

    const currentLevel = item.enhanceLevel ?? 0;
    if (currentLevel >= ENHANCE_MAX_LEVEL) return null;

    const cost = calculateEnhanceCost(currentLevel);
    if ((eq.enhancementStones ?? 0) < cost.stones) return { error: "stones" };
    if ((profile.hunting?.shards ?? 0) < cost.shards) return { error: "shards" };

    // 비용 차감
    eq.enhancementStones -= cost.stones;
    profile.hunting.shards -= cost.shards;

    const failureRate = calculateEnhanceFailureRate(currentLevel);
    const success = rng() >= failureRate;

    if (success) {
        item.enhanceLevel = currentLevel + 1;
    } else {
        // 실패 시 1단계 하락 (0 이하로 안 떨어짐)
        item.enhanceLevel = Math.max(0, currentLevel - 1);
    }

    return {
        success,
        item,
        oldLevel: currentLevel,
        newLevel: item.enhanceLevel,
        cost,
        failureRate
    };
}
