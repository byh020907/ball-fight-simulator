import { Vector2 } from "../core.js";
import { createHuntingLootItem } from "../entities/huntingLootRegistry.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createEmptyHuntingLoot, createHuntingChest } from "./huntingRewards.js";

export const HUNTING_LOOT_ITEM_TYPES = Object.freeze({
    SMALL_HEAL_PACK: "small_heal_pack",
    SHARD: "shard",
    SHARD_BUNDLE: "shard_bundle",
    CHEST: "chest",
    HIGH_CHEST: "high_chest"
});

export const HUNTING_LOOT_RARITIES = Object.freeze(["common", "rare", "unique", "epic"]);

const LOOT_CONFIG = REWARD_BALANCE.hunting.loot;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getMissingHpRatio(collector) {
    if (!Number.isFinite(collector?.maxHp) || collector.maxHp <= 0) return 0;
    return clamp((collector.maxHp - collector.hp) / collector.maxHp, 0, 1);
}

function rollWeightedEntries(entries, rng) {
    const totalWeight = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
    if (totalWeight <= 0) return null;
    let roll = clamp(rng(), 0, 0.999999) * totalWeight;
    for (const [type, weight] of entries) {
        roll -= Math.max(0, weight);
        if (roll < 0) return type;
    }
    return entries.at(-1)?.[0] ?? null;
}

function rollWeightedType(weights, rng) {
    return rollWeightedEntries(Object.entries(weights), rng);
}

function getLootRarity(fighter) {
    const rarityTag = fighter?.hunting?.monsterTags?.find((tag) => tag.startsWith("rarity:"));
    const rarity = rarityTag?.slice("rarity:".length);
    return HUNTING_LOOT_RARITIES.includes(rarity) ? rarity : "common";
}

export function roundHuntingLootValue(value) {
    const step = LOOT_CONFIG.valueStep;
    return Math.max(step, Math.round(value / step) * step);
}

export function getHuntingLootDropChance(collector) {
    const missingHpRatio = getMissingHpRatio(collector);
    const multiplier = 1 + missingHpRatio * (LOOT_CONFIG.missingHpMaxMultiplier - 1);
    return clamp(LOOT_CONFIG.baseDropChance * multiplier, 0, 1);
}

export function getSmallHealPackAmount(collector) {
    const missingHp = Math.max(0, (collector?.maxHp ?? 0) - (collector?.hp ?? 0));
    if (missingHp <= 0) return 0;
    return Math.min(missingHp, roundHuntingLootValue(missingHp * LOOT_CONFIG.smallHealPack.missingHpRecoveryRatio));
}

export function getHuntingShardDropAmount(floor = 1) {
    const safeFloor = Math.max(1, Math.floor(floor) || 1);
    const steps = Math.floor((safeFloor - 1) / LOOT_CONFIG.shard.floorStep);
    const amount = LOOT_CONFIG.shard.baseAmount + steps * LOOT_CONFIG.valueStep;
    return Math.min(LOOT_CONFIG.shard.maximumAmount, roundHuntingLootValue(amount));
}

export function getHuntingLootWeights({ collector, rarity = "common" } = {}) {
    const missingHpRatio = getMissingHpRatio(collector);
    const normalWeights = LOOT_CONFIG.normalWeights;
    const healWeight =
        normalWeights.small_heal_pack.minimum +
        (normalWeights.small_heal_pack.maximum - normalWeights.small_heal_pack.minimum) * missingHpRatio;
    const chestWeight = normalWeights.chest;
    const shardWeight = 100 - healWeight - chestWeight;
    const rewardWeights = LOOT_CONFIG.rarityRewards[rarity] ?? LOOT_CONFIG.rarityRewards.common;
    const remainingWeight = 100 - rewardWeights.shard_bundle - rewardWeights.high_chest;
    return {
        [HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK]: (healWeight * remainingWeight) / 100,
        [HUNTING_LOOT_ITEM_TYPES.SHARD]: (shardWeight * remainingWeight) / 100,
        [HUNTING_LOOT_ITEM_TYPES.CHEST]: (chestWeight * remainingWeight) / 100,
        [HUNTING_LOOT_ITEM_TYPES.SHARD_BUNDLE]: rewardWeights.shard_bundle,
        [HUNTING_LOOT_ITEM_TYPES.HIGH_CHEST]: rewardWeights.high_chest
    };
}

export function rollHuntingShardBundleAmount({ floor = 1, rarity = "rare", rng = Math.random } = {}) {
    const multipliers = LOOT_CONFIG.shardBundle.multipliers[rarity] ?? LOOT_CONFIG.shardBundle.multipliers.rare;
    const multiplier = rollWeightedEntries(
        multipliers.map(({ value, weight }) => [value, weight]),
        rng
    );
    return roundHuntingLootValue(getHuntingShardDropAmount(floor) * Number(multiplier));
}

export function rollHighChestRarity({ rarity = "rare", rng = Math.random } = {}) {
    const rarities = LOOT_CONFIG.highChest.rarities[rarity] ?? LOOT_CONFIG.highChest.rarities.rare;
    return rollWeightedEntries(
        rarities.map(({ rarity: chestRarity, weight }) => [chestRarity, weight]),
        rng
    );
}

export function rollHuntingLootItemType({ collector, rarity = "common", rng = Math.random } = {}) {
    if (!collector || rng() >= getHuntingLootDropChance(collector)) return null;
    return rollWeightedType(getHuntingLootWeights({ collector, rarity }), rng);
}

export class HuntingBattleLootSession {
    constructor({ playerId, floor }) {
        this.playerId = playerId;
        this.floor = floor;
        this._collectedLoot = createEmptyHuntingLoot();
    }

    recordCollection(reward) {
        if (!reward) return this.getCollectedLoot();
        if (reward.type === HUNTING_LOOT_ITEM_TYPES.SHARD) {
            this._collectedLoot.shards += Math.max(0, Math.round(reward.amount ?? 0));
        }
        if (reward.type === HUNTING_LOOT_ITEM_TYPES.CHEST && reward.chest) {
            this._collectedLoot.chests.push(reward.chest);
        }
        return this.getCollectedLoot();
    }

    getCollectedLoot() {
        return {
            shards: this._collectedLoot.shards,
            chests: [...this._collectedLoot.chests],
            xp: this._collectedLoot.xp
        };
    }
}

export class HuntingLootDropController {
    constructor({ session, rng = Math.random } = {}) {
        this.session = session;
        this.rng = rng;
    }

    onFighterDefeated(fighter, { simulation } = {}) {
        if (!fighter?.hunting?.isMob || !simulation || !this.session) return null;

        const collector = simulation.fighters.find(
            (candidate) => candidate.id === this.session.playerId && !candidate.flags.defeated
        );
        if (!collector) return null;

        const rarity = getLootRarity(fighter);
        const type = rollHuntingLootItemType({ collector, rarity, rng: this.rng });
        if (!type) return null;

        const isShardBundle = type === HUNTING_LOOT_ITEM_TYPES.SHARD_BUNDLE;
        const isChest = type === HUNTING_LOOT_ITEM_TYPES.CHEST || type === HUNTING_LOOT_ITEM_TYPES.HIGH_CHEST;
        const chestRarity =
            type === HUNTING_LOOT_ITEM_TYPES.HIGH_CHEST ? rollHighChestRarity({ rarity, rng: this.rng }) : "common";

        const item = createHuntingLootItem(type, {
            position: fighter.position,
            velocity: Vector2.fromAngle(this.rng() * Math.PI * 2, 120 + this.rng() * 80),
            collectorId: this.session.playerId,
            magnetRadiusMultiplier: LOOT_CONFIG.magnet.radiusMultiplier,
            magnetResponseRate: LOOT_CONFIG.magnet.responseRate,
            magnetSpeedMultiplier: LOOT_CONFIG.magnet.speedMultiplier,
            life: LOOT_CONFIG.itemLife,
            amount:
                type === HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK
                    ? getSmallHealPackAmount(collector)
                    : isShardBundle
                      ? rollHuntingShardBundleAmount({ floor: this.session.floor, rarity, rng: this.rng })
                      : getHuntingShardDropAmount(this.session.floor),
            chest: isChest ? createHuntingChest({ rarity: chestRarity }) : null,
            onCollected: (reward) => this.session.recordCollection(reward)
        });
        simulation.entities.push(item);
        return item;
    }

    onResultResolved(winner, { simulation } = {}) {
        if (!simulation || winner?.id !== this.session?.playerId) return;
        for (const entity of simulation.entities) {
            entity.beginVictoryCollection?.(LOOT_CONFIG.victoryCollection);
        }
    }
}
