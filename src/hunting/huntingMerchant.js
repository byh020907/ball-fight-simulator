import { createHuntingChest } from "./huntingRewards.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { buyConsumable, getConsumableDefinition, getConsumableOwnedCount } from "../consumables.js";
import { getHuntingDisplayHealth, getHuntingDisplayHp } from "./huntingHealth.js";
import { getRarityLabel } from "./rarityPresentation.js";

export const MERCHANT_OFFER_TYPES = Object.freeze({
    REPAIR: "repair",
    BUY_LOOT: "buy_loot",
    SECURE_TRANSPORT: "secure_transport",
    CONSUMABLE: "consumable"
});

function calcDiscount(cost, discountRatio) {
    return Math.max(1, Math.floor(cost * (1 - discountRatio)));
}

export function createMerchantOffers(run, event, profile) {
    const discount = event?.discountRatio ?? 0;
    return [
        _createRepairOffer(run, discount),
        _createBuyLootOffer(discount),
        _createSecureTransportOffer(run, discount)
    ];
}

function _createRepairOffer(run, discount) {
    const maxHp = run.carriedMaxHp ?? 100;
    const currentHp = run.carriedHp ?? maxHp;
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

function _createBuyLootOffer(discount) {
    const cost = calcDiscount(REWARD_BALANCE.hunting.events.merchant.commonChestCost, discount);
    return {
        id: "buy_loot",
        type: MERCHANT_OFFER_TYPES.BUY_LOOT,
        label: "상자 구매",
        description: "미확보 상자 1개 추가",
        detail: `${getRarityLabel("common")} 등급`,
        cost,
        disabled: false,
        disabledReason: "",
        purchased: false
    };
}

function _createSecureTransportOffer(run, discount) {
    const pendingChests = run.pendingLoot?.chests ?? [];
    const cost = calcDiscount(REWARD_BALANCE.hunting.events.merchant.secureTransportCost, discount);
    const hasPending = pendingChests.length > 0;
    return {
        id: "secure_transport",
        type: MERCHANT_OFFER_TYPES.SECURE_TRANSPORT,
        label: "안전 운송",
        description: hasPending ? "미확보 상자 1개를 안전하게 확보" : "운송할 상자 없음",
        detail: hasPending ? "" : "미확보 상자가 없습니다",
        cost,
        disabled: !hasPending,
        disabledReason: !hasPending ? "안전하게 옮길 미확보 상자가 없습니다" : "",
        purchased: false
    };
}

export function createConsumableMerchantOffer(consumableId, profile, discountRatio = 0) {
    const definition = getConsumableDefinition(consumableId);
    if (!definition) return null;
    const owned = getConsumableOwnedCount(profile, consumableId);
    const atMax = owned >= definition.maxOwned;
    return {
        id: `consumable:${consumableId}`,
        type: MERCHANT_OFFER_TYPES.CONSUMABLE,
        consumableId,
        label: definition.label,
        description: definition.description,
        detail: `보유 ${owned}/${definition.maxOwned}`,
        cost: calcDiscount(definition.purchaseCost, discountRatio),
        disabled: atMax,
        disabledReason: atMax ? "보유 수량이 최대입니다" : "",
        purchased: false
    };
}

export function canAffordOffer(offer, profile) {
    if (offer.purchased || offer.disabled) return false;
    return (profile.hunting?.shards ?? 0) >= offer.cost;
}

export function applyMerchantOffer(run, profile, offer) {
    if (offer.purchased || offer.disabled) return null;
    if (offer.type === MERCHANT_OFFER_TYPES.CONSUMABLE) {
        const purchase = buyConsumable(profile, offer.consumableId, { cost: offer.cost });
        return purchase ? { run: { ...run }, result: { type: "consumable", purchase } } : null;
    }
    if (
        offer.type === MERCHANT_OFFER_TYPES.REPAIR &&
        (run.carriedHp ?? run.carriedMaxHp ?? 100) >= (run.carriedMaxHp ?? 100)
    ) {
        return null;
    }
    if (offer.type === MERCHANT_OFFER_TYPES.SECURE_TRANSPORT && (run.pendingLoot?.chests ?? []).length === 0) {
        return null;
    }
    const shards = profile.hunting?.shards ?? 0;
    if (shards < offer.cost) return null;

    profile.hunting.shards = shards - offer.cost;

    let newRun = { ...run };
    let result = null;

    if (offer.type === MERCHANT_OFFER_TYPES.REPAIR) {
        const maxHp = newRun.carriedMaxHp ?? newRun.carriedHp ?? 100;
        const currentHp = newRun.carriedHp ?? maxHp;
        const healed = Math.min(offer.healAmount, maxHp - currentHp);
        newRun.carriedHp = currentHp + healed;
        result = { type: "repair", healed, newHp: newRun.carriedHp };
    } else if (offer.type === MERCHANT_OFFER_TYPES.BUY_LOOT) {
        const chest = createHuntingChest({ rarity: "common" });
        newRun.pendingLoot = {
            ...newRun.pendingLoot,
            chests: [...(newRun.pendingLoot?.chests ?? []), chest]
        };
        result = { type: "buy_loot", chest };
    } else if (offer.type === MERCHANT_OFFER_TYPES.SECURE_TRANSPORT) {
        const pendingChests = [...(newRun.pendingLoot?.chests ?? [])];
        if (pendingChests.length === 0) return null;
        const movedChest = pendingChests.shift();
        newRun.pendingLoot = {
            ...newRun.pendingLoot,
            chests: pendingChests
        };
        newRun.securedLoot = {
            shards: newRun.securedLoot?.shards ?? 0,
            enhancementStones: newRun.securedLoot?.enhancementStones ?? 0,
            chests: [...(newRun.securedLoot?.chests ?? []), movedChest]
        };
        result = { type: "secure_transport", chest: movedChest };
    }

    return { run: newRun, result };
}

export function formatOfferResultToast(result) {
    if (!result) return "";
    if (result.type === "repair") {
        return `HP +${getHuntingDisplayHp(result.healed)} 회복 (${getHuntingDisplayHp(result.newHp)})`;
    }
    if (result.type === "buy_loot") return `${getRarityLabel(result.chest.rarity)} 상자 1개 구매 (미확보)`;
    if (result.type === "secure_transport") return `${getRarityLabel(result.chest.rarity)} 상자 1개 안전 확보`;
    if (result.type === "consumable") return `${result.purchase.label} 구매 · 보유 ${result.purchase.owned}`;
    return "";
}
