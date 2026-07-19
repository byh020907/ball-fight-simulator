import { HUNTING_STAGE_IDS } from "./huntingConfig.js";
import { createCaveFinalBossSpec } from "./huntingMonsters.js";

const FINAL_BOSS_FACTORIES = Object.freeze({
    [HUNTING_STAGE_IDS.CAVE]: createCaveFinalBossSpec
});

const FINAL_BOSS_CODEX_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: "deep_core",
        type: "deep_core",
        stageId: HUNTING_STAGE_IDS.CAVE,
        name: "심층의 핵",
        color: "#f0a34a",
        face: "angry",
        rarity: "epic",
        behaviorDescription: "네 방향 암석 갑각을 부수면 잠시 핵이 노출됩니다. 암석 소환수를 흡수해 갑각을 복구합니다.",
        stats: Object.freeze({ hp: 1450, damage: 19, speed: 185, radius: 58, mass: 2.8, defense: 3 })
    })
]);

/** 전용 보스가 없는 지역은 null을 반환해 기존 로스터 보스 폴백을 유지한다. */
export function createHuntingFinalBossSpec({ stageId, floor } = {}) {
    const factory = FINAL_BOSS_FACTORIES[stageId];
    return factory ? factory({ floor }) : null;
}

export function hasDedicatedHuntingFinalBoss(stageId) {
    return Boolean(FINAL_BOSS_FACTORIES[stageId]);
}

export function getHuntingFinalBossCodexDefinitions() {
    return FINAL_BOSS_CODEX_DEFINITIONS;
}
