import { HUNTING_CHEST_RARITIES, HUNTING_CHEST_REWARD_TYPES } from "./huntingConfig.js";
import {
    describeHuntingChestRewards,
    getChestOpenCost,
    getHuntingChestRewardTable,
    rollHuntingChestReward
} from "./huntingRewards.js";
import {
    autoEquipEquipmentUpgrade,
    generateEquipmentFromRarity,
    isInventoryFull,
    getInventorySlots,
    getInventoryUsed
} from "./equipmentConfig.js";

export function canOpenHuntingChest(profile, chest) {
    if (!profile?.hunting || !chest) return false;
    return (profile.hunting.shards ?? 0) >= getChestOpenCostForChest(chest);
}

function getChestOpenCostForChest(chest) {
    return Number.isFinite(chest?.openCost) && chest.openCost >= 0 ? chest.openCost : getChestOpenCost(chest?.rarity);
}

export function previewHuntingChest(chest) {
    const rarity = HUNTING_CHEST_RARITIES.includes(chest?.rarity) ? chest.rarity : "common";
    const cost = getChestOpenCostForChest(chest);
    const guaranteedEquipment = chest?.guaranteedEquipment ?? null;
    return {
        rarity,
        cost,
        rewardText: guaranteedEquipment?.name ?? describeHuntingChestRewards(rarity),
        rewardTable: guaranteedEquipment
            ? [
                  {
                      type: HUNTING_CHEST_REWARD_TYPES.EQUIPMENT,
                      equipment: guaranteedEquipment,
                      text: guaranteedEquipment.name
                  }
              ]
            : getHuntingChestRewardTable(rarity)
    };
}

export function applyHuntingChestReward(profile, reward, { rng = Math.random, characterId = null } = {}) {
    const applied = { shards: 0, equipment: null, autoEquip: null };

    if (!profile?.hunting || !reward) return applied;

    if (reward.type === HUNTING_CHEST_REWARD_TYPES.SHARDS) {
        const amount = Math.max(0, Math.floor(reward.amount ?? 0));
        profile.hunting.shards = (profile.hunting.shards ?? 0) + amount;
        applied.shards = amount;
        return applied;
    }

    if (reward.type === HUNTING_CHEST_REWARD_TYPES.EQUIPMENT) {
        if (!Array.isArray(profile.equipment?.inventory)) {
            profile.equipment = profile.equipment || {};
            profile.equipment.inventory = [];
        }
        const equipment = reward.equipment ?? generateEquipmentFromRarity(reward.rarity ?? "common", rng);
        profile.equipment.inventory.push(equipment);
        applied.equipment = equipment;
        applied.autoEquip = autoEquipEquipmentUpgrade(profile, equipment.instanceId, characterId);
        return applied;
    }

    return applied;
}

export function openHuntingChest(profile, chestId, { rng = Math.random, characterId = null } = {}) {
    const chests = profile?.hunting?.chests;
    if (!Array.isArray(chests)) {
        return { opened: false, reason: "missing_storage" };
    }

    const index = chests.findIndex((chest) => chest.id === chestId);
    if (index < 0) {
        return { opened: false, reason: "not_found" };
    }

    const chest = chests[index];
    const cost = getChestOpenCostForChest(chest);
    if ((profile.hunting.shards ?? 0) < cost) {
        return { opened: false, reason: "not_enough_shards", cost };
    }

    // 용량 확인: 장비 보상이 나올 수 있는데 인벤토리가 가득 찼으면 차단
    const inventoryFull = isInventoryFull(profile);
    if (inventoryFull) {
        return { opened: false, reason: "inventory_full" };
    }

    profile.hunting.shards -= cost;
    profile.hunting.chests = chests.filter((item) => item.id !== chestId);

    const reward = chest.guaranteedEquipment
        ? { type: HUNTING_CHEST_REWARD_TYPES.EQUIPMENT, equipment: chest.guaranteedEquipment, rarity: chest.rarity }
        : rollHuntingChestReward(chest, { rng });
    if (reward.type === HUNTING_CHEST_REWARD_TYPES.EQUIPMENT) {
        reward.rarity = chest.rarity;
    }
    const applied = applyHuntingChestReward(profile, reward, { rng, characterId });
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
