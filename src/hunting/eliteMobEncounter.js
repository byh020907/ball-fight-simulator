import { HUNTING_ENEMY_TYPES, HUNTING_STAGE_IDS } from "./huntingConfig.js";
import { scaleEnemySpecForHunting } from "./huntingEncounters.js";
import { getEliteMobCombination } from "./eliteMobCombinations.js";
import { createHuntingMobSpec, getHuntingMonsterDefinition } from "./huntingMonsters.js";

function hasMatchingMonsterTypes(combination, monsterTypes) {
    return (
        Array.isArray(monsterTypes) &&
        combination.monsterTypes.length === monsterTypes.length &&
        combination.monsterTypes.every((type, index) => type === monsterTypes[index])
    );
}

export function createEliteMobEncounter({
    floor = 1,
    stageId = HUNTING_STAGE_IDS.CAVE,
    combinationId,
    monsterTypes,
    rng = Math.random
} = {}) {
    const combination = getEliteMobCombination(combinationId);
    if (!combination) throw new Error(`Unknown elite mob combination: ${combinationId ?? "missing"}`);
    if (!hasMatchingMonsterTypes(combination, monsterTypes)) {
        throw new Error(`Elite mob combination payload does not match: ${combinationId}`);
    }

    return monsterTypes.map((type, index) => {
        if (!getHuntingMonsterDefinition(type, stageId)) throw new Error(`Unknown elite mob type: ${type}`);
        const normalSpec = scaleEnemySpecForHunting(createHuntingMobSpec({ type, floor, index, stageId, rng }), floor, {
            enemyType: HUNTING_ENEMY_TYPES.NORMAL
        });
        return {
            ...normalSpec,
            hunting: { ...normalSpec.hunting, enemyType: HUNTING_ENEMY_TYPES.ELITE, eliteFormation: true }
        };
    });
}
