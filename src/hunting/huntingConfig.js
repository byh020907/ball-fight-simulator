export const HUNTING_MAX_FLOOR = 100;
export const HUNTING_ADVANCE_STEPS = 10;

export const HUNTING_STAGE_IDS = Object.freeze({
    CAVE: "cave",
    FOREST: "forest",
    DESERT: "desert"
});

export const HUNTING_STAGES = Object.freeze([
    Object.freeze({
        id: HUNTING_STAGE_IDS.CAVE,
        name: "동굴",
        description: "좁은 암벽 통로가 이어지는 첫 원정지",
        arena: Object.freeze({ WIDTH: 1120, HEIGHT: 1120 }),
        theme: "cave"
    }),
    Object.freeze({
        id: HUNTING_STAGE_IDS.FOREST,
        name: "숲",
        description: "회복과 함정이 뒤섞인 깊은 숲",
        arena: Object.freeze({ WIDTH: 1280, HEIGHT: 1280 }),
        theme: "forest"
    }),
    Object.freeze({
        id: HUNTING_STAGE_IDS.DESERT,
        name: "사막",
        description: "넓은 전장과 거친 모래바람의 원정지",
        arena: Object.freeze({ WIDTH: 1440, HEIGHT: 1280 }),
        theme: "desert"
    })
]);

export const HUNTING_ARENA = Object.freeze({
    WIDTH: 1280,
    HEIGHT: 1280
});

export const HUNTING_EVENT_CHANCE = Object.freeze({
    MIN: 0.18,
    MAX: 0.35
});

export const HUNTING_COMBAT_RELIEF = Object.freeze({
    INITIAL_FLOORS: 3,
    COMBAT_MULT: Object.freeze([1.0, 0.75, 0.55, 0.35]),
    EVENT_TRANSFER: Object.freeze([0.0, 0.55, 0.65, 0.7])
});

export const HUNTING_FLOOR_OUTCOME_TYPES = Object.freeze({
    EMPTY: "empty",
    COMBAT: "combat",
    EVENT: "event",
    FINAL_BOSS: "final_boss"
});

export const HUNTING_ENEMY_TYPES = Object.freeze({
    NORMAL: "normal",
    ELITE: "elite",
    CHAMPION: "champion"
});

export const HUNTING_EVENT_TYPES = Object.freeze({
    PORTAL: "portal",
    WANDERING_MERCHANT: "wandering_merchant",
    BOON: "boon",
    MISHAP: "mishap",
    CHEST_ROOM: "chest_room",
    REST_SITE: "rest_site",
    CURSED_ALTAR: "cursed_altar",
    CHAMPION_INTRUSION: "champion_intrusion"
});

export const HUNTING_MVP_EVENT_TYPES = Object.freeze([
    HUNTING_EVENT_TYPES.PORTAL,
    HUNTING_EVENT_TYPES.WANDERING_MERCHANT,
    HUNTING_EVENT_TYPES.BOON,
    HUNTING_EVENT_TYPES.MISHAP,
    HUNTING_EVENT_TYPES.CHEST_ROOM,
    HUNTING_EVENT_TYPES.REST_SITE,
    HUNTING_EVENT_TYPES.CURSED_ALTAR,
    HUNTING_EVENT_TYPES.CHAMPION_INTRUSION
]);

export const HUNTING_CHEST_RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);

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

export const HUNTING_SHARD_REWARDS = Object.freeze({
    [HUNTING_ENEMY_TYPES.NORMAL]: Object.freeze({ min: 5, max: 8 }),
    [HUNTING_ENEMY_TYPES.ELITE]: Object.freeze({ min: 15, max: 25 }),
    [HUNTING_ENEMY_TYPES.CHAMPION]: Object.freeze({ min: 40, max: 40 })
});

export const HUNTING_DEFEAT_PRESERVE = Object.freeze({
    SHARDS: 0.5,
    XP: 0.7
});

export const HUNTING_SCALING = Object.freeze({
    ENEMY_POWER_PER_FLOOR: 0.08,
    ELITE_POWER_BONUS: 0.12,
    CHAMPION_POWER_BONUS: 0.28,
    REWARD_PER_FLOOR: 0.15,
    DEEP_FLOOR_BONUS: 0.1
});

export const HUNTING_CHEST_REWARD_TYPES = Object.freeze({
    SHARDS: "SHARDS",
    EQUIPMENT: "equipment"
});

export const HUNTING_STAT_KEYS = Object.freeze(["hp", "damage", "defense", "speed", "skill"]);
