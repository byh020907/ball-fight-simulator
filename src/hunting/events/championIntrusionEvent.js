import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_ENEMY_TYPES } from "../huntingConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { HUNTING_RUN_PHASES, setHuntingRunPhase } from "../huntingState.js";

export class ChampionIntrusionEvent extends HuntingEvent {
    createPayload(floor) {
        return {
            type: this.type,
            floor: safeFloor(floor),
            enemyType: HUNTING_ENEMY_TYPES.CHAMPION,
            rewardMultiplier: REWARD_BALANCE.hunting.shards.combatMultipliers.championIntrusion
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
                detail: `파편 보상 x${event.rewardMultiplier ?? 1}`
            }
        };
    }
}
