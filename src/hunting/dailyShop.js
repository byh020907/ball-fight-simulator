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

function getLegacyLastActionAt(shop, countKey, lastActionAtKey, resetAtKey, resetMs) {
    if (Number.isFinite(shop[lastActionAtKey])) return shop[lastActionAtKey];
    if (shop[countKey] <= 0 || !Number.isFinite(shop[resetAtKey])) return null;
    return shop[resetAtKey] - resetMs;
}

function normalizeTimedShopCounter(shop, countKey, lastActionAtKey, resetAtKey, resetMs, now) {
    shop[countKey] = Number.isFinite(shop[countKey]) ? Math.max(0, shop[countKey]) : 0;
    const lastActionAt = getLegacyLastActionAt(shop, countKey, lastActionAtKey, resetAtKey, resetMs);

    if (shop[countKey] === 0 || lastActionAt === null || lastActionAt + resetMs <= now) {
        shop[countKey] = 0;
        shop[lastActionAtKey] = null;
    } else {
        shop[lastActionAtKey] = lastActionAt;
    }
    delete shop[resetAtKey];
}

function getResetAt(lastActionAt, resetMs) {
    return Number.isFinite(lastActionAt) ? lastActionAt + resetMs : null;
}

function getShopState(profile, now, rng = Math.random) {
    if (!profile?.hunting) return null;

    const shop = profile.hunting.dailyShop ?? {};
    normalizeTimedShopCounter(shop, "purchases", "lastPurchaseAt", "purchaseResetAt", DAILY_SHOP.purchaseResetMs, now);
    normalizeTimedShopCounter(shop, "rerolls", "lastRerollAt", "rerollResetAt", DAILY_SHOP.rerollResetMs, now);
    if (!SHOP_RARITY_WEIGHTS.some(([rarity]) => rarity === shop.rarity)) shop.rarity = rollShopRarity(rng);

    profile.hunting.dailyShop = shop;
    return shop;
}

function createDailyShopView(shop) {
    return {
        rarity: shop.rarity,
        purchases: shop.purchases,
        purchaseLimit: DAILY_SHOP.purchaseLimit,
        purchaseResetAt: getResetAt(shop.lastPurchaseAt, DAILY_SHOP.purchaseResetMs),
        rerolls: shop.rerolls,
        rerollCost: getRerollCost(shop.rerolls),
        rerollBaseCost: DAILY_SHOP.rerollBaseCost,
        rerollResetAt: getResetAt(shop.lastRerollAt, DAILY_SHOP.rerollResetMs),
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
    shop.lastPurchaseAt = now;
    const chest = createHuntingChest({ rarity: shop.rarity, acquiredAt: now });
    profile.hunting.chests.push(chest);
    shop.rarity = rollShopRarity(rng);
    return chest;
}

export function rerollDailyShop(profile, { now = Date.now(), rng = Math.random } = {}) {
    const shop = getShopState(profile, now, rng);
    if (!shop) return null;

    const cost = getRerollCost(shop.rerolls);
    if (profile.hunting.shards < cost) return null;

    profile.hunting.shards -= cost;
    shop.rerolls += 1;
    shop.lastRerollAt = now;
    shop.rarity = rollShopRarity(rng);
    return createDailyShopView(shop);
}
