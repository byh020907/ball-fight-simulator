import { Vector2 } from "../core.js";
import { createHuntingLootItem } from "../entities/huntingLootRegistry.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createEmptyHuntingLoot, createHuntingChest } from "./huntingRewards.js";

export const HUNTING_LOOT_ITEM_TYPES = Object.freeze({
    SMALL_HEAL_PACK: "small_heal_pack",
    SHARD: "shard",
    CHEST: "chest"
});

const LOOT_CONFIG = REWARD_BALANCE.hunting.loot;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getMissingHpRatio(collector) {
    if (!Number.isFinite(collector?.maxHp) || collector.maxHp <= 0) return 0;
    return clamp((collector.maxHp - collector.hp) / collector.maxHp, 0, 1);
}

function rollWeightedType(weights, rng) {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (totalWeight <= 0) return null;
    let roll = clamp(rng(), 0, 0.999999) * totalWeight;
    for (const [type, weight] of Object.entries(weights)) {
        roll -= Math.max(0, weight);
        if (roll < 0) return type;
    }
    return Object.keys(weights).at(-1) ?? null;
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

export function rollHuntingLootItemType({ collector, rng = Math.random } = {}) {
    if (!collector || rng() >= getHuntingLootDropChance(collector)) return null;

    const weights = { ...LOOT_CONFIG.weights };
    if (collector.hp >= collector.maxHp) {
        weights[HUNTING_LOOT_ITEM_TYPES.SHARD] += weights[HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK];
        weights[HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK] = 0;
    }
    return rollWeightedType(weights, rng);
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

        const type = rollHuntingLootItemType({ collector, rng: this.rng });
        if (!type) return null;

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
                    : getHuntingShardDropAmount(this.session.floor),
            chest: type === HUNTING_LOOT_ITEM_TYPES.CHEST ? createHuntingChest({ rarity: "common" }) : null,
            onCollected: (reward) => this.session.recordCollection(reward)
        });
        simulation.entities.push(item);
        return item;
    }
}
