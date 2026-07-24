import { addEquipmentQuantity, equipEquipmentTemplate } from "./equipmentInventory.js";
import { getEquipmentTemplate } from "./equipmentTemplates.js";

const STAT_TEMPLATE_IDS = Object.freeze({
    hp: "health_crystal",
    damage: "attack_sword",
    defense: "defense_leather",
    speed: "speed_boots",
    skill: "haste_mote",
    criticalChance: "crit_cloak",
    mass: "mass_weight",
    wallBounce: "wall_spring",
    angularImpulse: "collision_gyro"
});

export function getLegacyRewardTemplateId(legacyEquipment) {
    const stat = legacyEquipment?.stats?.[0]?.type ?? "damage";
    return STAT_TEMPLATE_IDS[stat] ?? "attack_sword";
}

export function grantLegacyEquipmentReward(profile, legacyEquipment, characterId = null) {
    const templateId = getLegacyRewardTemplateId(legacyEquipment);
    const added = addEquipmentQuantity(profile, templateId);
    const autoEquip = added.ok ? equipEquipmentTemplate(profile, templateId) : { ok: false, reason: added.reason };
    return {
        templateId,
        count: added.count ?? 0,
        added: added.ok,
        autoEquip,
        characterId
    };
}

export function isQuantityEquipmentInventory(profile) {
    return Boolean(profile?.equipment?.inventory) && !Array.isArray(profile.equipment.inventory);
}

export function presentEquipmentTemplate(templateId) {
    const template = getEquipmentTemplate(templateId);
    if (!template) return null;
    return {
        instanceId: template.id,
        id: template.id,
        name: template.name,
        iconTag: template.iconTag,
        rarity: template.tier,
        tier: template.tier,
        slot: null,
        description: "고정 성능 조합 장비",
        stats: Object.entries(template.stats).map(([type, value]) => ({ type, value })),
        specialOptions: [],
        enhanceLevel: 0,
        passiveId: template.passiveId
    };
}
