import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { rollIndex, safeFloor } from "./eventHelpers.js";
import { applyHuntingCursedAltar } from "../huntingState.js";

const STAT_LABELS = Object.freeze({
    hp: "체력",
    damage: "공격력",
    defense: "방어력",
    speed: "속도",
    skill: "스킬"
});

function formatPercentDelta(multiplier, direction) {
    const percent = Math.round(Math.abs((multiplier ?? 1) - 1) * 100);
    return `${direction}${percent}%`;
}

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
            presentation: {
                title: "저주받은 제단",
                subtext: "다음 전투들에 스탯 교환이 적용됩니다.",
                detail: `${STAT_LABELS[event.trade?.gainStat] ?? event.trade?.gainStat} ${formatPercentDelta(event.trade?.gainMultiplier, "+")} / ${STAT_LABELS[event.trade?.loseStat] ?? event.trade?.loseStat} ${formatPercentDelta(event.trade?.loseMultiplier, "-")} · ${event.trade?.floors ?? 1}회 전투`
            }
        };
    }
}
