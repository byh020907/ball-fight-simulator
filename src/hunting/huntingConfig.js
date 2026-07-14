import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const HUNTING_REWARDS = REWARD_BALANCE.hunting;

export const HUNTING_MAX_FLOOR = 100;
export const HUNTING_ADVANCE_STEPS = 10;

export const HUNTING_STAGE_IDS = Object.freeze({
    CAVE: "cave",
    FOREST: "forest",
    DESERT: "desert"
});

export const HUNTING_MONSTER_TYPES = Object.freeze({
    MELEE: "pursuer",
    RANGED: "shooter",
    PURSUER: "pursuer",
    CHARGER: "charger",
    SHOOTER: "shooter",
    ELECTRIC: "electric",
    HEALER: "healer",
    CHAIN: "chain",
    SHOCKWAVE: "shockwave",
    BARRIER: "barrier",
    SIPHON: "siphon",
    SHARD: "shard",
    BOOMERANG: "boomerang",
    SPLITTER: "splitter",
    JUMPER: "jumper",
    LASER: "laser"
});

export const HUNTING_STAGES = Object.freeze([
    Object.freeze({
        id: HUNTING_STAGE_IDS.CAVE,
        name: "동굴",
        description: "좁은 암벽 통로가 이어지는 첫 원정지",
        arena: Object.freeze({ WIDTH: 1000, HEIGHT: 1000 }),
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

export const HUNTING_MOB_COMPOSITION = Object.freeze({
    MIN_COUNT: 2,
    MAX_COUNT: 10,
    MAX_AREA_MULTIPLIER: 2,
    BASE_WEIGHT: 0.015,
    TARGET_DEPTH_RATIO: 0.75,
    MIN_SPREAD: 1.15,
    MAX_SPREAD: 2.25
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

export const HUNTING_MINIBOSS = Object.freeze({
    INITIAL_CHANCE: 0.05,
    MISS_CHANCE_INCREASE: 0.05,
    MAX_CHANCE: 0.3
});

export const HUNTING_PORTAL_DECLINE = Object.freeze({
    INITIAL_FLOORS: 5,
    HP_MULT: Object.freeze([
        Object.freeze({ minRatio: 0.5, mult: 1.0 }),
        Object.freeze({ minRatio: 0.3, mult: 1.8 }),
        Object.freeze({ minRatio: 0.0, mult: 3.0 })
    ])
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
    CHAMPION_INTRUSION: "champion_intrusion",
    ELITE_MOB: "elite_mob"
});

export const HUNTING_CHEST_RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);

export const HUNTING_CHEST_OPEN_COSTS = HUNTING_REWARDS.chest.openCosts;

export const HUNTING_CHEST_BREAK_WEIGHTS = HUNTING_REWARDS.chest.breakWeights;

export const HUNTING_DEFEAT_PRESERVE = Object.freeze({
    SHARDS: HUNTING_REWARDS.shards.defeatPreserve.shards,
    XP: HUNTING_REWARDS.shards.defeatPreserve.xp
});

export const HUNTING_SCALING = Object.freeze({
    ENEMY_POWER_PER_FLOOR: 0.08,
    ELITE_POWER_BONUS: 0.12,
    CHAMPION_POWER_BONUS: 0.28
});

export const HUNTING_CHEST_REWARD_TYPES = Object.freeze({
    SHARDS: "SHARDS",
    EQUIPMENT: "equipment"
});

export const HUNTING_STAT_KEYS = Object.freeze(["hp", "damage", "defense", "speed", "skill"]);
