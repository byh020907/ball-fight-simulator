import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { applyHuntingEventRecovery } from "../huntingState.js";
import { getHuntingDisplayHealth, getHuntingDisplayHp } from "../huntingHealth.js";

export class RestSiteEvent extends HuntingEvent {
    createPayload(floor) {
        return {
            type: this.type,
            floor: safeFloor(floor),
            recoveryRatio: REWARD_BALANCE.hunting.events.restRecoveryRatio
        };
    }

    resolve(event, { run, roster }) {
        const healAmount = Math.floor((run.carriedMaxHp ?? run.carriedHp ?? 100) * (event.recoveryRatio ?? 0.25));
        const name = roster.find((fighter) => fighter.id === run.characterId)?.name ?? run.characterId;
        const nextRun = applyHuntingEventRecovery(run, { amount: healAmount });
        const health = getHuntingDisplayHealth(nextRun);
        return {
            run: nextRun,
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 휴식: ${name} HP +${healAmount}`,
            presentation: {
                title: "휴식지",
                subtext: `${name}이(가) 숨을 고릅니다.`,
                detail: `HP +${getHuntingDisplayHp(healAmount)} · 현재 ${health.hp} / ${health.maxHp}`
            }
        };
    }
}
