import { Vector2 } from "../core.js";
import { createHuntingLootItem } from "../entities/huntingLootRegistry.js";
import { getCombatMovementSpeed } from "../physics/magneticAttraction.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createEmptyHuntingLoot } from "./huntingRewards.js";
import { EQUIPMENT_TEMPLATES } from "./equipmentTemplates.js";
import {
    createHuntingExperienceAllocation,
    getHuntingCompletionExperienceDropCount,
    getHuntingExperienceDropCount,
    getHuntingExperienceDropLimit,
    rollHuntingBattleExperienceVariance,
    splitHuntingExperienceAmount
} from "./huntingExperience.js";

export const HUNTING_LOOT_ITEM_TYPES = Object.freeze({
    SMALL_HEAL_PACK: "small_heal_pack",
    SHARD: "shard",
    SHARD_BUNDLE: "shard_bundle",
    EXPERIENCE: "experience",
    EQUIPMENT: "equipment"
});

export const HUNTING_LOOT_RARITIES = Object.freeze(["common", "uncommon", "rare", "epic"]);

const LOOT_CONFIG = REWARD_BALANCE.hunting.loot;
const LOOT_LAUNCH_SPEED_MIN_MULTIPLIER = 1.2;
const LOOT_LAUNCH_SPEED_MAX_MULTIPLIER = 1.5;

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

function normalizeLootMultiplier(value) {
    return clamp(Number.isFinite(value) ? value : 1, 0, 1);
}

export function getHuntingLootMultiplier(fighter) {
    return normalizeLootMultiplier(fighter?.hunting?.lootMultiplier);
}

export function scaleHuntingLootAmount(amount, multiplier = 1) {
    const scaledAmount = Math.round(Math.max(0, amount) * normalizeLootMultiplier(multiplier));
    return scaledAmount > 0 ? Math.max(1, scaledAmount) : 0;
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

function getHuntingShardBaseAmount(floor = 1) {
    const safeFloor = Math.max(1, Math.floor(floor) || 1);
    const steps = Math.floor((safeFloor - 1) / LOOT_CONFIG.shard.floorStep);
    const amount = LOOT_CONFIG.shard.baseAmount + steps * LOOT_CONFIG.valueStep;
    return Math.min(LOOT_CONFIG.shard.maximumAmount, roundHuntingLootValue(amount));
}

export function getHuntingShardDropAmount(floor = 1, rng = Math.random) {
    const variation = Math.floor(clamp(rng(), 0, 0.999999) * 5) - 2;
    return Math.max(1, getHuntingShardBaseAmount(floor) + variation);
}

export function getHuntingShardPhysicalDropCount(rng = Math.random) {
    const { minimum, maximum } = LOOT_CONFIG.shard.physicalDropCount;
    return minimum + Math.floor(clamp(rng(), 0, 0.999999) * (maximum - minimum + 1));
}

function createLootLaunchVelocity(fighter, rng) {
    const speedMultiplier =
        LOOT_LAUNCH_SPEED_MIN_MULTIPLIER +
        rng() * (LOOT_LAUNCH_SPEED_MAX_MULTIPLIER - LOOT_LAUNCH_SPEED_MIN_MULTIPLIER);
    return Vector2.fromAngle(rng() * Math.PI * 2, getCombatMovementSpeed(fighter) * speedMultiplier);
}

export function getHuntingBonusLootWeights({ collector, rarity = "common" } = {}) {
    const missingHpRatio = getMissingHpRatio(collector);
    const normalWeights = LOOT_CONFIG.normalWeights;
    const healWeight =
        normalWeights.small_heal_pack.minimum +
        (normalWeights.small_heal_pack.maximum - normalWeights.small_heal_pack.minimum) * missingHpRatio;
    const rewardWeights = LOOT_CONFIG.rarityRewards[rarity] ?? LOOT_CONFIG.rarityRewards.common;
    return {
        [HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK]: healWeight,
        [HUNTING_LOOT_ITEM_TYPES.SHARD_BUNDLE]: rewardWeights.shard_bundle
    };
}

export function rollHuntingShardBundleAmount({ floor = 1, rarity = "rare", rng = Math.random } = {}) {
    const multipliers = LOOT_CONFIG.shardBundle.multipliers[rarity] ?? LOOT_CONFIG.shardBundle.multipliers.rare;
    const multiplier = rollWeightedEntries(
        multipliers.map(({ value, weight }) => [value, weight]),
        rng
    );
    return roundHuntingLootValue(getHuntingShardBaseAmount(floor) * Number(multiplier));
}

export function rollHuntingBonusLootItemType({
    collector,
    rarity = "common",
    rng = Math.random,
    chanceMultiplier = 1
} = {}) {
    const chance = getHuntingLootDropChance(collector) * normalizeLootMultiplier(chanceMultiplier);
    if (!collector || rng() >= chance) return null;
    return rollWeightedType(getHuntingBonusLootWeights({ collector, rarity }), rng);
}

const BASIC_EQUIPMENT_IDS = Object.freeze(
    EQUIPMENT_TEMPLATES.filter((template) => template.tier === "basic").map((template) => template.id)
);

export function rollHuntingEquipmentDrop({ rng = Math.random, chanceMultiplier = 1 } = {}) {
    const multiplier = normalizeLootMultiplier(chanceMultiplier);
    if (multiplier <= 0 || BASIC_EQUIPMENT_IDS.length === 0) return null;
    if (rng() >= LOOT_CONFIG.equipmentDropChance * multiplier) return null;
    const index = Math.floor(clamp(rng(), 0, 0.999999) * BASIC_EQUIPMENT_IDS.length);
    return BASIC_EQUIPMENT_IDS[index] ?? null;
}

function getLootAmount(type, { collector, floor, rarity, rng, lootMultiplier }) {
    if (type === HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK) return getSmallHealPackAmount(collector);
    if (type === HUNTING_LOOT_ITEM_TYPES.SHARD_BUNDLE)
        return scaleHuntingLootAmount(rollHuntingShardBundleAmount({ floor, rarity, rng }), lootMultiplier);
    return undefined;
}

function createHuntingLootEntity({
    type,
    fighter,
    collector,
    floor,
    rarity,
    rng,
    amount,
    templateId,
    lootMultiplier,
    onCollected
}) {
    return createHuntingLootItem(type, {
        position: fighter.position,
        velocity: createLootLaunchVelocity(fighter, rng),
        collectorId: collector.id,
        magnetRadiusMultiplier: LOOT_CONFIG.magnet.radiusMultiplier,
        magnetResponseRate: LOOT_CONFIG.magnet.responseRate,
        magnetSpeedMultiplier: LOOT_CONFIG.magnet.speedMultiplier,
        collectionGraceDuration: LOOT_CONFIG.magnet.collectionGraceDuration,
        life: LOOT_CONFIG.itemLife,
        amount: amount ?? getLootAmount(type, { collector, floor, rarity, rng, lootMultiplier }),
        templateId,
        onCollected
    });
}

export class HuntingBattleLootSession {
    constructor({ playerId, playerTeamId = null, floor }) {
        this.playerId = playerId;
        this.playerTeamId = playerTeamId;
        this.floor = floor;
        this._collectedLoot = createEmptyHuntingLoot();
        this._collectedExperience = 0;
    }

    recordCollection(reward) {
        if (!reward) return this.getCollectedLoot();
        if (reward.type === HUNTING_LOOT_ITEM_TYPES.SHARD) {
            this._collectedLoot.shards += Math.max(0, Math.round(reward.amount ?? 0));
        }
        if (reward.type === HUNTING_LOOT_ITEM_TYPES.EXPERIENCE) {
            this._collectedExperience += Math.max(0, Math.round(reward.amount ?? 0));
        }
        if (reward.type === HUNTING_LOOT_ITEM_TYPES.EQUIPMENT && reward.templateId) {
            const id = reward.templateId;
            const current = this._collectedLoot.equipment[id] ?? 0;
            this._collectedLoot.equipment[id] = current + 1;
        }
        return this.getCollectedLoot();
    }

    getCollectedLoot() {
        return {
            shards: this._collectedLoot.shards,
            equipment: { ...this._collectedLoot.equipment }
        };
    }

    getCollectedExperience() {
        return this._collectedExperience;
    }

    isPlayerSide(fighter) {
        if (!fighter) return false;
        if (this.playerTeamId !== null) return fighter.teamId === this.playerTeamId;
        return fighter.id === this.playerId;
    }
}

export class HuntingLootDropController {
    constructor({ session, rng = Math.random, onExperienceCollected = null, onLootCollected = null } = {}) {
        this.session = session;
        this.rng = rng;
        this.onExperienceCollected = onExperienceCollected;
        this.onLootCollected = onLootCollected;
        this._experiencePhysicalDropCount = 0;
        this._lastExperienceDropSource = null;
    }

    prepareExperienceDrops(fighters = []) {
        const battleVariance = rollHuntingBattleExperienceVariance(this.rng);
        const allocation = createHuntingExperienceAllocation(fighters, { battleVariance });
        for (const fighter of fighters) {
            if (!fighter?.hunting) continue;
            fighter.hunting.experienceReward = allocation.get(fighter.id) ?? 0;
        }
        return allocation;
    }

    onFighterDefeated(fighter, { simulation, suppressLootDrop = false } = {}) {
        if (!fighter?.hunting || fighter.hunting.suppressLootDrop || suppressLootDrop || !simulation || !this.session)
            return null;

        const isMob = Boolean(fighter.hunting.isMob);
        const isMiniboss = Boolean(fighter.hunting.isMiniboss);
        if (!isMob && !isMiniboss) return null;

        const eligibleCollectors = simulation.fighters.filter(
            (candidate) =>
                this.session.isPlayerSide(candidate) &&
                candidate.participation?.countsForResult !== false &&
                !candidate.flags.defeated
        );
        const collector =
            eligibleCollectors.find((candidate) => candidate.id === this.session.playerId) ?? eligibleCollectors[0];
        if (!collector) return null;

        const rarity = getLootRarity(fighter);
        const lootMultiplier = getHuntingLootMultiplier(fighter);
        const shards =
            isMob && lootMultiplier > 0
                ? this._spawnGuaranteedShardDrops(fighter, collector, rarity, lootMultiplier, simulation)
                : [];
        const bonusType =
            isMob && lootMultiplier > 0
                ? rollHuntingBonusLootItemType({
                      collector,
                      rarity,
                      rng: this.rng,
                      chanceMultiplier: lootMultiplier
                  })
                : null;
        if (bonusType) this._spawnLootItem(bonusType, fighter, collector, rarity, lootMultiplier, simulation);
        const experience = this._spawnExperienceDrops(fighter, collector, simulation);
        const equipmentDrop =
            (isMob || isMiniboss) && lootMultiplier > 0
                ? rollHuntingEquipmentDrop({
                      rng: this.rng,
                      chanceMultiplier: lootMultiplier
                  })
                : null;
        if (equipmentDrop) {
            this._spawnLootItem(
                HUNTING_LOOT_ITEM_TYPES.EQUIPMENT,
                fighter,
                collector,
                "common",
                lootMultiplier,
                simulation,
                { templateId: equipmentDrop }
            );
        }
        return shards[0] ?? experience[0] ?? null;
    }

    _spawnGuaranteedShardDrops(fighter, collector, rarity, lootMultiplier, simulation) {
        const count = getHuntingShardPhysicalDropCount(this.rng);
        return Array.from({ length: count }, () =>
            this._spawnLootItem(HUNTING_LOOT_ITEM_TYPES.SHARD, fighter, collector, rarity, lootMultiplier, simulation, {
                amount: scaleHuntingLootAmount(getHuntingShardDropAmount(this.session.floor, this.rng), lootMultiplier)
            })
        );
    }

    _spawnExperienceDrops(fighter, collector, simulation) {
        const amount = Math.max(0, Math.floor(fighter?.hunting?.experienceReward ?? 0));
        const count = getHuntingExperienceDropCount(fighter, amount, this._getRemainingExperienceDropCapacity());
        return this._spawnExperienceAmounts(
            fighter,
            collector,
            splitHuntingExperienceAmount(amount, count),
            simulation
        );
    }

    _spawnCompletionExperience(source, collector, amount, simulation) {
        const count = getHuntingCompletionExperienceDropCount(amount, this._getRemainingExperienceDropCapacity());
        return this._spawnExperienceAmounts(source, collector, splitHuntingExperienceAmount(amount, count), simulation);
    }

    _spawnExperienceAmounts(fighter, collector, amounts, simulation) {
        return amounts.map((amount) => {
            const item = this._spawnLootItem(
                HUNTING_LOOT_ITEM_TYPES.EXPERIENCE,
                fighter,
                collector,
                "common",
                1,
                simulation,
                { amount }
            );
            this._experiencePhysicalDropCount += 1;
            this._lastExperienceDropSource = fighter;
            return item;
        });
    }

    _getRemainingExperienceDropCapacity() {
        return Math.max(0, getHuntingExperienceDropLimit() - this._experiencePhysicalDropCount);
    }

    _spawnLootItem(type, fighter, collector, rarity, lootMultiplier, simulation, { amount, templateId } = {}) {
        const item = createHuntingLootEntity({
            type,
            fighter,
            collector,
            floor: this.session.floor,
            rarity,
            rng: this.rng,
            amount,
            templateId,
            lootMultiplier,
            onCollected: (reward) => {
                this.session.recordCollection(reward);
                if (reward.type === HUNTING_LOOT_ITEM_TYPES.EXPERIENCE) this.onExperienceCollected?.(reward);
                this.onLootCollected?.(reward);
            }
        });
        simulation.entities.push(item);
        return item;
    }

    onResultResolved(winner, { simulation, completionExperience = 0 } = {}) {
        if (!simulation || !this.session?.isPlayerSide(winner)) return;
        const source =
            this._lastExperienceDropSource ??
            simulation.fighters.find(
                (fighter) => (fighter?.hunting?.isMob || fighter?.hunting?.isMiniboss) && fighter.id !== winner.id
            ) ??
            winner;
        this._spawnCompletionExperience(source, winner, completionExperience, simulation);
        for (const entity of simulation.entities) {
            if (entity.collectorId && this.session.isPlayerSide(winner)) entity.collectorId = winner.id;
            entity.beginVictoryCollection?.(LOOT_CONFIG.victoryCollection);
        }
    }
}
