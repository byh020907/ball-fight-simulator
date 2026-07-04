import {
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_CHANCE,
    HUNTING_MVP_EVENT_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_SCALING
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
