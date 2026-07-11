import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { recordHuntingFloorResult } from "../huntingState.js";

export class MishapEvent extends HuntingEvent {
    createPayload(floor) {
        const safe = safeFloor(floor);
        return {
            type: this.type,
            floor: safe,
            damageRatio:
                safe >= REWARD_BALANCE.hunting.events.mishap.deepFloor
                    ? REWARD_BALANCE.hunting.events.mishap.deepFloorDamageRatio
                    : REWARD_BALANCE.hunting.events.mishap.defaultDamageRatio
        };
    }

    resolve(event, { run }) {
        const currentHp = run.carriedHp ?? run.carriedMaxHp ?? 100;
        const damage = Math.max(1, Math.floor(currentHp * (event.damageRatio ?? 0.1)));
        return {
            run: recordHuntingFloorResult(run, {
                hpRemain: Math.max(1, currentHp - damage),
                maxHp: run.carriedMaxHp,
                loot: { shards: 0, chests: [], xp: 0 },
                consumeStatModifiers: false
            }),
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 함정: HP -${damage}`,
            toastMessage: `함정: HP -${damage}`
        };
    }
}
