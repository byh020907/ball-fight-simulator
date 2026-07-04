import {
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_CHANCE,
    HUNTING_MVP_EVENT_TYPES,
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
    return enemyType === HUNTING_ENEMY_TYPES.ELITE ? base + HUNTING_SCALING.ELITE_POWER_BONUS : base;
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

export function rollHuntingEvent(floor, rng = DEFAULT_RNG) {
    if (!shouldRollHuntingEvent(floor, rng)) return null;
    const index = Math.floor(Math.max(0, Math.min(0.999999, rng())) * HUNTING_MVP_EVENT_TYPES.length);
    return {
        type: HUNTING_MVP_EVENT_TYPES[index],
        floor: safeFloor(floor)
    };
}
