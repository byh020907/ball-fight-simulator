import { REWARD_BALANCE } from "./rewardBalanceConfig.js";

const DEFENSE_BALANCE = REWARD_BALANCE.combat.defense;

export const DEFENSE_RATING_SCALE = DEFENSE_BALANCE.ratingScale;
export const MINIMUM_DEFENDED_DAMAGE = DEFENSE_BALANCE.minimumDamage;

export function getDefenseDamageMultiplier(defenseRating) {
    const defense = Math.max(0, Number(defenseRating) || 0);
    return DEFENSE_RATING_SCALE / (DEFENSE_RATING_SCALE + defense);
}

export function applyDefenseToDamage(amount, defenseRating, { minimumDamage = MINIMUM_DEFENDED_DAMAGE } = {}) {
    const damage = Math.max(0, Number(amount) || 0);
    return Math.max(minimumDamage, Math.round(damage * getDefenseDamageMultiplier(defenseRating)));
}

export function getDiminishingEquipmentSpeed(baseSpeed, equipmentSpeedBonus, maximumBaseMultiplier) {
    const base = Math.max(0, Number(baseSpeed) || 0);
    const bonus = Math.max(0, Number(equipmentSpeedBonus) || 0);
    const maximumBonus = base * Math.max(0, (Number(maximumBaseMultiplier) || 1) - 1);
    if (base <= 0 || bonus <= 0 || maximumBonus <= 0) return base;
    return base + (maximumBonus * bonus) / (maximumBonus + bonus);
}
