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

function getSafeRarity(reward) {
    return reward?.rarity ?? "common";
}

const rewardHandlers = Object.freeze({
    [ACHIEVEMENT_REWARD_TYPES.SHARDS](profile, reward) {
        const amount = getSafeAmount(reward.amount);
        profile.hunting.shards = (profile.hunting.shards ?? 0) + amount;
        return { applied: amount > 0, type: reward.type, shards: amount };
    },
    [ACHIEVEMENT_REWARD_TYPES.CHEST](profile, reward) {
        const chest = createHuntingChest({ rarity: getSafeRarity(reward) });
        profile.hunting.chests.push(chest);
        return { applied: true, type: reward.type, chest };
    },
    [ACHIEVEMENT_REWARD_TYPES.EQUIPMENT](profile, reward, rng) {
        const rarity = getSafeRarity(reward);
        if (isInventoryFull(profile)) {
            const chest = createHuntingChest({ rarity });
            profile.hunting.chests.push(chest);
            return { applied: true, type: reward.type, chest, convertedToChest: true };
        }
        const equipment = generateEquipmentFromRarity(rarity, rng);
        profile.equipment.inventory.push(equipment);
        return { applied: true, type: reward.type, equipment };
    },
    [ACHIEVEMENT_REWARD_TYPES.FEATURE_UNLOCK](profile, reward) {
        return {
            applied: Boolean(reward.payload?.feature),
            type: reward.type,
            feature: reward.payload?.feature ?? null
        };
    }
});

export function grantAchievementReward(profile, reward, { rng = Math.random } = {}) {
    if (!profile?.hunting || !profile?.equipment || !reward?.type)
        return { applied: false, type: reward?.type ?? null };
    const handler = rewardHandlers[reward.type];
    return handler ? handler(profile, reward, rng) : { applied: false, type: reward.type };
}

export function formatAchievementReward(reward) {
    if (!reward) return "";
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.SHARDS) return `파편 +${getSafeAmount(reward.amount)}`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.CHEST) return `${getSafeRarity(reward)} 상자`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.EQUIPMENT) return `${getSafeRarity(reward)} 확정 장비`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.FEATURE_UNLOCK) return reward.payload?.description ?? "";
    return "";
}
