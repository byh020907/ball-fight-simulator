import { HUNTING_EVENT_TYPES } from "./huntingConfig.js";

export const HUNTING_FLOW_CONFIG = Object.freeze({
    autoAdvanceDelayMs: 1000,
    autoAdvanceTickMs: 50,
    // 동료가 쓰러진 뒤 참가하지 않는 전투 수. 이 횟수를 채운 다음 전투에 최대 체력으로 복귀한다.
    companionDefeatBattleCount: 1,
    swapEnabled: false,
    merchantEnabled: false
});

export function isHuntingEventEnabled(eventType) {
    return HUNTING_FLOW_CONFIG.merchantEnabled || eventType !== HUNTING_EVENT_TYPES.WANDERING_MERCHANT;
}
