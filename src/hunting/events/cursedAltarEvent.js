import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { rollIndex, safeFloor } from "./eventHelpers.js";
import { applyHuntingCursedAltar } from "../huntingState.js";

function rollTrade(floor, rng) {
    const altar = REWARD_BALANCE.hunting.events.cursedAltar;
    return {
        ...altar.trades[rollIndex(altar.trades.length, rng)],
        floors: Math.min(altar.maxDurationFloors, 1 + Math.floor(floor / altar.durationFloorDivisor))
    };
}

export class CursedAltarEvent extends HuntingEvent {
    createPayload(floor, rng) {
        const safe = safeFloor(floor);
        return { type: this.type, floor: safe, trade: rollTrade(safe, rng) };
    }

    resolve(event, { run }) {
        return {
            run: applyHuntingCursedAltar(run, { trade: event.trade }),
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 저주받은 제단: ${event.trade?.gainStat} x${event.trade?.gainMultiplier} / ${event.trade?.loseStat} x${event.trade?.loseMultiplier}`,
            toastMessage: "저주받은 제단: 스탯 교환"
        };
    }
}
