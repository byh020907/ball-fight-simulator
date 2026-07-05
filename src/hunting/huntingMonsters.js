import { HUNTING_ENEMY_TYPES } from "./huntingConfig.js";
import { scaleEnemySpecForHunting } from "./huntingEncounters.js";
import { generateMobAppearance } from "../entities/mobAppearance.js";

const DEFAULT_RNG = () => Math.random();

export const HUNTING_TEAMS = Object.freeze({
    PLAYER: "hunting-player",
    ENEMY: "hunting-enemy"
});

export const HUNTING_MONSTER_TYPES = Object.freeze({
    MELEE: "melee",
    RANGED: "ranged"
});

export const HUNTING_MONSTER_BASE_SPECS = Object.freeze({
    [HUNTING_MONSTER_TYPES.MELEE]: Object.freeze({
        id: "hunting-mob-melee",
        name: "근접 몹",
        title: "돌진형 하수인",
        description: "사냥터에서 무리로 달려드는 근접 몹입니다.",
        color: "#9b5d3f",
        face: "dash",
        ability: "hunting_melee",
        stats: Object.freeze({ hp: 74, damage: 8, speed: 305, radius: 34, mass: 0.95, defense: 1 })
    }),
    [HUNTING_MONSTER_TYPES.RANGED]: Object.freeze({
        id: "hunting-mob-ranged",
        name: "원거리 몹",
        title: "견제형 하수인",
        description: "사냥터에서 뒤쪽에서 화살로 견제하는 원거리 몹입니다.",
        color: "#426f9e",
        face: "archer",
        ability: "archer",
        stats: Object.freeze({ hp: 56, damage: 7, speed: 260, radius: 30, mass: 0.82, defense: 0.6 })
    })
});

function safeFloor(floor) {
    if (!Number.isFinite(floor)) return 1;
    return Math.max(1, Math.floor(floor));
}

function rollIndex(length, rng = DEFAULT_RNG) {
    return Math.floor(Math.max(0, Math.min(0.999999, rng())) * length);
}

function getMonsterTypeForSlot(floor, index, rng = DEFAULT_RNG) {
    if (index === 0) return HUNTING_MONSTER_TYPES.MELEE;
    if (safeFloor(floor) === 1 && index === 1) return HUNTING_MONSTER_TYPES.RANGED;
    return rollIndex(2, rng) === 0 ? HUNTING_MONSTER_TYPES.MELEE : HUNTING_MONSTER_TYPES.RANGED;
}

export function getHuntingMobCount(floor) {
    return Math.min(4, 2 + Math.floor((safeFloor(floor) - 1) / 2));
}

export function createHuntingMobSpec({
    type = HUNTING_MONSTER_TYPES.MELEE,
    floor = 1,
    index = 0,
    rng = DEFAULT_RNG
} = {}) {
    const safeType = HUNTING_MONSTER_BASE_SPECS[type] ? type : HUNTING_MONSTER_TYPES.MELEE;
    const base = HUNTING_MONSTER_BASE_SPECS[safeType];
    return {
        ...base,
        id: `${base.id}-f${safeFloor(floor)}-${index}`,
        name: `${base.name} ${index + 1}`,
        teamId: HUNTING_TEAMS.ENEMY,
        stats: { ...base.stats },
        hunting: {
            monsterType: safeType,
            isMob: true
        },
        appearance: generateMobAppearance(rng)
    };
}

export function createHuntingMobEncounter({ floor = 1, rng = DEFAULT_RNG } = {}) {
    const count = getHuntingMobCount(floor);
    return Array.from({ length: count }, (_, index) => {
        const type = getMonsterTypeForSlot(floor, index, rng);
        return scaleEnemySpecForHunting(createHuntingMobSpec({ type, floor, index }), floor, {
            enemyType: HUNTING_ENEMY_TYPES.NORMAL
        });
    });
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
    if (candidates.length === 0) return null;

    const base = candidates[rollIndex(candidates.length, rng)];
    const scaled = scaleEnemySpecForHunting(
        {
            ...base,
            id: `hunting-miniboss-${base.id}-f${safeFloor(floor)}`,
            name: `${base.name} 중간 보스`,
            teamId: HUNTING_TEAMS.ENEMY,
            stats: { ...base.stats },
            hunting: {
                ...(base.hunting ?? {}),
                isMiniboss: true,
                sourceFighterId: base.id
            }
        },
        floor,
        { enemyType }
    );

    return scaled;
}
