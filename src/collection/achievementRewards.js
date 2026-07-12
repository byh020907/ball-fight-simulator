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

function grantShards(profile, reward) {
    const amount = getSafeAmount(reward.amount);
    profile.hunting.shards = (profile.hunting.shards ?? 0) + amount;
    return { applied: amount > 0, type: reward.type, shards: amount };
}

function grantChest(profile, reward) {
    const chest = createHuntingChest({ rarity: getSafeRarity(reward) });
    profile.hunting.chests.push(chest);
    return { applied: true, type: reward.type, chest };
}

function grantEquipment(profile, reward, rng) {
    const rarity = getSafeRarity(reward);
    if (isInventoryFull(profile)) {
        const chest = createHuntingChest({ rarity });
        profile.hunting.chests.push(chest);
        return { applied: true, type: reward.type, chest, convertedToChest: true };
    }
    const equipment = generateEquipmentFromRarity(rarity, rng);
    profile.equipment.inventory.push(equipment);
    return { applied: true, type: reward.type, equipment };
}

function unlockFeature(profile, reward) {
    return { applied: Boolean(reward.payload?.feature), type: reward.type, feature: reward.payload?.feature ?? null };
}

export const ACHIEVEMENT_REWARD_HANDLERS = Object.freeze({
    first_tournament_win: { grant: grantShards },
    flawless_tournament: { grant: grantEquipment },
    comeback_match_win: { grant: grantChest },
    counter_expert: { grant: grantChest },
    all_actions_used: { grant: grantChest },
    roster_champion: { grant: grantEquipment },
    mastery_complete: { grant: grantEquipment },
    marathon_50: { grant: grantChest },
    single_hit_monster: { grant: grantEquipment },
    tournament_streak_3: { grant: grantChest },
    speed_2x: { grant: unlockFeature },
    speed_4x: { grant: unlockFeature }
});

export function grantAchievementReward(profile, achievement, { rng = Math.random } = {}) {
    const handler = ACHIEVEMENT_REWARD_HANDLERS[achievement?.id];
    const reward = achievement?.reward;
    if (!profile?.hunting || !profile?.equipment || !reward?.type || !handler) {
        return { applied: false, type: reward?.type ?? null };
    }
    return handler.grant(profile, reward, rng);
}

export function formatAchievementReward(reward) {
    if (!reward) return "";
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.SHARDS) return `파편 +${getSafeAmount(reward.amount)}`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.CHEST) return `${getSafeRarity(reward)} 상자`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.EQUIPMENT) return `${getSafeRarity(reward)} 확정 장비`;
    if (reward.type === ACHIEVEMENT_REWARD_TYPES.FEATURE_UNLOCK) return reward.payload?.description ?? "";
    return "";
}
