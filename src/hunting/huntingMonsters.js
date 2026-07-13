import { HUNTING_ENEMY_TYPES, HUNTING_MOB_COMPOSITION, HUNTING_STAGE_IDS } from "./huntingConfig.js";
import { scaleEnemySpecForHunting } from "./huntingEncounters.js";

const DEFAULT_RNG = () => Math.random();
const MONSTER_PROBABILITY = Object.freeze({
    preFocusWeightRatio: 0.08,
    establishedWeightRatio: 0.35,
    primaryWeightMultiplier: 3,
    focusLeadInFloors: 10
});

export const HUNTING_TEAMS = Object.freeze({ PLAYER: "hunting-player", ENEMY: "hunting-enemy" });
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

const CAVE_MONSTERS = Object.freeze(
    [
        [
            "pursuer",
            "추적 볼",
            1,
            1.0,
            "#9b5d3f",
            "angry",
            { hp: 74, damage: 8, speed: 305, radius: 34, mass: 0.95, defense: 1 }
        ],
        [
            "charger",
            "돌진 볼",
            1,
            1.7,
            "#e66b4f",
            "dash",
            { hp: 86, damage: 10, speed: 286, radius: 37, mass: 1.08, defense: 1 }
        ],
        [
            "shooter",
            "사수 볼",
            10,
            1.7,
            "#426f9e",
            "cyclops",
            { hp: 62, damage: 8, speed: 258, radius: 31, mass: 0.82, defense: 0.6 }
        ],
        [
            "electric",
            "전기 마법사",
            20,
            1.8,
            "#5e8ee6",
            "ooo",
            { hp: 68, damage: 9, speed: 252, radius: 34, mass: 0.9, defense: 0.8 }
        ],
        [
            "healer",
            "힐러 볼",
            30,
            1.8,
            "#65b87a",
            "happy",
            { hp: 110, damage: 5, speed: 268, radius: 35, mass: 1, defense: 1 }
        ],
        [
            "chain",
            "사슬 볼",
            40,
            1.9,
            "#b85065",
            "angry",
            { hp: 88, damage: 9, speed: 278, radius: 35, mass: 1.05, defense: 1 }
        ],
        [
            "shockwave",
            "충격파 볼",
            50,
            1.9,
            "#e1a94e",
            "ooo",
            { hp: 106, damage: 11, speed: 240, radius: 40, mass: 1.22, defense: 1.3 }
        ],
        [
            "barrier",
            "방벽 볼",
            60,
            2.0,
            "#5dbaeb",
            "default",
            { hp: 104, damage: 7, speed: 250, radius: 39, mass: 1.18, defense: 1.5 }
        ],
        [
            "siphon",
            "흡수 볼",
            70,
            2.0,
            "#9b69be",
            "xeye",
            { hp: 92, damage: 10, speed: 272, radius: 35, mass: 0.98, defense: 1 }
        ],
        [
            "shard",
            "파편 볼",
            80,
            2.1,
            "#e0d05b",
            "cyclops",
            { hp: 82, damage: 10, speed: 260, radius: 35, mass: 0.95, defense: 1 }
        ],
        [
            "boomerang",
            "부메랑 볼",
            91,
            2.1,
            "#e58a52",
            "happy",
            { hp: 84, damage: 10, speed: 270, radius: 35, mass: 0.95, defense: 1 }
        ],
        [
            "splitter",
            "분열 볼",
            92,
            2.2,
            "#c56bd5",
            "ooo",
            { hp: 94, damage: 9, speed: 262, radius: 37, mass: 1.02, defense: 1 }
        ],
        [
            "jumper",
            "도약 볼",
            93,
            2.2,
            "#e9c45d",
            "dash",
            { hp: 90, damage: 11, speed: 276, radius: 36, mass: 1, defense: 1 }
        ],
        [
            "laser",
            "레이저 볼",
            94,
            2.3,
            "#ef5b5b",
            "cyclops",
            { hp: 92, damage: 11, speed: 248, radius: 36, mass: 1.04, defense: 1 }
        ]
    ].map(([type, displayName, focusFloor, weight, color, face, stats]) =>
        Object.freeze({ type, displayName, focusFloor, weight, color, face, stats: Object.freeze(stats) })
    )
);

export const HUNTING_MONSTER_BASE_SPECS = Object.freeze(
    Object.fromEntries(CAVE_MONSTERS.map((monster) => [monster.type, monster]))
);
const safeFloor = (floor) => Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1));

export function getHuntingMonsterPool(floor, stageId = HUNTING_STAGE_IDS.CAVE) {
    const safe = safeFloor(floor);
    const definitions = stageId === HUNTING_STAGE_IDS.CAVE ? CAVE_MONSTERS : CAVE_MONSTERS;
    const latestFocusFloor = definitions.reduce(
        (latest, monster) => (monster.focusFloor <= safe ? Math.max(latest, monster.focusFloor) : latest),
        1
    );
    return definitions.map((monster) => ({
        ...monster,
        weight: getMonsterProbabilityWeight(monster, safe, latestFocusFloor)
    }));
}

function getMonsterProbabilityWeight(monster, floor, latestFocusFloor) {
    if (monster.focusFloor === latestFocusFloor) return monster.weight * MONSTER_PROBABILITY.primaryWeightMultiplier;
    if (monster.focusFloor < latestFocusFloor) return monster.weight * MONSTER_PROBABILITY.establishedWeightRatio;
    const focusProgress = Math.max(
        0,
        Math.min(
            1,
            (floor - (monster.focusFloor - MONSTER_PROBABILITY.focusLeadInFloors)) /
                MONSTER_PROBABILITY.focusLeadInFloors
        )
    );
    return (
        monster.weight *
        (MONSTER_PROBABILITY.preFocusWeightRatio + (1 - MONSTER_PROBABILITY.preFocusWeightRatio) * focusProgress)
    );
}

function rollMonster(floor, stageId, rng, excludedTypes = []) {
    const pool = getHuntingMonsterPool(floor, stageId).filter((monster) => !excludedTypes.includes(monster.type));
    const total = pool.reduce((sum, monster) => sum + monster.weight, 0);
    let roll = rng() * total;
    for (const monster of pool) {
        roll -= monster.weight;
        if (roll < 0) return monster;
    }
    return pool.at(-1);
}

export function getHuntingMobCountWeights(floor) {
    const depth = Math.min(1, (safeFloor(floor) - 1) / 99);
    const target =
        HUNTING_MOB_COMPOSITION.MIN_COUNT +
        (HUNTING_MOB_COMPOSITION.MAX_COUNT - HUNTING_MOB_COMPOSITION.MIN_COUNT) *
            depth *
            HUNTING_MOB_COMPOSITION.TARGET_DEPTH_RATIO;
    const spread =
        HUNTING_MOB_COMPOSITION.MIN_SPREAD +
        (HUNTING_MOB_COMPOSITION.MAX_SPREAD - HUNTING_MOB_COMPOSITION.MIN_SPREAD) * depth;
    return Array.from(
        { length: HUNTING_MOB_COMPOSITION.MAX_COUNT - HUNTING_MOB_COMPOSITION.MIN_COUNT + 1 },
        (_, index) => {
            const count = HUNTING_MOB_COMPOSITION.MIN_COUNT + index;
            const distance = (count - target) / spread;
            return {
                count,
                weight: HUNTING_MOB_COMPOSITION.BASE_WEIGHT + Math.exp((-distance * distance) / 2)
            };
        }
    );
}

export function getHuntingMobCount(floor, rng = DEFAULT_RNG) {
    const weights = getHuntingMobCountWeights(floor);
    const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * totalWeight;
    for (const entry of weights) {
        roll -= entry.weight;
        if (roll < 0) return entry.count;
    }
    return HUNTING_MOB_COMPOSITION.MAX_COUNT;
}

export function createHuntingMobSpec({
    type = HUNTING_MONSTER_TYPES.MELEE,
    floor = 1,
    index = 0,
    rng = DEFAULT_RNG
} = {}) {
    const base = HUNTING_MONSTER_BASE_SPECS[type] ?? HUNTING_MONSTER_BASE_SPECS[HUNTING_MONSTER_TYPES.MELEE];
    return {
        id: `hunting-mob-${base.type}-f${safeFloor(floor)}-${index}`,
        name: base.displayName,
        title: base.displayName,
        description: `${base.displayName} 전용 행동을 사용하는 사냥터 몬스터`,
        color: base.color,
        face: base.face,
        ability: "hunting_mob",
        teamId: HUNTING_TEAMS.ENEMY,
        stats: { ...base.stats },
        appearance: { sides: 6 + (index % 4), face: base.face, angle: rng() * Math.PI * 2, angularVelocity: 1.2 },
        hunting: { monsterType: base.type, behavior: base.type, isMob: true, stageSkin: "cave" }
    };
}

export function createHuntingMobEncounter({ floor = 1, stageId = HUNTING_STAGE_IDS.CAVE, rng = DEFAULT_RNG } = {}) {
    const monsterTypes = [];
    Array.from({ length: getHuntingMobCount(floor, rng) }).forEach((_, index) => {
        const forceDifferentSecondType = index === 1 && getHuntingMonsterPool(floor, stageId).length > 1;
        monsterTypes.push(rollMonster(floor, stageId, rng, forceDifferentSecondType ? [monsterTypes[0]] : []).type);
    });
    return monsterTypes.map((type, index) =>
        scaleEnemySpecForHunting(createHuntingMobSpec({ type, floor, index, rng }), floor, {
            enemyType: HUNTING_ENEMY_TYPES.NORMAL
        })
    );
}

export function shouldUseRosterMiniboss(floor, lastEvent = null) {
    return lastEvent?.type === "champion_intrusion" || safeFloor(floor) % 3 === 0;
}

export function createHuntingMinibossSpec({
    roster = [],
    characterId = "",
    floor = 1,
    enemyType = HUNTING_ENEMY_TYPES.ELITE,
    rng = DEFAULT_RNG
} = {}) {
    const candidates = roster.filter((fighter) => fighter.id !== characterId);
    if (!candidates.length) return null;
    const base = candidates[Math.floor(rng() * candidates.length)];
    return scaleEnemySpecForHunting(
        {
            ...base,
            id: `hunting-miniboss-${base.id}-f${safeFloor(floor)}`,
            name: `${base.name} 중간 보스`,
            teamId: HUNTING_TEAMS.ENEMY,
            stats: { ...base.stats },
            hunting: { ...(base.hunting ?? {}), isMiniboss: true, sourceFighterId: base.id }
        },
        floor,
        { enemyType }
    );
}
