import { HUNTING_CHEST_RARITIES } from "./huntingConfig.js";
import { getChestOpenCost } from "./huntingRewards.js";

export function canOpenHuntingChest(profile, chest) {
    if (!profile?.hunting || !chest) return false;
    return (profile.hunting.keyShards ?? 0) >= getChestOpenCost(chest.rarity);
}

export function previewHuntingChest(chest) {
    const rarity = HUNTING_CHEST_RARITIES.includes(chest?.rarity) ? chest.rarity : "common";
    const cost = getChestOpenCost(rarity);
    const rewardBands = {
        common: "소량 XP / 해조각 환급 / 일반 외형",
        uncommon: "중량 XP / 희귀 외형 단서 / 해조각 환급",
        rare: "대량 XP / 설계도 단서 / 고급 외형"
    };
    return {
        rarity,
        cost,
        rewardText: rewardBands[rarity]
    };
}

export function openHuntingChest(profile, chestId) {
    const chests = profile?.hunting?.chests;
    if (!Array.isArray(chests)) {
        return { opened: false, reason: "missing_storage" };
    }

    const index = chests.findIndex((chest) => chest.id === chestId);
    if (index < 0) {
        return { opened: false, reason: "not_found" };
    }

    const chest = chests[index];
    const cost = getChestOpenCost(chest.rarity);
    if ((profile.hunting.keyShards ?? 0) < cost) {
        return { opened: false, reason: "not_enough_key_shards", cost };
    }

    profile.hunting.keyShards -= cost;
    profile.hunting.chests = chests.filter((item) => item.id !== chestId);
    return {
        opened: true,
        chest,
        cost,
        reward: previewHuntingChest(chest)
    };
}
