import { HUNTING_CHEST_RARITIES, HUNTING_CHEST_REWARD_TYPES } from "./huntingConfig.js";
import {
    describeHuntingChestRewards,
    getChestOpenCost,
    getHuntingChestRewardTable,
    rollHuntingChestReward
} from "./huntingRewards.js";

export function canOpenHuntingChest(profile, chest) {
    if (!profile?.hunting || !chest) return false;
    return (profile.hunting.shards ?? 0) >= getChestOpenCost(chest.rarity);
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
        shards: 0,
        deferredEffect: null
    };

    if (!profile?.hunting || !reward) return applied;

    if (reward.type === HUNTING_CHEST_REWARD_TYPES.SHARDS) {
        const amount = Math.max(0, Math.floor(reward.amount ?? 0));
        profile.hunting.shards = (profile.hunting.shards ?? 0) + amount;
        applied.shards += amount;
        return applied;
    }

    const effect = {
        type: reward.type,
        stat: reward.stat ?? null,
        multiplier: reward.multiplier ?? null,
        floors: reward.floors ?? null,
        healRatio: reward.healRatio ?? null,
        text: reward.text,
        active: true
    };
    if (!Array.isArray(profile.hunting.deferredEffects)) {
        profile.hunting.deferredEffects = [];
    }
    profile.hunting.deferredEffects.push(effect);
    applied.deferredEffect = effect;
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
    if ((profile.hunting.shards ?? 0) < cost) {
        return { opened: false, reason: "not_enough_shards", cost };
    }

    profile.hunting.shards -= cost;
    profile.hunting.chests = chests.filter((item) => item.id !== chestId);

    const reward = rollHuntingChestReward(chest, { rng });
    const applied = applyHuntingChestReward(profile, reward);
    return {
        opened: true,
        chest,
        cost,
        reward,
        applied,
        preview: previewHuntingChest(chest),
        currentShards: profile.hunting.shards
    };
}
