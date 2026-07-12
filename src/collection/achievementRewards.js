import { createHuntingChest } from "../hunting/huntingRewards.js";
import { generateEquipmentFromRarity, isInventoryFull } from "../hunting/equipmentConfig.js";

export const ACHIEVEMENT_REWARD_TYPES = Object.freeze({
    SHARDS: "SHARDS",
    CHEST: "CHEST",
    EQUIPMENT: "EQUIPMENT",
    FEATURE_UNLOCK: "FEATURE_UNLOCK"
});

function getSafeAmount(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}

export class AchievementRewardHandler {
    constructor(profile, { rng = Math.random } = {}) {
        this.profile = profile;
        this.rng = rng;
    }

    shards(amount) {
        const granted = getSafeAmount(amount);
        this.profile.hunting.shards = (this.profile.hunting.shards ?? 0) + granted;
        return { applied: granted > 0, type: ACHIEVEMENT_REWARD_TYPES.SHARDS, shards: granted };
    }

    chest(rarity = "common") {
        const chest = createHuntingChest({ rarity });
        this.profile.hunting.chests.push(chest);
        return { applied: true, type: ACHIEVEMENT_REWARD_TYPES.CHEST, chest };
    }

    equipment(rarity = "common") {
        if (isInventoryFull(this.profile)) {
            const deferred = this.chest(rarity);
            return { ...deferred, type: ACHIEVEMENT_REWARD_TYPES.EQUIPMENT, convertedToChest: true };
        }
        const equipment = generateEquipmentFromRarity(rarity, this.rng);
        this.profile.equipment.inventory.push(equipment);
        return { applied: true, type: ACHIEVEMENT_REWARD_TYPES.EQUIPMENT, equipment };
    }

    unlockFeature(feature) {
        return { applied: Boolean(feature), type: ACHIEVEMENT_REWARD_TYPES.FEATURE_UNLOCK, feature: feature ?? null };
    }
}

export function grantAchievementReward(profile, achievement, options) {
    if (!profile?.hunting || !profile?.equipment || typeof achievement?.grant !== "function") {
        return { applied: false, type: null };
    }
    return achievement.grant(new AchievementRewardHandler(profile, options));
}

export function formatAchievementReward(reward) {
    if (!reward) return "";
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.SHARDS) return `파편 +${getSafeAmount(reward.amount)}`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.CHEST) return `${reward.rarity ?? "common"} 상자`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.EQUIPMENT) return `${reward.rarity ?? "common"} 확정 장비`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.FEATURE_UNLOCK) return reward.payload?.description ?? "";
    return "";
}
