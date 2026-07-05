import {
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_CHANCE,
    HUNTING_FLOOR_OUTCOME_TYPES,
    HUNTING_MVP_EVENT_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_SCALING,
    HUNTING_MAX_FLOOR,
    HUNTING_STAGES,
    HUNTING_STAGE_IDS,
    HUNTING_COMBAT_RELIEF,
    HUNTING_PORTAL_DECLINE
} from "./huntingConfig.js";

const DEFAULT_RNG = () => Math.random();

function safeFloor(floor) {
    if (!Number.isFinite(floor)) return 1;
    return Math.max(1, Math.floor(floor));
}

function scaleNumber(value, multiplier, digits = 0) {
    if (!Number.isFinite(value)) return value;
    const scaled = value * multiplier;
    if (digits <= 0) return Math.round(scaled);
    return Number(scaled.toFixed(digits));
}

export function getEnemyPowerMultiplier(floor, { enemyType = HUNTING_ENEMY_TYPES.NORMAL } = {}) {
    const base = 1 + (safeFloor(floor) - 1) * HUNTING_SCALING.ENEMY_POWER_PER_FLOOR;
    if (enemyType === HUNTING_ENEMY_TYPES.CHAMPION) return base + HUNTING_SCALING.CHAMPION_POWER_BONUS;
    if (enemyType === HUNTING_ENEMY_TYPES.ELITE) return base + HUNTING_SCALING.ELITE_POWER_BONUS;
    return base;
}

export function scaleEnemySpecForHunting(spec, floor, { enemyType = HUNTING_ENEMY_TYPES.NORMAL } = {}) {
    const multiplier = getEnemyPowerMultiplier(floor, { enemyType });
    return {
        ...spec,
        stats: {
            ...spec.stats,
            hp: scaleNumber(spec.stats?.hp, multiplier),
            damage: scaleNumber(spec.stats?.damage, multiplier),
            defense: scaleNumber(spec.stats?.defense, multiplier, 3)
        },
        hunting: {
            ...(spec.hunting ?? {}),
            floor: safeFloor(floor),
            enemyType,
            enemyPowerMultiplier: multiplier
        }
    };
}

export function shouldRollHuntingEvent(floor, rng = DEFAULT_RNG) {
    const depthFactor = Math.min(1, (safeFloor(floor) - 1) / 4);
    const chance = HUNTING_EVENT_CHANCE.MIN + (HUNTING_EVENT_CHANCE.MAX - HUNTING_EVENT_CHANCE.MIN) * depthFactor;
    return rng() < chance;
}

function rollIndex(length, rng = DEFAULT_RNG) {
    return Math.floor(Math.max(0, Math.min(0.999999, rng())) * length);
}

function rollWeightedEventType(rng, portalMultiplier = 1.0) {
    const types = HUNTING_MVP_EVENT_TYPES;
    const weights = types.map((type) => (type === HUNTING_EVENT_TYPES.PORTAL ? portalMultiplier : 1.0));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const roll = rng() * totalWeight;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (roll < cumulative) return types[i];
    }
    return types[types.length - 1];
}

export function getHuntingPortalWeightMultiplier(hpRatio, portalDeclineFloors = 0) {
    if (!Number.isFinite(hpRatio) || hpRatio < 0) return 1.0;
    if (portalDeclineFloors > 0) return 1.0;
    const tier = HUNTING_PORTAL_DECLINE.HP_MULT.find((entry) => hpRatio >= entry.minRatio);
    return tier ? tier.mult : 1.0;
}

export function getHuntingStage(stageId = HUNTING_STAGE_IDS.CAVE) {
    return HUNTING_STAGES.find((stage) => stage.id === stageId) ?? HUNTING_STAGES[0];
}

export function getNextHuntingStageId(stageId = HUNTING_STAGE_IDS.CAVE) {
    const index = HUNTING_STAGES.findIndex((stage) => stage.id === stageId);
    if (index < 0 || index >= HUNTING_STAGES.length - 1) return null;
    return HUNTING_STAGES[index + 1].id;
}

export function getHuntingStageArena(stageId = HUNTING_STAGE_IDS.CAVE) {
    return getHuntingStage(stageId).arena;
}

export function getHuntingFloorChances(floor, combatReliefFloors = 0) {
    const safe = safeFloor(floor);
    const depth = Math.min(1, safe / HUNTING_MAX_FLOOR);
    const combatChance = 0.35 + depth * 0.35;
    const eventChance = HUNTING_EVENT_CHANCE.MAX - (HUNTING_EVENT_CHANCE.MAX - HUNTING_EVENT_CHANCE.MIN) * depth;

    const relief = Math.min(Math.max(0, combatReliefFloors), HUNTING_COMBAT_RELIEF.COMBAT_MULT.length - 1);
    const combatMult = HUNTING_COMBAT_RELIEF.COMBAT_MULT[relief];
    const eventTransfer = HUNTING_COMBAT_RELIEF.EVENT_TRANSFER[relief];

    const adjustedCombat = combatChance * combatMult;
    const combatReduction = combatChance - adjustedCombat;
    const adjustedEvent = Math.min(eventChance + combatReduction * eventTransfer, 1 - adjustedCombat);

    return {
        combatChance: Number(adjustedCombat.toFixed(3)),
        eventChance: Number(adjustedEvent.toFixed(3)),
        emptyChance: Number(Math.max(0, 1 - adjustedCombat - adjustedEvent).toFixed(3))
    };
}

export function getHuntingCombatEnemyType(floor, rng = DEFAULT_RNG) {
    const safe = safeFloor(floor);
    if (safe >= HUNTING_MAX_FLOOR) return HUNTING_ENEMY_TYPES.CHAMPION;
    const depth = Math.min(1, safe / HUNTING_MAX_FLOOR);
    const eliteChance = 0.06 + depth * 0.24;
    return rng() < eliteChance ? HUNTING_ENEMY_TYPES.ELITE : HUNTING_ENEMY_TYPES.NORMAL;
}

export function rollHuntingChestRoomRarity(floor, rng = DEFAULT_RNG) {
    const depth = safeFloor(floor);
    const roll = rng();
    if (depth >= 5 && roll < 0.03) return "legendary";
    if (depth >= 4 && roll < 0.12) return "epic";
    if (depth >= 3 && roll < 0.3) return "rare";
    if (roll < 0.55) return "uncommon";
    return "common";
}

export function rollCursedAltarTrade(floor, rng = DEFAULT_RNG) {
    const trades = [
        { gainStat: "damage", loseStat: "defense", gainMultiplier: 1.18, loseMultiplier: 0.9 },
        { gainStat: "defense", loseStat: "speed", gainMultiplier: 1.18, loseMultiplier: 0.92 },
        { gainStat: "speed", loseStat: "damage", gainMultiplier: 1.16, loseMultiplier: 0.92 },
        { gainStat: "skill", loseStat: "hp", gainMultiplier: 1.14, loseMultiplier: 0.94 }
    ];
    const trade = trades[rollIndex(trades.length, rng)];
    return {
        ...trade,
        floors: Math.min(3, 1 + Math.floor(safeFloor(floor) / 3))
    };
}

export function createHuntingEvent(type, floor, rng = DEFAULT_RNG) {
    const safe = safeFloor(floor);
    if (type === HUNTING_EVENT_TYPES.PORTAL) {
        return {
            type,
            floor: safe
        };
    }
    if (type === HUNTING_EVENT_TYPES.WANDERING_MERCHANT) {
        return {
            type,
            floor: safe,
            discountRatio: safe >= 70 ? 0.15 : 0.1
        };
    }
    if (type === HUNTING_EVENT_TYPES.BOON) {
        return {
            type,
            floor: safe,
            shards: 8 + Math.floor(safe / 10) * 3
        };
    }
    if (type === HUNTING_EVENT_TYPES.MISHAP) {
        return {
            type,
            floor: safe,
            damageRatio: safe >= 70 ? 0.14 : 0.1
        };
    }
    if (type === HUNTING_EVENT_TYPES.REST_SITE) {
        return {
            type,
            floor: safe,
            recoveryRatio: 0.25
        };
    }
    if (type === HUNTING_EVENT_TYPES.CHEST_ROOM) {
        return {
            type,
            floor: safe,
            chestRarity: rollHuntingChestRoomRarity(safe, rng)
        };
    }
    if (type === HUNTING_EVENT_TYPES.CURSED_ALTAR) {
        return {
            type,
            floor: safe,
            trade: rollCursedAltarTrade(safe, rng)
        };
    }
    if (type === HUNTING_EVENT_TYPES.CHAMPION_INTRUSION) {
        return {
            type,
            floor: safe,
            enemyType: HUNTING_ENEMY_TYPES.CHAMPION,
            rewardMultiplier: 1.5
        };
    }
    return {
        type,
        floor: safe
    };
}

export function rollHuntingEvent(floor, rng = DEFAULT_RNG) {
    if (!shouldRollHuntingEvent(floor, rng)) return null;
    const safe = safeFloor(floor);
    const index = rollIndex(HUNTING_MVP_EVENT_TYPES.length, rng);
    return createHuntingEvent(HUNTING_MVP_EVENT_TYPES[index], safe, rng);
}

export function rollHuntingFloorOutcome(floor, rng = DEFAULT_RNG, combatReliefFloors = 0, context = {}) {
    const safe = safeFloor(floor);
    if (safe >= HUNTING_MAX_FLOOR) {
        return {
            type: HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS,
            floor: HUNTING_MAX_FLOOR,
            enemyType: HUNTING_ENEMY_TYPES.CHAMPION
        };
    }

    const chances = getHuntingFloorChances(safe, combatReliefFloors);
    const roll = rng();
    if (roll < chances.combatChance) {
        return {
            type: HUNTING_FLOOR_OUTCOME_TYPES.COMBAT,
            floor: safe,
            enemyType: getHuntingCombatEnemyType(safe, rng)
        };
    }
    if (roll < chances.combatChance + chances.eventChance) {
        const portalMult = getHuntingPortalWeightMultiplier(context.hpRatio ?? 1.0, context.portalDeclineFloors ?? 0);
        const eventType = rollWeightedEventType(rng, portalMult);
        const event = createHuntingEvent(eventType, safe, rng);
        return {
            type: HUNTING_FLOOR_OUTCOME_TYPES.EVENT,
            floor: safe,
            event
        };
    }
    return {
        type: HUNTING_FLOOR_OUTCOME_TYPES.EMPTY,
        floor: safe
    };
}
