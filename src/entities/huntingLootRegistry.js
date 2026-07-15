import { ChestDrop } from "./chestDrop.js";
import { EnhancementStoneDrop } from "./enhancementStoneDrop.js";
import { ExperienceDrop } from "./experienceDrop.js";
import { ShardDrop } from "./shardDrop.js";
import { ShardBundleDrop } from "./shardBundleDrop.js";
import { SmallHealPack } from "./smallHealPack.js";

const HUNTING_LOOT_ITEM_CLASSES = Object.freeze({
    [SmallHealPack.lootType]: SmallHealPack,
    [ShardDrop.lootType]: ShardDrop,
    [ShardBundleDrop.lootType]: ShardBundleDrop,
    [ChestDrop.lootType]: ChestDrop,
    [ChestDrop.highLootType]: ChestDrop,
    [ExperienceDrop.lootType]: ExperienceDrop,
    [EnhancementStoneDrop.lootType]: EnhancementStoneDrop
});

export function createHuntingLootItem(type, options) {
    const LootItemClass = HUNTING_LOOT_ITEM_CLASSES[type];
    if (!LootItemClass) throw new Error(`Unsupported hunting loot item type: ${type}`);
    return new LootItemClass(options);
}

export function getHuntingLootItemClass(type) {
    return HUNTING_LOOT_ITEM_CLASSES[type] ?? null;
}
