import { createHuntingChest } from "./huntingRewards.js";

export const DAILY_SHOP = Object.freeze({
    chestCost: 150,
    purchaseLimit: 2,
    purchaseResetMs: 6 * 60 * 60 * 1000,
    rerollResetMs: 90 * 60 * 1000,
    rerollBaseCost: 30,
    rerollMaxCostMultiplier: 10
});

const SHOP_RARITY_WEIGHTS = Object.freeze([
    ["common", 0.7],
    ["uncommon", 0.25],
    ["rare", 0.05]
]);

function rollShopRarity(rng) {
    let roll = rng();
    for (const [rarity, weight] of SHOP_RARITY_WEIGHTS) {
        roll -= weight;
        if (roll < 0) return rarity;
    }
    return "rare";
}

function getRerollCost(rerolls) {
    const multiplier = Math.min(Math.max(0, rerolls) + 1, DAILY_SHOP.rerollMaxCostMultiplier);
    return DAILY_SHOP.rerollBaseCost * multiplier;
}

function getShopState(profile, now, rng = Math.random) {
    if (!profile?.hunting) return null;

    const shop = profile.hunting.dailyShop ?? {};
    const purchases = Number.isFinite(shop.purchases) ? shop.purchases : 0;
    const rerolls = Number.isFinite(shop.rerolls) ? shop.rerolls : 0;
    shop.purchases = purchases;
    shop.rerolls = rerolls;

    if (!Number.isFinite(shop.purchaseResetAt) || shop.purchaseResetAt <= now) {
        shop.purchases = 0;
        shop.purchaseResetAt = now + DAILY_SHOP.purchaseResetMs;
    }
    if (!Number.isFinite(shop.rerollResetAt) || shop.rerollResetAt <= now) {
        shop.rerolls = 0;
        shop.rerollResetAt = now + DAILY_SHOP.rerollResetMs;
    }
    if (!SHOP_RARITY_WEIGHTS.some(([rarity]) => rarity === shop.rarity)) shop.rarity = rollShopRarity(rng);

    profile.hunting.dailyShop = shop;
    return shop;
}

function createDailyShopView(shop) {
    return {
        rarity: shop.rarity,
        purchases: shop.purchases,
        purchaseLimit: DAILY_SHOP.purchaseLimit,
        purchaseResetAt: shop.purchaseResetAt,
        rerolls: shop.rerolls,
        rerollCost: getRerollCost(shop.rerolls),
        rerollResetAt: shop.rerollResetAt,
        chestCost: DAILY_SHOP.chestCost
    };
}

export function getDailyShop(profile, now = Date.now()) {
    const shop = getShopState(profile, now);
    return shop ? createDailyShopView(shop) : null;
}

export function buyDailyShopChest(profile, { now = Date.now(), rng = Math.random } = {}) {
    const shop = getShopState(profile, now, rng);
    if (!shop || shop.purchases >= DAILY_SHOP.purchaseLimit || profile.hunting.shards < DAILY_SHOP.chestCost)
        return null;

    profile.hunting.shards -= DAILY_SHOP.chestCost;
    shop.purchases += 1;
    const chest = createHuntingChest({ rarity: shop.rarity, acquiredAt: now });
    profile.hunting.chests.push(chest);
    return chest;
}

export function rerollDailyShop(profile, { now = Date.now(), rng = Math.random } = {}) {
    const shop = getShopState(profile, now, rng);
    if (!shop) return null;

    const cost = getRerollCost(shop.rerolls);
    if (profile.hunting.shards < cost) return null;

    profile.hunting.shards -= cost;
    shop.rerolls += 1;
    shop.rarity = rollShopRarity(rng);
    return createDailyShopView(shop);
}
