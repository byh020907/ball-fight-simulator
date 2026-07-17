import { HUNTING_ENEMY_TYPES } from "../huntingConfig.js";
import { pickEliteMobCombination } from "../eliteMobCombinations.js";
import { getHuntingMonsterDefinition } from "../huntingMonsters.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { HUNTING_RUN_PHASES, setHuntingRunPhase } from "../huntingState.js";

function formatEliteMobNames(monsterTypes) {
    return monsterTypes.map((type) => getHuntingMonsterDefinition(type)?.displayName ?? type).join(" · ");
}

export class EliteMobEvent extends HuntingEvent {
    createPayload(floor, rng = Math.random) {
        const safe = safeFloor(floor);
        if (safe < 10) throw new Error("Elite mob events unlock at floor 10");
        const combination = pickEliteMobCombination(safe, rng);
        if (!combination) throw new Error("No elite mob combination is available");
        return {
            type: this.type,
            floor: safe,
            enemyType: HUNTING_ENEMY_TYPES.ELITE,
            eliteCombinationId: combination.id,
            monsterTypes: [...combination.monsterTypes]
        };
    }

    resolve(event, { run }) {
        const monsterTypes = [...(event.monsterTypes ?? [])];
        const names = formatEliteMobNames(monsterTypes);
        return {
            run: setHuntingRunPhase(run, HUNTING_RUN_PHASES.COMBAT),
            transition: HUNTING_EVENT_TRANSITIONS.BATTLE,
            logMessage: `[사냥터] 정예 몹 조합: ${names}`,
            message: `${event.floor}층 — 정예 몹 습격!`,
            presentation: {
                title: "정예 몹 습격",
                subtext: `${names} 조합이 길을 막았습니다.`,
                detail: `${names} · elite 강화`
            }
        };
    }
}
