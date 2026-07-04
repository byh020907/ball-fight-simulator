import { HUNTING_CHEST_RARITIES, HUNTING_CHEST_REWARD_TYPES } from "./huntingConfig.js";
import {
    describeHuntingChestRewards,
    getChestOpenCost,
    getHuntingChestRewardTable,
    rollHuntingChestReward
} from "./huntingRewards.js";

export function canOpenHuntingChest(profile, chest) {
    if (!profile?.hunting || !chest) return false;
    return (profile.hunting.keyShards ?? 0) >= getChestOpenCost(chest.rarity);
}

export function previewHuntingChest(chest) {
    const rarity = HUNTING_CHEST_RARITIES.includes(chest?.rarity) ? chest.rarity : "common";
    const cost = getChestOpenCost(rarity);
    return {
        rarity,
        cost,
        rewardText: describeHuntingChestRewards(rarity),
        rewardTable: getHuntingChestRewardTable(rarity)
    };
}

export function applyHuntingChestReward(profile, reward) {
    const applied = {
        keyShards: 0,
        deferredEffects: []
    };

    if (!profile?.hunting || !reward) return applied;

    if (reward.type === HUNTING_CHEST_REWARD_TYPES.KEY_SHARDS) {
        const amount = Math.max(0, Math.floor(reward.amount ?? 0));
        profile.hunting.keyShards = (profile.hunting.keyShards ?? 0) + amount;
        applied.keyShards += amount;
        return applied;
    }

    applied.deferredEffects.push({
        type: reward.type,
        stat: reward.stat ?? null,
        multiplier: reward.multiplier ?? null,
        floors: reward.floors ?? null,
        healRatio: reward.healRatio ?? null,
        text: reward.text
    });
    return applied;
}

export function openHuntingChest(profile, chestId, { rng = Math.random } = {}) {
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

    const reward = rollHuntingChestReward(chest, { rng });
    const applied = applyHuntingChestReward(profile, reward);
    return {
        opened: true,
        chest,
        cost,
        reward,
        applied,
        preview: previewHuntingChest(chest)
    };
}
