import { HUNTING_EVENT_TYPES } from "./huntingConfig.js";

export const HUNTING_FLOW_CONFIG = Object.freeze({
    autoAdvanceDelayMs: 1000,
    autoAdvanceTickMs: 50,
    swapEnabled: false,
    merchantEnabled: false
});

export function isHuntingEventEnabled(eventType) {
    return HUNTING_FLOW_CONFIG.merchantEnabled || eventType !== HUNTING_EVENT_TYPES.WANDERING_MERCHANT;
}
