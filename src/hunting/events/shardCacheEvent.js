import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { getHuntingRunHealth, recordHuntingFloorResult } from "../huntingState.js";
import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";

function rollShardCache(floor, rng) {
    const config = REWARD_BALANCE.hunting.events.shardCache;
    const base = config.baseShards;
    const bonus = Math.floor((floor - 1) / config.floorStep) * config.bonusPerStep;
    const variance = Math.floor(clamp(rng(), 0, 0.999999) * (config.variance * 2 + 1)) - config.variance;
    return Math.max(config.minimum, base + bonus + variance);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class ShardCacheEvent extends HuntingEvent {
    createPayload(floor, rng) {
        const safe = safeFloor(floor);
        return { type: this.type, floor: safe, shards: rollShardCache(safe, rng) };
    }

    resolve(event, { run }) {
        const shards = event.shards ?? 8;
        const health = getHuntingRunHealth(run);
        const nextRun = recordHuntingFloorResult(run, {
            hpRemain: health.hp,
            maxHp: health.maxHp,
            loot: { shards },
            consumeStatModifiers: false
        });
        return {
            run: nextRun,
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 파편 캐시: +${shards}`,
            presentation: {
                title: "파편 캐시 발견",
                subtext: "파편을 전리품에 추가했습니다.",
                detail: `파편 +${shards}`
            }
        };
    }
}
