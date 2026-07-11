import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { recordHuntingFloorResult } from "../huntingState.js";

export class BoonEvent extends HuntingEvent {
    createPayload(floor) {
        const safe = safeFloor(floor);
        return {
            type: this.type,
            floor: safe,
            shards:
                REWARD_BALANCE.hunting.events.boon.baseShards +
                Math.floor(safe / 10) * REWARD_BALANCE.hunting.events.boon.shardsPerTenFloors
        };
    }

    resolve(event, { run }) {
        const shards = event.shards ?? 8;
        return {
            run: recordHuntingFloorResult(run, {
                hpRemain: run.carriedHp,
                maxHp: run.carriedMaxHp,
                loot: { shards, chests: [], xp: 0 },
                consumeStatModifiers: false
            }),
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 축복: 파편 +${shards}`,
            toastMessage: `축복: 파편 +${shards}`
        };
    }
}
