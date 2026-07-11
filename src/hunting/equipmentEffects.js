import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const EQUIPMENT_EFFECT_CONFIG = REWARD_BALANCE.equipment;

export function getHighestEquipmentSpecialValue(items = [], type) {
    let highest = 0;
    for (const item of items) {
        for (const option of item?.specialOptions ?? []) {
            if (option?.type !== type || !Number.isFinite(option.value)) continue;
            highest = Math.max(highest, option.value);
        }
    }
    return highest;
}

export function createEquipmentCombatEffects(items = []) {
    const crashDamagePercent = getHighestEquipmentSpecialValue(items, "crashDamage");
    const cooldownPercent = getHighestEquipmentSpecialValue(items, "cooldown");
    const hpStealPercent = getHighestEquipmentSpecialValue(items, "hpSteal");
    const massPercent = getHighestEquipmentSpecialValue(items, "mass");
    const wallBouncePercent = getHighestEquipmentSpecialValue(items, "wallBounce");
    const angularImpulsePercent = getHighestEquipmentSpecialValue(items, "angularImpulse");

    return Object.freeze({
        crashDamageMultiplier: 1 + crashDamagePercent / 100,
        abilityCooldownMultiplier: Math.max(0.1, 1 - cooldownPercent / 100),
        hpStealRatio: hpStealPercent / 100,
        hpStealCooldown: EQUIPMENT_EFFECT_CONFIG.hpStealCooldown,
        massMultiplier: 1 + massPercent / 100,
        wallBounceMultiplier: 1 + wallBouncePercent / 100,
        collisionAngularMultiplier: 1 + angularImpulsePercent / 100
    });
}
