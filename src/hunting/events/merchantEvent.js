import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";
import { createMerchantOffers } from "../huntingMerchant.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { HUNTING_RUN_PHASES, setHuntingRunPhase } from "../huntingState.js";

export class MerchantEvent extends HuntingEvent {
    createPayload(floor) {
        const safe = safeFloor(floor);
        return {
            type: this.type,
            floor: safe,
            discountRatio:
                safe >= REWARD_BALANCE.hunting.events.merchant.discount.deepFloor
                    ? REWARD_BALANCE.hunting.events.merchant.discount.deepFloorValue
                    : REWARD_BALANCE.hunting.events.merchant.discount.default
        };
    }

    resolve(event, { run, playerProfile }) {
        const offers = createMerchantOffers(run, event, playerProfile);
        return {
            run: setHuntingRunPhase({ ...run, merchantOffers: offers }, HUNTING_RUN_PHASES.AWAITING_MERCHANT),
            transition: HUNTING_EVENT_TRANSITIONS.MERCHANT,
            message: `${event.floor}층 — 방랑 상인`,
            offers,
            logMessage: `[사냥터] ${event.floor}층 — 방랑 상인 발견`
        };
    }
}
