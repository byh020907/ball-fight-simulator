import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { applyHuntingEventRecovery } from "../huntingState.js";

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
        return {
            run: applyHuntingEventRecovery(run, { amount: healAmount }),
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 휴식: ${name} HP +${healAmount}`,
            toastMessage: `휴식: HP +${healAmount}`
        };
    }
}
