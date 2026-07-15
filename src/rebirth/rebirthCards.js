import { getAbilityDisplayName } from "../abilities/abilityMetadata.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createRoster } from "../roster.js";

const REBIRTH_BALANCE = REWARD_BALANCE.rebirth;
const RARE_EQUIPMENT_STAT_RANGE = REWARD_BALANCE.equipment.statRanges.rare;
const EQUIPMENT_STAT_VALUE_RATIOS = REWARD_BALANCE.equipment.statValueRatios;
const ROSTER_BY_ID = new Map(createRoster().map((fighter) => [fighter.id, fighter]));
const STAT_LABELS = Object.freeze({ hp: "HP", damage: "공격", speed: "속도", defense: "방어력" });
const SUB_ABILITY_EFFECT_LABELS = Object.freeze({
    archer: "유도 속도",
    orbit: "위성 충전 속도",
    trickster: "씨앗 속도",
    grenade: "수류탄 피해",
    dash: "대시 배율",
    rage: "최대 충돌 수치",
    spin: "충돌 후 회전력 유지",
    eater: "뱉기 회전 충격",
    bat_ball: "방망이 판정 거리",
    vampire: "박쥐 속도",
    gunner: "탄속",
    phantom: "그림자 공격 피해",
    hero: "오브 자석 범위"
});

export const REBIRTH_BASE_STAT_KEYS = Object.freeze(["hp", "damage", "speed", "defense"]);
export const REBIRTH_MAX_CARD_RANK = REBIRTH_BALANCE.maxCardRank;
export const REBIRTH_MAX_EQUIPPED_CARDS = REBIRTH_BALANCE.maxEquippedCards;
export const REBIRTH_OFFER_SIZE = REBIRTH_BALANCE.offerSize;

export function getRebirthFighter(characterId) {
    return ROSTER_BY_ID.get(characterId) ?? null;
}

export function getSubAbilityIds(characterId) {
    const ownAbilityId = getRebirthFighter(characterId)?.ability;
    return [...ROSTER_BY_ID.values()]
        .map((fighter) => fighter.ability)
        .filter((abilityId) => abilityId !== ownAbilityId)
        .filter((abilityId, index, ids) => ids.indexOf(abilityId) === index);
}

function normalizeRank(rank) {
    return Math.max(1, Math.min(REBIRTH_MAX_CARD_RANK, Math.floor(rank || 1)));
}

function normalizeRandomValue(rng) {
    const value = rng();
    return Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0));
}

function rollRareEquipmentStatValue(stat, rng) {
    const ratio = EQUIPMENT_STAT_VALUE_RATIOS[stat];
    const baseValue =
        RARE_EQUIPMENT_STAT_RANGE.min +
        Math.floor(normalizeRandomValue(rng) * (RARE_EQUIPMENT_STAT_RANGE.max - RARE_EQUIPMENT_STAT_RANGE.min + 1));
    return baseValue * ratio;
}

function getCanonicalStatEntries(stats) {
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) return null;
    const entries = Object.entries(stats);
    if (entries.length !== 2) return null;

    const normalized = REBIRTH_BASE_STAT_KEYS.filter((stat) => Object.hasOwn(stats, stat)).map((stat) => [
        stat,
        stats[stat]
    ]);
    if (normalized.length !== 2) return null;

    for (const [stat, value] of normalized) {
        const ratio = EQUIPMENT_STAT_VALUE_RATIOS[stat];
        const minimum = RARE_EQUIPMENT_STAT_RANGE.min * ratio;
        const maximum = RARE_EQUIPMENT_STAT_RANGE.max * ratio;
        if (!Number.isInteger(value) || value < minimum || value > maximum || value % ratio !== 0) return null;
    }
    return normalized;
}

function getStatRewardId(offerSlot, statEntries) {
    return `rebirth-stat:${offerSlot}:${statEntries.map(([stat, value]) => `${stat}-${value}`).join(":")}`;
}

function createStatRewardFromMaterial(material) {
    if (!material || material.type !== "statReward" || !Number.isInteger(material.offerSlot)) return null;
    if (material.offerSlot < 0 || material.offerSlot >= REBIRTH_OFFER_SIZE) return null;
    const statEntries = getCanonicalStatEntries(material.stats);
    if (!statEntries || material.id !== getStatRewardId(material.offerSlot, statEntries)) return null;
    const stats = Object.freeze(Object.fromEntries(statEntries));
    return Object.freeze({
        id: material.id,
        type: "statReward",
        categoryLabel: "기초 수치",
        name: "희귀 기초 수치",
        description: "희귀 장비와 같은 가치 기준의 무작위 두 기초 수치를 즉시 누적합니다.",
        effectText: statEntries.map(([stat, value]) => `${STAT_LABELS[stat]} +${value}`).join(" · "),
        stats,
        offerSlot: material.offerSlot,
        weight: REBIRTH_BALANCE.candidateWeights.stat
    });
}

export function createRebirthStatReward(offerSlot, rng = Math.random) {
    if (!Number.isInteger(offerSlot) || offerSlot < 0 || offerSlot >= REBIRTH_OFFER_SIZE) return null;
    const availableStats = [...REBIRTH_BASE_STAT_KEYS];
    const selectedStats = [];
    while (selectedStats.length < 2) {
        const selectedIndex = Math.floor(normalizeRandomValue(rng) * availableStats.length);
        selectedStats.push(availableStats.splice(selectedIndex, 1)[0]);
    }
    const statEntries = REBIRTH_BASE_STAT_KEYS.filter((stat) => selectedStats.includes(stat)).map((stat) => [
        stat,
        rollRareEquipmentStatValue(stat, rng)
    ]);
    return createStatRewardFromMaterial({
        id: getStatRewardId(offerSlot, statEntries),
        type: "statReward",
        offerSlot,
        stats: Object.fromEntries(statEntries)
    });
}

function getActionCardId(abilityId) {
    return `ability:${abilityId}`;
}

function getPassiveCooldownCardId() {
    return "passive:global-cooldown";
}

function getCardRankEffect(card, rank) {
    const normalizedRank = normalizeRank(rank);
    if (card.type === "action") {
        const modifier = REBIRTH_BALANCE.subAbilityRankModifiers[card.abilityId];
        return {
            stats: {},
            modifiers: {
                [modifier.key]: modifier.base + modifier.perRank * normalizedRank
            },
            passiveModifiers: {}
        };
    }

    const passive = REBIRTH_BALANCE.passiveCardRanks.globalCooldown;
    const reductionPercent = Math.min(
        passive.maximumReductionPercent,
        passive.baseReductionPercent + passive.perRankReductionPercent * (normalizedRank - 1)
    );
    return {
        stats: {},
        modifiers: {},
        passiveModifiers: {
            abilityCooldownMultiplier: (100 - reductionPercent) / 100
        },
        effectText: `전체 능력 쿨타임 -${reductionPercent}%`
    };
}

function createActionCard(characterId, abilityId) {
    if (!getSubAbilityIds(characterId).includes(abilityId)) return null;
    const modifier = REBIRTH_BALANCE.subAbilityRankModifiers[abilityId];
    if (!modifier) return null;
    const name = getAbilityDisplayName(abilityId);
    return Object.freeze({
        id: getActionCardId(abilityId),
        type: "action",
        categoryLabel: "액션",
        name: `${name} 호출`,
        description: `${name} 능력을 독립 쿨타임으로 사용합니다. 중복 선택하면 기존 수치가 강화됩니다.`,
        effectText: `등급마다 ${SUB_ABILITY_EFFECT_LABELS[abilityId] ?? "능력 수치"} 강화`,
        abilityId,
        weight: REBIRTH_BALANCE.candidateWeights.action,
        getRankEffect(rank) {
            return getCardRankEffect(this, rank);
        }
    });
}

function createPassiveCooldownCard() {
    return Object.freeze({
        id: getPassiveCooldownCardId(),
        type: "passive",
        categoryLabel: "패시브",
        name: "냉각 회로",
        description: "장착하면 모든 능력의 쿨타임을 줄입니다. 중복 선택하면 감소량이 강화됩니다.",
        effectText: "전체 능력 쿨타임 감소",
        weight: REBIRTH_BALANCE.candidateWeights.passive,
        getRankEffect(rank) {
            return getCardRankEffect(this, rank);
        }
    });
}

export function getRebirthCardCatalog(characterId) {
    if (!getRebirthFighter(characterId)) return [];
    return [
        ...getSubAbilityIds(characterId)
            .map((abilityId) => createActionCard(characterId, abilityId))
            .filter(Boolean),
        createPassiveCooldownCard()
    ];
}

export function getRebirthCardDefinition(characterId, cardId) {
    return getRebirthCardCatalog(characterId).find((card) => card.id === cardId) ?? null;
}

export function isValidRebirthCardId(characterId, cardId) {
    return typeof cardId === "string" && Boolean(getRebirthCardDefinition(characterId, cardId));
}

export function normalizeRebirthOfferMaterial(characterId, material) {
    if (!material || typeof material !== "object" || typeof material.id !== "string") return null;
    if (material.type === "statReward") {
        const reward = createStatRewardFromMaterial(material);
        return reward
            ? {
                  id: reward.id,
                  type: reward.type,
                  offerSlot: reward.offerSlot,
                  stats: { ...reward.stats }
              }
            : null;
    }
    const card = getRebirthCardDefinition(characterId, material.id);
    if (!card || card.type !== material.type) return null;
    return { id: card.id, type: card.type };
}

export function getRebirthOfferDefinition(characterId, offer) {
    if (typeof offer === "string") return getRebirthCardDefinition(characterId, offer);
    const material = normalizeRebirthOfferMaterial(characterId, offer);
    if (!material) return null;
    if (material.type === "statReward") return createStatRewardFromMaterial(material);
    return getRebirthCardDefinition(characterId, material.id);
}

export function getRebirthOfferMaterial(characterId, offer) {
    if (typeof offer === "string") {
        const card = getRebirthCardDefinition(characterId, offer);
        return card ? { id: card.id, type: card.type } : null;
    }
    return normalizeRebirthOfferMaterial(characterId, offer);
}

export function getRebirthCardView(characterId, cardId, rank = 0, equippedCardIds = []) {
    const card = getRebirthCardDefinition(characterId, cardId);
    if (!card) return null;
    const normalizedRank = Math.max(0, Math.min(REBIRTH_MAX_CARD_RANK, Math.floor(rank || 0)));
    const effect = card.getRankEffect(Math.max(1, normalizedRank));
    return {
        id: card.id,
        type: card.type,
        categoryLabel: card.categoryLabel,
        name: card.name,
        description: card.description,
        effectText: effect.effectText ?? card.effectText,
        rank: normalizedRank,
        rankLabel: `등급 ${normalizedRank || 1}`,
        equipped: equippedCardIds.includes(card.id),
        stats: effect.stats,
        modifiers: effect.modifiers,
        passiveModifiers: effect.passiveModifiers,
        abilityId: card.abilityId ?? null
    };
}

export function getRebirthOfferView(characterId, offer, rank = 0, equippedCardIds = []) {
    const reward = getRebirthOfferDefinition(characterId, offer);
    if (!reward) return null;
    if (reward.type === "statReward") {
        return {
            ...reward,
            rank: 0,
            rankLabel: null,
            equipped: false,
            modifiers: {},
            passiveModifiers: {},
            abilityId: null
        };
    }
    return getRebirthCardView(characterId, reward.id, rank, equippedCardIds);
}
