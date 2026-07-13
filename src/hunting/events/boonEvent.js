import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { rollIndex, safeFloor } from "./eventHelpers.js";
import { recordHuntingFloorResult } from "../huntingState.js";

function rollBoonShards(floor, rng) {
    const boon = REWARD_BALANCE.hunting.events.boon;
    const baseRangeSize = boon.baseShardVariance * 2 + 1;
    const baseShards = boon.baseShards - boon.baseShardVariance + rollIndex(baseRangeSize, rng);
    const floorProgress = Math.min(1, (floor - 1) / (boon.maxMultiplierFloor - 1));
    const multiplier = 1 + floorProgress * (boon.maxMultiplier - 1);
    return Math.round(baseShards * multiplier);
}

export class BoonEvent extends HuntingEvent {
    createPayload(floor, rng = Math.random) {
        const safe = safeFloor(floor);
        return {
            type: this.type,
            floor: safe,
            shards: rollBoonShards(safe, rng)
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
            presentation: {
                title: "축복",
                subtext: "전리품에 파편을 추가했습니다.",
                detail: `파편 +${shards}`
            }
        };
    }
}
