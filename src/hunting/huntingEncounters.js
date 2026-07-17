import {
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_CHANCE,
    HUNTING_FLOOR_OUTCOME_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_SCALING,
    HUNTING_MAX_FLOOR,
    HUNTING_MOB_COMPOSITION,
    HUNTING_STAGES,
    HUNTING_STAGE_IDS,
    HUNTING_COMBAT_RELIEF,
    HUNTING_PORTAL_DECLINE
} from "./huntingConfig.js";
import { createHuntingEvent, HuntingEvent } from "./huntingEvents.js";

const DEFAULT_RNG = () => Math.random();

function safeFloor(floor) {
    if (!Number.isFinite(floor)) return 1;
    return Math.max(1, Math.floor(floor));
}

function scaleToHalf(value, multiplier) {
    if (!Number.isFinite(value)) return value;
    return Math.round(value * multiplier * 2) / 2;
}

export function getEnemyPowerMultiplier(floor, { enemyType = HUNTING_ENEMY_TYPES.NORMAL } = {}) {
    const depth = (Math.min(HUNTING_MAX_FLOOR, safeFloor(floor)) - 1) / (HUNTING_MAX_FLOOR - 1);
    const base = 1 + depth * (HUNTING_SCALING.NORMAL_MAX_POWER_MULTIPLIER - 1);
    const roleBonus =
        enemyType === HUNTING_ENEMY_TYPES.CHAMPION
            ? HUNTING_SCALING.CHAMPION_POWER_BONUS
            : enemyType === HUNTING_ENEMY_TYPES.ELITE
              ? HUNTING_SCALING.ELITE_POWER_BONUS
              : 0;
    return Number(Math.min(HUNTING_SCALING.MAX_POWER_MULTIPLIER, base + roleBonus).toFixed(3));
}

export function scaleEnemySpecForHunting(spec, floor, { enemyType = HUNTING_ENEMY_TYPES.NORMAL } = {}) {
    const multiplier = getEnemyPowerMultiplier(floor, { enemyType });
    return {
        ...spec,
        stats: {
            ...spec.stats,
            hp: scaleToHalf(spec.stats?.hp, multiplier),
            damage: scaleToHalf(spec.stats?.damage, multiplier),
            defense: scaleToHalf(spec.stats?.defense, multiplier)
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

function rollWeightedEventType(rng, portalMultiplier = 1.0, mishapAllowed = true) {
    const types = HuntingEvent.POOL.map((event) => event.type);
    const weights = types.map((type) => {
        if (type === HUNTING_EVENT_TYPES.PORTAL) return portalMultiplier;
        if (type === HUNTING_EVENT_TYPES.MISHAP && !mishapAllowed) return 0;
        return 1.0;
    });
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

export function getHuntingBattleArena(
    stageId = HUNTING_STAGE_IDS.CAVE,
    enemyCount = HUNTING_MOB_COMPOSITION.MIN_COUNT
) {
    const baseArena = getHuntingStageArena(stageId);
    const safeEnemyCount = Math.min(
        HUNTING_MOB_COMPOSITION.MAX_COUNT,
        Math.max(HUNTING_MOB_COMPOSITION.MIN_COUNT, Math.floor(enemyCount) || 0)
    );
    const countRatio =
        (safeEnemyCount - HUNTING_MOB_COMPOSITION.MIN_COUNT) /
        (HUNTING_MOB_COMPOSITION.MAX_COUNT - HUNTING_MOB_COMPOSITION.MIN_COUNT);
    const areaScale = 1 + countRatio * (HUNTING_MOB_COMPOSITION.MAX_AREA_MULTIPLIER - 1);
    const sideScale = Math.sqrt(areaScale);
    return Object.freeze({
        WIDTH: Math.round(baseArena.WIDTH * sideScale),
        HEIGHT: Math.round(baseArena.HEIGHT * sideScale)
    });
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
    if (safe < 10) {
        rng();
        return HUNTING_ENEMY_TYPES.NORMAL;
    }
    const depth = Math.min(1, safe / HUNTING_MAX_FLOOR);
    const eliteChance = 0.06 + depth * 0.24;
    return rng() < eliteChance ? HUNTING_ENEMY_TYPES.ELITE : HUNTING_ENEMY_TYPES.NORMAL;
}

export function rollHuntingEvent(floor, rng = DEFAULT_RNG) {
    if (!shouldRollHuntingEvent(floor, rng)) return null;
    const safe = safeFloor(floor);
    const event = HuntingEvent.POOL[rollIndex(HuntingEvent.POOL.length, rng)];
    return createHuntingEvent(event.type, safe, rng);
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
        const eventType = rollWeightedEventType(rng, portalMult, (context.hpRatio ?? 1) > 0.2);
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
