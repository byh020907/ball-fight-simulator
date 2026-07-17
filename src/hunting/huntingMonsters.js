import {
    HUNTING_ENEMY_TYPES,
    HUNTING_MOB_COMPOSITION,
    HUNTING_MONSTER_TYPES,
    HUNTING_STAGE_IDS,
    HUNTING_STAGES
} from "./huntingConfig.js";
import { applyBossMob } from "./bossMob.js";
import { scaleEnemySpecForHunting } from "./huntingEncounters.js";

const DEFAULT_RNG = () => Math.random();
const MONSTER_PROBABILITY = Object.freeze({
    establishedWeightRatio: 0.35,
    primaryWeightMultiplier: 3
});
const BOSS_MOB_RARITIES = Object.freeze(["uncommon", "rare", "epic"]);
const SPLITTER_DEFAULTS = Object.freeze({ splitLevel: 2, splitCount: 2, lootMultiplier: 1 });

export const HUNTING_TEAMS = Object.freeze({ PLAYER: "hunting-player", ENEMY: "hunting-enemy" });
export const HUNTING_MONSTER_TAGS = Object.freeze({
    MONSTER: "monster",
    RARITY_COMMON: "rarity:common",
    RARITY_UNCOMMON: "rarity:uncommon",
    RARITY_RARE: "rarity:rare",
    RARITY_EPIC: "rarity:epic"
});

const MONSTER_BEHAVIOR_DESCRIPTIONS = Object.freeze({
    pursuer: "대상을 향해 계속 추적합니다.",
    charger: "거리를 벌린 뒤 빠르게 돌진합니다.",
    shooter: "거리를 유지하며 투사체를 발사합니다.",
    electric: "가까운 대상과 전격 연결을 유지하며 지속 피해를 줍니다.",
    healer: "주변 아군 한 명에게 체력을 나누어 회복 빔을 연결합니다.",
    chain: "0.5초 사슬로 대상을 끌어당긴 뒤 1초 동안 다시 준비합니다.",
    shockwave: "충격파로 주변을 밀어내며 접근을 방해합니다.",
    barrier: "아군 앞을 막기 위해 가까운 아군과 위치를 교체합니다.",
    siphon: "1초 동안 체력을 흡수한 뒤 2초 동안 재사용을 준비합니다.",
    shard: "파편을 흩뿌려 여러 방향을 압박합니다.",
    boomerang: "되돌아오는 부메랑 투사체를 발사합니다.",
    splitter: "사망할 때 2단계에 걸쳐 작은 추적 파편으로 분열합니다.",
    jumper: "공중 도약 중 일반 아군을 통과하고, 정점에서 잠시 체공한 뒤 충돌을 노립니다.",
    laser: "충전한 방향으로 벽 끝까지 레이저를 발사합니다."
});

const RANGED_REPOSITION_PROFILE = Object.freeze({
    cooldown: 3,
    proximityGap: 90,
    impulse: 1500,
    allyAwareness: 180
});

const HUNTING_REPOSITION_PROFILES = Object.freeze({
    shooter: RANGED_REPOSITION_PROFILE,
    shard: RANGED_REPOSITION_PROFILE,
    boomerang: RANGED_REPOSITION_PROFILE,
    laser: RANGED_REPOSITION_PROFILE
});

export const HUNTING_PRESSURE_BEHAVIORS = Object.freeze([
    "pursuer",
    "charger",
    "electric",
    "chain",
    "shockwave",
    "barrier",
    "siphon",
    "jumper"
]);

const CAVE_MONSTERS = Object.freeze(
    [
        [
            "pursuer",
            "추적 볼",
            1,
            1.0,
            "#9b5d3f",
            "angry",
            { hp: 74, damage: 8, speed: 305, radius: 34, mass: 0.95, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_COMMON]
        ],
        [
            "charger",
            "돌진 볼",
            1,
            1.7,
            "#e66b4f",
            "dash",
            { hp: 86, damage: 10, speed: 286, radius: 37, mass: 1.08, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_COMMON]
        ],
        [
            "shooter",
            "사수 볼",
            10,
            1.7,
            "#426f9e",
            "cyclops",
            { hp: 62, damage: 8, speed: 258, radius: 31, mass: 0.82, defense: 0.6 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_COMMON]
        ],
        [
            "electric",
            "전기 마법사",
            30,
            1.8,
            "#5e8ee6",
            "ooo",
            { hp: 68, damage: 9, speed: 252, radius: 34, mass: 0.9, defense: 0.8 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_UNCOMMON]
        ],
        [
            "healer",
            "힐러 볼",
            20,
            1.8,
            "#65b87a",
            "happy",
            { hp: 110, damage: 5, speed: 268, radius: 35, mass: 1, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_UNCOMMON]
        ],
        [
            "chain",
            "사슬 볼",
            40,
            1.9,
            "#b85065",
            "angry",
            { hp: 88, damage: 9, speed: 278, radius: 35, mass: 1.05, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_RARE]
        ],
        [
            "shockwave",
            "충격파 볼",
            30,
            1.9,
            "#e1a94e",
            "ooo",
            { hp: 106, damage: 11, speed: 240, radius: 40, mass: 1.22, defense: 1.3 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_UNCOMMON]
        ],
        [
            "barrier",
            "방벽 볼",
            20,
            2.0,
            "#5dbaeb",
            "default",
            { hp: 104, damage: 7, speed: 250, radius: 39, mass: 1.18, defense: 1.5 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_UNCOMMON]
        ],
        [
            "siphon",
            "흡수 볼",
            40,
            2.0,
            "#9b69be",
            "xeye",
            { hp: 92, damage: 10, speed: 272, radius: 35, mass: 0.98, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_RARE]
        ],
        [
            "shard",
            "파편 볼",
            40,
            2.1,
            "#e0d05b",
            "cyclops",
            { hp: 82, damage: 10, speed: 260, radius: 35, mass: 0.95, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_RARE]
        ],
        [
            "boomerang",
            "부메랑 볼",
            50,
            2.1,
            "#e58a52",
            "happy",
            { hp: 84, damage: 10, speed: 270, radius: 35, mass: 0.95, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_EPIC]
        ],
        [
            "splitter",
            "분열 볼",
            50,
            2.2,
            "#c56bd5",
            "ooo",
            { hp: 94, damage: 9, speed: 262, radius: 37, mass: 1.02, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_EPIC]
        ],
        [
            "jumper",
            "도약 볼",
            50,
            2.2,
            "#e9c45d",
            "dash",
            { hp: 90, damage: 11, speed: 276, radius: 36, mass: 1, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_EPIC]
        ],
        [
            "laser",
            "레이저 볼",
            50,
            2.3,
            "#ef5b5b",
            "cyclops",
            { hp: 92, damage: 11, speed: 248, radius: 36, mass: 1.04, defense: 1 },
            [HUNTING_MONSTER_TAGS.MONSTER, HUNTING_MONSTER_TAGS.RARITY_EPIC]
        ]
    ].map(([type, displayName, unlockFloor, weight, color, face, stats, monsterTags]) =>
        Object.freeze({
            type,
            displayName,
            unlockFloor,
            weight,
            color,
            face,
            stats: Object.freeze(stats),
            monsterTags: Object.freeze([...monsterTags]),
            behaviorDescription: MONSTER_BEHAVIOR_DESCRIPTIONS[type],
            reposition: HUNTING_REPOSITION_PROFILES[type] ?? null
        })
    )
);

export const HUNTING_MONSTER_BASE_SPECS = Object.freeze(
    Object.fromEntries(CAVE_MONSTERS.map((monster) => [monster.type, monster]))
);

// 지역별 강화나 능력 변형은 이 정의에만 추가한다. 현재 지역은 같은 기본 수치를 공유한다.
const STAGE_MONSTER_OVERRIDES = Object.freeze(
    Object.fromEntries(HUNTING_STAGES.map((stage) => [stage.id, Object.freeze({})]))
);

function createStageMonsterDefinition(base, stage) {
    const override = STAGE_MONSTER_OVERRIDES[stage.id]?.[base.type] ?? {};
    return Object.freeze({
        ...base,
        ...override,
        stats: Object.freeze({ ...base.stats, ...(override.stats ?? {}) }),
        stageId: stage.id,
        stageName: stage.name
    });
}

const HUNTING_MONSTERS_BY_STAGE = Object.freeze(
    Object.fromEntries(
        HUNTING_STAGES.map((stage) => [
            stage.id,
            Object.freeze(CAVE_MONSTERS.map((monster) => createStageMonsterDefinition(monster, stage)))
        ])
    )
);

export function getHuntingMonsterDefinitions(stageId = HUNTING_STAGE_IDS.CAVE) {
    return HUNTING_MONSTERS_BY_STAGE[stageId] ?? HUNTING_MONSTERS_BY_STAGE[HUNTING_STAGE_IDS.CAVE];
}

export function getHuntingMonsterDefinition(type, stageId = HUNTING_STAGE_IDS.CAVE) {
    return getHuntingMonsterDefinitions(stageId).find((monster) => monster.type === type) ?? null;
}

const safeFloor = (floor) => Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1));

export function getHuntingMonsterPool(floor, stageId = HUNTING_STAGE_IDS.CAVE) {
    const safe = safeFloor(floor);
    const definitions = getHuntingMonsterDefinitions(stageId);
    const latestUnlockFloor = definitions.reduce(
        (latest, monster) => (monster.unlockFloor <= safe ? Math.max(latest, monster.unlockFloor) : latest),
        1
    );
    return definitions.map((monster) => ({
        ...monster,
        weight: getMonsterProbabilityWeight(monster, latestUnlockFloor)
    }));
}

function getMonsterProbabilityWeight(monster, latestUnlockFloor) {
    if (monster.unlockFloor > latestUnlockFloor) return 0;
    if (monster.unlockFloor === latestUnlockFloor) return monster.weight * MONSTER_PROBABILITY.primaryWeightMultiplier;
    return monster.weight * MONSTER_PROBABILITY.establishedWeightRatio;
}

function getMonsterRarity(monster) {
    return monster.monsterTags.find((tag) => tag.startsWith("rarity:"))?.slice("rarity:".length) ?? "common";
}

function rollWeightedMonster(pool, rng) {
    const total = pool.reduce((sum, monster) => sum + monster.weight, 0);
    let roll = rng() * total;
    for (const monster of pool) {
        roll -= monster.weight;
        if (roll < 0) return monster;
    }
    return pool.at(-1);
}

function rollMonster(floor, stageId, rng, excludedTypes = [], allowedRarities = null) {
    const pool = getHuntingMonsterPool(floor, stageId).filter(
        (monster) =>
            !excludedTypes.includes(monster.type) &&
            (!allowedRarities || allowedRarities.includes(getMonsterRarity(monster)))
    );
    return rollWeightedMonster(pool, rng);
}

function ensurePressureBehavior(monsterTypes, floor, stageId, rng) {
    if (monsterTypes.some((type) => HUNTING_PRESSURE_BEHAVIORS.includes(type))) return monsterTypes;
    const pressureMonster = rollWeightedMonster(
        getHuntingMonsterPool(floor, stageId).filter((monster) => HUNTING_PRESSURE_BEHAVIORS.includes(monster.type)),
        rng
    );
    if (!pressureMonster) return monsterTypes;
    return monsterTypes.map((type, index) => (index === monsterTypes.length - 1 ? pressureMonster.type : type));
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

function createSplitConfig(type, splitLevel, splitCount, splitLootMultiplier) {
    const defaults = type === HUNTING_MONSTER_TYPES.SPLITTER ? SPLITTER_DEFAULTS : null;
    const resolvedLevel = splitLevel ?? defaults?.splitLevel;
    const resolvedCount = splitCount ?? defaults?.splitCount;
    const resolvedLootMultiplier = splitLootMultiplier ?? defaults?.lootMultiplier;
    if (!Number.isFinite(resolvedLevel) || !Number.isFinite(resolvedCount) || !Number.isFinite(resolvedLootMultiplier))
        return null;
    return {
        splitLevel: Math.max(0, Math.floor(resolvedLevel)),
        splitCount: Math.max(1, Math.floor(resolvedCount)),
        lootMultiplier: Math.max(0, Math.min(1, resolvedLootMultiplier))
    };
}

export function createHuntingMobSpec({
    type = HUNTING_MONSTER_TYPES.MELEE,
    floor = 1,
    index = 0,
    stageId = HUNTING_STAGE_IDS.CAVE,
    rng = DEFAULT_RNG,
    splitLevel,
    splitCount,
    splitLootMultiplier
} = {}) {
    const base =
        getHuntingMonsterDefinition(type, stageId) ?? getHuntingMonsterDefinition(HUNTING_MONSTER_TYPES.MELEE, stageId);
    const splitConfig = createSplitConfig(base.type, splitLevel, splitCount, splitLootMultiplier);
    return {
        id: `hunting-mob-${base.type}-f${safeFloor(floor)}-${index}`,
        name: base.displayName,
        title: base.displayName,
        description: base.behaviorDescription,
        color: base.color,
        face: base.face,
        ability: "hunting_mob",
        teamId: HUNTING_TEAMS.ENEMY,
        stats: { ...base.stats },
        appearance: { sides: 6 + (index % 4), face: base.face, angle: rng() * Math.PI * 2, angularVelocity: 1.2 },
        hunting: {
            monsterType: base.type,
            monsterTags: base.monsterTags,
            behavior: base.type,
            isMob: true,
            stageSkin: base.stageId,
            ...(base.reposition ? { reposition: base.reposition } : {}),
            ...(splitConfig ?? {})
        }
    };
}

export function createHuntingMobEncounter({ floor = 1, stageId = HUNTING_STAGE_IDS.CAVE, rng = DEFAULT_RNG } = {}) {
    const monsterTypes = [];
    Array.from({ length: getHuntingMobCount(floor, rng) }).forEach((_, index) => {
        const forceDifferentSecondType = index === 1 && getHuntingMonsterPool(floor, stageId).length > 1;
        monsterTypes.push(rollMonster(floor, stageId, rng, forceDifferentSecondType ? [monsterTypes[0]] : []).type);
    });
    return ensurePressureBehavior(monsterTypes, floor, stageId, rng).map((type, index) =>
        scaleEnemySpecForHunting(createHuntingMobSpec({ type, floor, index, stageId, rng }), floor, {
            enemyType: HUNTING_ENEMY_TYPES.NORMAL
        })
    );
}

export function createHuntingBossMobSpec({
    floor = 1,
    index = 0,
    stageId = HUNTING_STAGE_IDS.CAVE,
    rng = DEFAULT_RNG
} = {}) {
    const candidate = rollMonster(floor, stageId, rng, [], BOSS_MOB_RARITIES);
    const normalSpec = scaleEnemySpecForHunting(
        createHuntingMobSpec({ type: candidate.type, floor, index, stageId, rng }),
        floor,
        { enemyType: HUNTING_ENEMY_TYPES.NORMAL }
    );
    return applyBossMob(normalSpec);
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
