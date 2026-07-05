import { EQUIPMENT } from "./equipmentData.js";

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

    return {
        instanceId: `eq-${Date.now()}-${Math.floor(rng() * 1_000_000)}`,
        rarity: safeRarity,
        slot: assignedSlot,
        name,
        description,
        stats,
        specialOptions,
        enhanceLevel: 0
    };
}

export function generateEquipmentFromRarity(rarity, rng = defaultRng) {
    return createEquipmentInstance({ rarity, rng });
}

export function getEquippedStatBonuses(profile) {
    const bonuses = { hp: 0, damage: 0, defense: 0, speed: 0 };
    const equipment = profile?.equipment;
    if (!equipment || !Array.isArray(equipment.inventory)) return bonuses;

    const equippedIds = Object.values(equipment.equipped ?? {}).filter(Boolean);
    if (equippedIds.length === 0) return bonuses;

    for (const item of equipment.inventory) {
        if (!equippedIds.includes(item.instanceId)) continue;
        if (!Array.isArray(item.stats)) continue;
        for (const stat of item.stats) {
            if (stat.type in bonuses) {
                bonuses[stat.type] += stat.value;
            }
        }
    }
    return bonuses;
}

export function applyEquipmentStats(spec, profile) {
    const bonuses = getEquippedStatBonuses(profile);
    const stats = { ...spec.stats };
    for (const [key, value] of Object.entries(bonuses)) {
        if (value !== 0 && key in stats) {
            stats[key] = Number((stats[key] + value).toFixed(3));
        }
    }
    return { ...spec, stats };
}
