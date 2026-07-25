import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { getHuntingDisplayHealth, getHuntingDisplayHp } from "./huntingHealth.js";
import { getHuntingRunHealth, setHuntingRunActiveHealth } from "./huntingState.js";

export const MERCHANT_OFFER_TYPES = Object.freeze({
    REPAIR: "repair"
});

function calcDiscount(cost, discountRatio) {
    return Math.max(1, Math.floor(cost * (1 - discountRatio)));
}

export function createMerchantOffers(run, event, profile) {
    const discount = event?.discountRatio ?? 0;
    return [_createRepairOffer(run, discount)];
}

export function canAffordOffer(offer, profile) {
    if (offer.purchased || offer.disabled) return false;
    return (profile.hunting?.shards ?? 0) >= offer.cost;
}

function _createRepairOffer(run, discount) {
    const health = getHuntingRunHealth(run);
    const maxHp = health.maxHp ?? 100;
    const currentHp = health.hp ?? maxHp;
    const displayHealth = getHuntingDisplayHealth(run);
    const healPct = REWARD_BALANCE.hunting.events.merchant.repair.recoveryRatio;
    const healAmount = Math.max(1, Math.floor(maxHp * healPct));
    const cost = calcDiscount(REWARD_BALANCE.hunting.events.merchant.repair.cost, discount);
    const atMax = currentHp >= maxHp;
    return {
        id: "repair",
        type: MERCHANT_OFFER_TYPES.REPAIR,
        label: "회복",
        description: `HP +${getHuntingDisplayHp(healAmount)} (최대 ${displayHealth.maxHp})`,
        detail: `${Math.round(healPct * 100)}% 회복`,
        cost,
        healAmount,
        disabled: atMax,
        disabledReason: atMax ? "HP가 이미 최대입니다" : "",
        purchased: false
    };
}

export function applyMerchantOffer(run, profile, offer) {
    if (offer.purchased || offer.disabled) return null;
    const health = getHuntingRunHealth(run);
    if (offer.type === MERCHANT_OFFER_TYPES.REPAIR && (health.hp ?? health.maxHp ?? 100) >= (health.maxHp ?? 100)) {
        return null;
    }
    const shards = profile.hunting?.shards ?? 0;
    if (shards < offer.cost) return null;

    profile.hunting.shards = shards - offer.cost;

    let newRun = { ...run };
    let result = null;

    if (offer.type === MERCHANT_OFFER_TYPES.REPAIR) {
        const currentHealth = getHuntingRunHealth(newRun);
        const maxHp = currentHealth.maxHp ?? currentHealth.hp ?? 100;
        const currentHp = currentHealth.hp ?? maxHp;
        const healed = Math.min(offer.healAmount, maxHp - currentHp);
        newRun = setHuntingRunActiveHealth(newRun, { hp: currentHp + healed, maxHp });
        result = { type: "repair", healed, newHp: currentHp + healed };
    }

    return { run: newRun, result };
}

export function formatOfferResultToast(result) {
    if (!result) return "";
    if (result.type === "repair") {
        return `HP +${getHuntingDisplayHp(result.healed)} 회복 (${getHuntingDisplayHp(result.newHp)})`;
    }
    return "";
}
