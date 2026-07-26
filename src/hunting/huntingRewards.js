import { HUNTING_DEFEAT_PRESERVE } from "./huntingConfig.js";
import {
    EQUIPMENT_RARITIES,
    EQUIPMENT_SPECIAL_OPTION_SUFFIXES,
    getEquipmentMaxEnhanceLevel,
    STAT_TYPES
} from "./equipmentConfig.js";
import { formatEquipmentSpecialName } from "./equipmentNaming.js";
import { getEquipmentTemplate } from "./equipmentTemplates.js";

const DEFAULT_RNG = () => Math.random();

function sanitizeNumber(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
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
        equipment: sanitizeEquipmentMap(loot?.equipment)
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
        equipment: mergedEquipment
    };
}

export function applyDefeatPreservation(pendingLoot = createEmptyHuntingLoot(), rng = DEFAULT_RNG) {
    const normalizedLoot = normalizeHuntingLoot(pendingLoot);
    return {
        preservedLoot: {
            shards: Math.floor(normalizedLoot.shards * HUNTING_DEFEAT_PRESERVE.SHARDS),
            equipment: { ...normalizedLoot.equipment }
        },
        lostLoot: {
            shards: Math.ceil(normalizedLoot.shards * (1 - HUNTING_DEFEAT_PRESERVE.SHARDS)),
            equipment: {}
        }
    };
}
