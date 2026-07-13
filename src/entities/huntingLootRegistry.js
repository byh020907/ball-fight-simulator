import { ChestDrop } from "./chestDrop.js";
import { ShardDrop } from "./shardDrop.js";
import { SmallHealPack } from "./smallHealPack.js";

const HUNTING_LOOT_ITEM_CLASSES = Object.freeze({
    [SmallHealPack.lootType]: SmallHealPack,
    [ShardDrop.lootType]: ShardDrop,
    [ChestDrop.lootType]: ChestDrop
});

export function createHuntingLootItem(type, options) {
    const LootItemClass = HUNTING_LOOT_ITEM_CLASSES[type];
    if (!LootItemClass) throw new Error(`Unsupported hunting loot item type: ${type}`);
    return new LootItemClass(options);
}

export function getHuntingLootItemClass(type) {
    return HUNTING_LOOT_ITEM_CLASSES[type] ?? null;
}
