export const HUNTING_MAX_FLOOR = 5;

export const HUNTING_EVENT_CHANCE = Object.freeze({
    MIN: 0.25,
    MAX: 0.4
});

export const HUNTING_ENEMY_TYPES = Object.freeze({
    NORMAL: "normal",
    ELITE: "elite",
    CHAMPION: "champion"
});

export const HUNTING_EVENT_TYPES = Object.freeze({
    CHEST_ROOM: "chest_room",
    REST_SITE: "rest_site",
    CURSED_ALTAR: "cursed_altar"
});

export const HUNTING_MVP_EVENT_TYPES = Object.freeze([
    HUNTING_EVENT_TYPES.CHEST_ROOM,
    HUNTING_EVENT_TYPES.REST_SITE,
    HUNTING_EVENT_TYPES.CURSED_ALTAR
]);

export const HUNTING_CHEST_RARITIES = Object.freeze(["common", "uncommon", "rare"]);

export const HUNTING_CHEST_OPEN_COSTS = Object.freeze({
    common: 20,
    uncommon: 50,
    rare: 120,
    epic: 250,
    legendary: 500
});

export const HUNTING_CHEST_BREAK_WEIGHTS = Object.freeze({
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5
});

export const HUNTING_KEY_SHARD_RANGES = Object.freeze({
    [HUNTING_ENEMY_TYPES.NORMAL]: Object.freeze({ min: 5, max: 8 }),
    [HUNTING_ENEMY_TYPES.ELITE]: Object.freeze({ min: 15, max: 25 }),
    [HUNTING_ENEMY_TYPES.CHAMPION]: Object.freeze({ min: 40, max: 40 })
});

export const HUNTING_DEFEAT_PRESERVE = Object.freeze({
    KEY_SHARDS: 0.5,
    XP: 0.7
});

export const HUNTING_SCALING = Object.freeze({
    ENEMY_POWER_PER_FLOOR: 0.08,
    ELITE_POWER_BONUS: 0.12,
    REWARD_PER_FLOOR: 0.15,
    DEEP_FLOOR_BONUS: 0.1
});
