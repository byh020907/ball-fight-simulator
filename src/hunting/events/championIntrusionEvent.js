import { HUNTING_ENEMY_TYPES } from "../huntingConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { HUNTING_RUN_PHASES, setHuntingRunPhase } from "../huntingState.js";

export class ChampionIntrusionEvent extends HuntingEvent {
    createPayload(floor) {
        return {
            type: this.type,
            floor: safeFloor(floor),
            enemyType: HUNTING_ENEMY_TYPES.CHAMPION
        };
    }

    resolve(event, { run }) {
        return {
            run: setHuntingRunPhase(run, HUNTING_RUN_PHASES.COMBAT),
            transition: HUNTING_EVENT_TRANSITIONS.BATTLE,
            message: `${event.floor}층 — 챔피언 난입!`,
            presentation: {
                title: "챔피언 난입",
                subtext: "강화된 적이 길을 막아섰습니다.",
                detail: "일반 몬스터 전리품을 회수해 보상을 얻습니다."
            }
        };
    }
}
