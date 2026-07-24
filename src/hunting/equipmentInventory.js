import { EQUIPMENT_MAX_STACK, EQUIPMENT_TEMPLATES, getEquipmentTemplate } from "./equipmentTemplates.js";

export const EQUIPMENT_SLOT_COUNT = 6;

export function createDefaultEquipmentInventory() {
    return { inventory: {}, equipped: Array(EQUIPMENT_SLOT_COUNT).fill(null) };
}

function getInventory(profile) {
    return profile?.equipment?.inventory &&
        typeof profile.equipment.inventory === "object" &&
        !Array.isArray(profile.equipment.inventory)
        ? profile.equipment.inventory
        : null;
}

function getEquipped(profile) {
    return Array.isArray(profile?.equipment?.equipped) ? profile.equipment.equipped : null;
}

export function sanitizeEquipmentInventory(value) {
    const inventory = {};
    for (const [templateId, rawCount] of Object.entries(value?.inventory ?? {})) {
        const count = Math.floor(Number(rawCount) || 0);
        if (getEquipmentTemplate(templateId) && count > 0) inventory[templateId] = Math.min(EQUIPMENT_MAX_STACK, count);
    }
    const equipped = Array.from({ length: EQUIPMENT_SLOT_COUNT }, (_, index) => {
        const templateId = value?.equipped?.[index];
        return getEquipmentTemplate(templateId) && (inventory[templateId] ?? 0) > 0 ? templateId : null;
    });
    for (const templateId of equipped) {
        if (!templateId || getEquipmentTemplate(templateId)?.tier !== "completed") continue;
        const firstIndex = equipped.indexOf(templateId);
        equipped.forEach((id, index) => {
            if (id === templateId && index !== firstIndex) equipped[index] = null;
        });
    }
    return { inventory, equipped };
}

export function getEquipmentCount(profile, templateId) {
    return getInventory(profile)?.[templateId] ?? 0;
}

export function addEquipmentQuantity(profile, templateId, amount = 1) {
    const inventory = getInventory(profile);
    if (!inventory || !getEquipmentTemplate(templateId)) return { ok: false, reason: "template" };
    const current = getEquipmentCount(profile, templateId);
    const next = Math.min(EQUIPMENT_MAX_STACK, current + Math.max(0, Math.floor(amount)));
    if (next === current) return { ok: false, reason: "capacity" };
    inventory[templateId] = next;
    return { ok: true, templateId, count: next, added: next - current };
}

export function removeEquipmentQuantity(profile, templateId, amount = 1) {
    const inventory = getInventory(profile);
    const removed = Math.max(0, Math.floor(amount));
    if (!inventory || getEquipmentCount(profile, templateId) < removed || removed === 0)
        return { ok: false, reason: "quantity" };
    const next = inventory[templateId] - removed;
    if (next > 0) inventory[templateId] = next;
    else delete inventory[templateId];
    const equipped = getEquipped(profile);
    if (equipped) {
        const equippedCount = equipped.filter((id) => id === templateId).length;
        for (let index = 0; index < Math.max(0, equippedCount - next); index += 1) {
            const slot = equipped.lastIndexOf(templateId);
            if (slot >= 0) equipped[slot] = null;
        }
    }
    return { ok: true, templateId, count: next, removed };
}

export function canEquipEquipmentTemplate(profile, templateId, slotIndex = null) {
    const template = getEquipmentTemplate(templateId);
    const equipped = getEquipped(profile);
    if (!template || !equipped || getEquipmentCount(profile, templateId) <= 0) return { ok: false, reason: "template" };
    if (slotIndex !== null && (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= EQUIPMENT_SLOT_COUNT))
        return { ok: false, reason: "slot" };
    if (template.tier === "completed" && equipped.includes(templateId))
        return { ok: false, reason: "completed_duplicate" };
    if (equipped.filter((id) => id === templateId).length >= getEquipmentCount(profile, templateId))
        return { ok: false, reason: "quantity" };
    return { ok: true };
}

export function equipEquipmentTemplate(profile, templateId, slotIndex = null) {
    const equipped = getEquipped(profile);
    const target = slotIndex ?? equipped?.findIndex((id) => id === null);
    const validation = canEquipEquipmentTemplate(profile, templateId, target);
    if (!validation.ok) return validation;
    if (equipped[target] !== null) return { ok: false, reason: "occupied" };
    equipped[target] = templateId;
    return { ok: true, templateId, slotIndex: target };
}

export function unequipEquipmentTemplate(profile, slotIndex) {
    const equipped = getEquipped(profile);
    if (!equipped || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= EQUIPMENT_SLOT_COUNT)
        return { ok: false, reason: "slot" };
    const templateId = equipped[slotIndex];
    if (!templateId) return { ok: false, reason: "empty" };
    equipped[slotIndex] = null;
    return { ok: true, templateId, slotIndex };
}

export function getEquipmentRecipePreview(profile, templateId) {
    const template = getEquipmentTemplate(templateId);
    if (!template || template.recipe.length === 0) return null;
    const required = template.recipe.reduce((counts, ingredientId) => {
        counts[ingredientId] = (counts[ingredientId] ?? 0) + 1;
        return counts;
    }, {});
    const ingredients = Object.entries(required).map(([ingredientId, requiredCount]) => ({
        template: getEquipmentTemplate(ingredientId),
        requiredCount,
        ownedCount: getEquipmentCount(profile, ingredientId),
        missingCount: Math.max(0, requiredCount - getEquipmentCount(profile, ingredientId))
    }));
    const shards = Math.floor(Number(profile?.hunting?.shards) || 0);
    return {
        template,
        ingredients,
        combineCost: template.combineCost,
        shards,
        missingShards: Math.max(0, template.combineCost - shards),
        canCraft: ingredients.every((ingredient) => ingredient.missingCount === 0) && shards >= template.combineCost
    };
}

export function craftEquipmentTemplate(profile, templateId) {
    const preview = getEquipmentRecipePreview(profile, templateId);
    if (!preview) return { ok: false, reason: "recipe" };
    if (!preview.canCraft) return { ok: false, reason: "requirements", preview };
    if (getEquipmentCount(profile, templateId) >= EQUIPMENT_MAX_STACK)
        return { ok: false, reason: "capacity", preview };
    for (const ingredient of preview.ingredients)
        removeEquipmentQuantity(profile, ingredient.template.id, ingredient.requiredCount);
    profile.hunting.shards -= preview.combineCost;
    const result = addEquipmentQuantity(profile, templateId);
    return { ok: true, template: preview.template, combineCost: preview.combineCost, result };
}

export function sortEquipmentInventory(profile) {
    const inventory = getInventory(profile);
    if (!inventory) return [];
    const order = new Map(EQUIPMENT_TEMPLATES.map((template, index) => [template.id, index]));
    const entries = Object.entries(inventory).sort(([left], [right]) => order.get(left) - order.get(right));
    for (const key of Object.keys(inventory)) delete inventory[key];
    for (const [templateId, count] of entries) inventory[templateId] = count;
    return entries.map(([templateId, count]) => ({ template: getEquipmentTemplate(templateId), count }));
}

export function getEquippedEquipmentTemplates(profile) {
    return (getEquipped(profile) ?? []).map((templateId) => getEquipmentTemplate(templateId)).filter(Boolean);
}

export function getEquippedEquipmentTemplateIds(profile) {
    return Array.from({ length: EQUIPMENT_SLOT_COUNT }, (_, slotIndex) => {
        const templateId = getEquipped(profile)?.[slotIndex];
        return getEquipmentTemplate(templateId) ? templateId : null;
    });
}

export function getEquippedEquipmentStats(profile) {
    return getEquippedEquipmentTemplates(profile).reduce((stats, template) => {
        for (const [stat, value] of Object.entries(template.stats)) stats[stat] = (stats[stat] ?? 0) + value;
        return stats;
    }, {});
}
