export const CONSUMABLE_IDS = Object.freeze({
    HP_POTION: "hp_potion"
});

export const CONSUMABLE_DEFINITIONS = Object.freeze({
    [CONSUMABLE_IDS.HP_POTION]: Object.freeze({
        id: CONSUMABLE_IDS.HP_POTION,
        label: "HP 물약",
        description: "전투 전 최대 HP의 25%를 회복합니다.",
        purchaseCost: 100,
        maxOwned: 10,
        useContext: "hunting_battle_preparation",
        effect: Object.freeze({ type: "heal_max_hp_ratio", value: 0.25 })
    })
});

export const HUNTING_CONSUMABLE_USE_LIMIT = Object.freeze({
    initial: 1,
    max: 5,
    firstUpgradeCost: 100,
    maxUsesPerBattle: 1
});

function clampInteger(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.floor(value)));
}

function getDefinition(consumableId) {
    return CONSUMABLE_DEFINITIONS[consumableId] ?? null;
}

export function getConsumableDefinition(consumableId) {
    return getDefinition(consumableId);
}

function getOwnedCounts(consumables) {
    return consumables?.owned && typeof consumables.owned === "object" ? consumables.owned : {};
}

function getUpgrades(consumables) {
    return consumables?.upgrades && typeof consumables.upgrades === "object" ? consumables.upgrades : {};
}

function getHuntingUseLimitFromConsumables(consumables) {
    return clampInteger(
        getUpgrades(consumables).huntingPreBattleUseLimit,
        HUNTING_CONSUMABLE_USE_LIMIT.initial,
        HUNTING_CONSUMABLE_USE_LIMIT.max
    );
}

function getHuntingUseLimitUpgradeCost(limit) {
    const upgradeIndex = Math.max(0, limit - HUNTING_CONSUMABLE_USE_LIMIT.initial);
    return HUNTING_CONSUMABLE_USE_LIMIT.firstUpgradeCost * 2 ** upgradeIndex;
}

function getUsedConsumableCount(uses, definitions) {
    return definitions.reduce((total, definition) => total + Math.max(0, Math.floor(uses[definition.id] ?? 0)), 0);
}

export function createDefaultConsumables() {
    return {
        owned: {},
        upgrades: {
            huntingPreBattleUseLimit: HUNTING_CONSUMABLE_USE_LIMIT.initial
        }
    };
}

export function sanitizeConsumables(source) {
    const owned = Object.fromEntries(
        Object.values(CONSUMABLE_DEFINITIONS).map((definition) => [
            definition.id,
            clampInteger(getOwnedCounts(source)[definition.id], 0, definition.maxOwned)
        ])
    );
    return {
        owned,
        upgrades: {
            huntingPreBattleUseLimit: getHuntingUseLimitFromConsumables(source)
        }
    };
}

export function ensureConsumables(profile) {
    if (!profile || typeof profile !== "object") return null;
    profile.consumables = sanitizeConsumables(profile.consumables);
    return profile.consumables;
}

export function getConsumableOwnedCount(profile, consumableId) {
    const definition = getDefinition(consumableId);
    if (!definition) return 0;
    return clampInteger(getOwnedCounts(profile?.consumables)[consumableId], 0, definition.maxOwned);
}

export function getConsumableShopItems(profile) {
    return Object.values(CONSUMABLE_DEFINITIONS).map((definition) => {
        const owned = getConsumableOwnedCount(profile, definition.id);
        const shards = Math.max(0, Math.floor(profile?.hunting?.shards ?? 0));
        return {
            id: definition.id,
            label: definition.label,
            description: definition.description,
            cost: definition.purchaseCost,
            owned,
            maxOwned: definition.maxOwned,
            canPurchase: owned < definition.maxOwned && shards >= definition.purchaseCost
        };
    });
}

export function buyConsumable(profile, consumableId, { cost = null } = {}) {
    const definition = getDefinition(consumableId);
    if (!definition || !profile?.hunting) return null;
    const consumables = ensureConsumables(profile);
    const owned = getConsumableOwnedCount(profile, consumableId);
    const purchaseCost = Number.isFinite(cost) ? Math.max(0, Math.floor(cost)) : definition.purchaseCost;
    if (owned >= definition.maxOwned || profile.hunting.shards < purchaseCost) return null;

    profile.hunting.shards -= purchaseCost;
    consumables.owned[consumableId] = owned + 1;
    return {
        consumableId,
        label: definition.label,
        cost: purchaseCost,
        owned: consumables.owned[consumableId]
    };
}

export function getHuntingConsumableUseLimit(profile) {
    return getHuntingUseLimitFromConsumables(profile?.consumables);
}

export function getHuntingConsumableUseLimitUpgrade(profile) {
    const currentLimit = getHuntingConsumableUseLimit(profile);
    const maxLimit = HUNTING_CONSUMABLE_USE_LIMIT.max;
    return {
        currentLimit,
        maxLimit,
        cost: currentLimit >= maxLimit ? null : getHuntingUseLimitUpgradeCost(currentLimit),
        canUpgrade:
            currentLimit < maxLimit && (profile?.hunting?.shards ?? 0) >= getHuntingUseLimitUpgradeCost(currentLimit)
    };
}

export function upgradeHuntingConsumableUseLimit(profile) {
    if (!profile?.hunting) return null;
    const upgrade = getHuntingConsumableUseLimitUpgrade(profile);
    if (!upgrade.canUpgrade || upgrade.cost === null) return null;

    const consumables = ensureConsumables(profile);
    profile.hunting.shards -= upgrade.cost;
    consumables.upgrades.huntingPreBattleUseLimit = upgrade.currentLimit + 1;
    return {
        previousLimit: upgrade.currentLimit,
        currentLimit: consumables.upgrades.huntingPreBattleUseLimit,
        cost: upgrade.cost
    };
}

export function getHuntingPreparationConsumables(profile, run) {
    const runUses = run?.consumableUses ?? {};
    const battleUses = run?.battleConsumableUses ?? {};
    const useLimit = getHuntingConsumableUseLimit(profile);
    const health = getHuntingRunHealth(run);
    const currentHp = Math.max(0, health.hp ?? 0);
    const maxHp = Math.max(0, health.maxHp ?? 0);
    const preparationDefinitions = Object.values(CONSUMABLE_DEFINITIONS).filter(
        (definition) => definition.useContext === "hunting_battle_preparation"
    );
    const usedInRun = getUsedConsumableCount(runUses, preparationDefinitions);
    const usedInBattle = getUsedConsumableCount(battleUses, preparationDefinitions);

    return preparationDefinitions.map((definition) => {
        const owned = getConsumableOwnedCount(profile, definition.id);
        const healAmount =
            definition.effect.type === "heal_max_hp_ratio"
                ? Math.max(1, Math.round(maxHp * definition.effect.value))
                : 0;
        const atMaxHp = maxHp <= 0 || currentHp >= maxHp;
        const canUse =
            owned > 0 &&
            usedInRun < useLimit &&
            usedInBattle < HUNTING_CONSUMABLE_USE_LIMIT.maxUsesPerBattle &&
            !atMaxHp;
        const disabledReason =
            owned <= 0
                ? "보유 물약 없음"
                : usedInRun >= useLimit
                  ? "원정 사용 한도 도달"
                  : usedInBattle >= HUNTING_CONSUMABLE_USE_LIMIT.maxUsesPerBattle
                    ? "이번 전투에서 사용 완료"
                    : atMaxHp
                      ? "HP가 이미 최대입니다"
                      : "";
        return {
            id: definition.id,
            label: definition.label,
            description: definition.description,
            owned,
            maxOwned: definition.maxOwned,
            usedInRun,
            useLimit,
            usedInBattle,
            maxUsesPerBattle: HUNTING_CONSUMABLE_USE_LIMIT.maxUsesPerBattle,
            healAmount,
            healPercent: Math.round(definition.effect.value * 100),
            canUse,
            disabledReason
        };
    });
}

export function useHuntingPreparationConsumable(profile, run, consumableId) {
    const consumable = getHuntingPreparationConsumables(profile, run).find((item) => item.id === consumableId);
    if (!consumable || !consumable.canUse) return null;

    const consumables = ensureConsumables(profile);
    const health = getHuntingRunHealth(run);
    const nextHp = Math.min(health.maxHp, health.hp + consumable.healAmount);
    consumables.owned[consumableId] -= 1;
    return {
        run: {
            ...setHuntingRunActiveHealth(run, { hp: nextHp, maxHp: health.maxHp }),
            consumableUses: {
                ...(run.consumableUses ?? {}),
                [consumableId]: Math.max(0, Math.floor(run.consumableUses?.[consumableId] ?? 0)) + 1
            },
            battleConsumableUses: {
                ...(run.battleConsumableUses ?? {}),
                [consumableId]: Math.max(0, Math.floor(run.battleConsumableUses?.[consumableId] ?? 0)) + 1
            },
            history: [
                ...(run.history ?? []),
                {
                    type: "consumable_use",
                    consumableId,
                    floor: run.floor,
                    healed: nextHp - health.hp,
                    hpRemain: nextHp
                }
            ]
        },
        result: {
            consumableId,
            label: consumable.label,
            healed: nextHp - health.hp,
            hpRemain: nextHp,
            maxHp: health.maxHp,
            owned: consumables.owned[consumableId],
            usedInRun: consumable.usedInRun + 1,
            useLimit: consumable.useLimit
        }
    };
}
import { getHuntingRunHealth, setHuntingRunActiveHealth } from "./hunting/huntingState.js";
