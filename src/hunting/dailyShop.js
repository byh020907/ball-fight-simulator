import { getEquipmentTemplate, EQUIPMENT_TEMPLATES } from "./equipmentTemplates.js";
import { addEquipmentQuantity, getEquipmentCount } from "./equipmentInventory.js";

export const DAILY_SHOP = Object.freeze({
    purchaseLimit: 2,
    purchaseResetMs: 6 * 60 * 60 * 1000,
    rerollResetMs: 90 * 60 * 1000,
    rerollBaseCost: 30,
    rerollMaxCostMultiplier: 10,
    priceMultiplier: 3
});

const BASIC_EQUIPMENT_IDS = Object.freeze(EQUIPMENT_TEMPLATES.filter((t) => t.tier === "basic").map((t) => t.id));

function getRerollCost(rerolls) {
    const multiplier = Math.min(Math.max(0, rerolls) + 1, DAILY_SHOP.rerollMaxCostMultiplier);
    return DAILY_SHOP.rerollBaseCost * multiplier;
}

function normalizeTimedCounter(value, resetMs, now) {
    const count = Number.isFinite(value.count) ? Math.max(0, value.count) : 0;
    const lastActionAt = Number.isFinite(value.lastActionAt) ? value.lastActionAt : null;
    if (count === 0 || lastActionAt === null || lastActionAt + resetMs <= now) {
        return { count: 0, lastActionAt: null };
    }
    return { count, lastActionAt };
}

function getShopState(profile, now, rng = Math.random) {
    if (!profile?.hunting) return null;

    const shop = profile.hunting.dailyShop ?? {};

    delete shop.rarity;
    delete shop.chestCost;

    const purchLastActionAt = Number.isFinite(shop.lastPurchaseAt)
        ? shop.lastPurchaseAt
        : Number.isFinite(shop.purchaseResetAt)
          ? shop.purchaseResetAt - DAILY_SHOP.purchaseResetMs
          : null;
    const purchases = normalizeTimedCounter(
        { count: shop.purchases ?? 0, lastActionAt: purchLastActionAt },
        DAILY_SHOP.purchaseResetMs,
        now
    );
    const rerollLastActionAt = Number.isFinite(shop.lastRerollAt)
        ? shop.lastRerollAt
        : Number.isFinite(shop.rerollResetAt)
          ? shop.rerollResetAt - DAILY_SHOP.rerollResetMs
          : null;
    const rerolls = normalizeTimedCounter(
        { count: shop.rerolls ?? 0, lastActionAt: rerollLastActionAt },
        DAILY_SHOP.rerollResetMs,
        now
    );
    delete shop.purchaseResetAt;
    delete shop.rerollResetAt;

    let offerIds = Array.isArray(shop.offerIds)
        ? shop.offerIds.filter((id) => {
              const t = getEquipmentTemplate(id);
              return t && t.tier === "basic";
          })
        : [];
    if (
        offerIds.length !== 3 ||
        new Set(offerIds).size !== 3 ||
        !offerIds.every((id) => BASIC_EQUIPMENT_IDS.includes(id))
    ) {
        offerIds = generateUniqueBasicIds(3, [], rng);
    }

    shop.purchases = purchases.count;
    shop.lastPurchaseAt = purchases.lastActionAt;
    shop.rerolls = rerolls.count;
    shop.lastRerollAt = rerolls.lastActionAt;
    shop.offerIds = offerIds;

    profile.hunting.dailyShop = shop;
    return shop;
}

function generateUniqueBasicIds(count, exclude = [], rng = Math.random) {
    const available = BASIC_EQUIPMENT_IDS.filter((id) => !exclude.includes(id));
    const result = [];
    const used = new Set(exclude);
    while (result.length < count && available.length > result.length) {
        const remaining = available.filter((id) => !used.has(id));
        if (remaining.length === 0) break;
        const pick = remaining[Math.floor(clampRng(rng) * remaining.length)];
        result.push(pick);
        used.add(pick);
    }
    return result;
}

function clampRng(rng) {
    return Math.max(0, Math.min(0.999999, rng()));
}

function createOfferViews(offerIds, profile) {
    return offerIds.map((templateId, index) => {
        const template = getEquipmentTemplate(templateId);
        return {
            offerIndex: index,
            templateId: template.id,
            name: template.name,
            iconTag: template.iconTag ?? template.id,
            price: template.shopCost * DAILY_SHOP.priceMultiplier,
            ownedCount: getEquipmentCount(profile, template.id)
        };
    });
}

function createDailyShopView(shop, profile) {
    return {
        offers: createOfferViews(shop.offerIds, profile),
        purchases: shop.purchases,
        purchaseLimit: DAILY_SHOP.purchaseLimit,
        purchaseResetAt: Number.isFinite(shop.lastPurchaseAt) ? shop.lastPurchaseAt + DAILY_SHOP.purchaseResetMs : null,
        rerolls: shop.rerolls,
        rerollCost: getRerollCost(shop.rerolls),
        rerollBaseCost: DAILY_SHOP.rerollBaseCost,
        rerollResetAt: Number.isFinite(shop.lastRerollAt) ? shop.lastRerollAt + DAILY_SHOP.rerollResetMs : null
    };
}

export function getDailyShop(profile, now = Date.now(), rng = Math.random) {
    const shop = getShopState(profile, now, rng);
    return shop ? createDailyShopView(shop, profile) : null;
}

function getOfferIndex(shop, templateId) {
    return (shop.offerIds ?? []).indexOf(templateId);
}

function replaceOfferSlot(shop, slotIndex, rng) {
    const exclude = [...shop.offerIds];
    const newIds = generateUniqueBasicIds(1, exclude, rng);
    if (newIds.length === 0) return null;
    const updated = [...shop.offerIds];
    updated[slotIndex] = newIds[0];
    return updated;
}

export function buyDailyShopEquipment(profile, templateId, { now = Date.now(), rng = Math.random } = {}) {
    const shop = getShopState(profile, now, rng);
    if (!shop) return { ok: false, reason: "no_shop" };

    const slotIndex = getOfferIndex(shop, templateId);
    if (slotIndex < 0) return { ok: false, reason: "not_in_shop" };

    const template = getEquipmentTemplate(templateId);
    if (!template || template.tier !== "basic") return { ok: false, reason: "invalid_template" };

    if (shop.purchases >= DAILY_SHOP.purchaseLimit) return { ok: false, reason: "purchase_limit" };

    const price = template.shopCost * DAILY_SHOP.priceMultiplier;
    if ((profile.hunting.shards ?? 0) < price) return { ok: false, reason: "insufficient_shards" };

    const addResult = addEquipmentQuantity(profile, templateId, 1);
    if (!addResult.ok) return { ok: false, reason: addResult.reason || "capacity" };

    profile.hunting.shards -= price;
    shop.purchases += 1;
    shop.lastPurchaseAt = now;

    const updatedOfferIds = replaceOfferSlot(shop, slotIndex, rng);
    if (updatedOfferIds) shop.offerIds = updatedOfferIds;

    return {
        ok: true,
        templateId,
        price,
        ownedCount: addResult.count
    };
}

export function rerollDailyShop(profile, { now = Date.now(), rng = Math.random } = {}) {
    const shop = getShopState(profile, now, rng);
    if (!shop) return null;

    const cost = getRerollCost(shop.rerolls);
    if ((profile.hunting.shards ?? 0) < cost) return null;

    profile.hunting.shards -= cost;
    shop.rerolls += 1;
    shop.lastRerollAt = now;

    shop.offerIds = generateUniqueBasicIds(3, [...shop.offerIds], rng);

    return createDailyShopView(shop, profile);
}
