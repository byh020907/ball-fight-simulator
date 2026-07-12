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
        const maxHp = run.carriedMaxHp ?? currentHp;
        const damage = Math.max(1, Math.floor(currentHp * (event.damageRatio ?? 0.1)));
        const minimumHp = Math.max(1, Math.ceil(maxHp * 0.2));
        const remainingHp = Math.max(minimumHp, currentHp - damage);
        return {
            run: recordHuntingFloorResult(run, {
                hpRemain: remainingHp,
                maxHp,
                loot: { shards: 0, chests: [], xp: 0 },
                consumeStatModifiers: false
            }),
            transition: HUNTING_EVENT_TRANSITIONS.CONTINUE,
            logMessage: `[사냥터] 함정: HP -${damage}`,
            presentation: {
                title: "함정 발동",
                subtext: "함정에 걸려 현재 체력을 잃었습니다.",
                detail: `HP -${Math.max(0, currentHp - remainingHp)} · 현재 ${remainingHp} / ${maxHp}`
            }
        };
    }
}
