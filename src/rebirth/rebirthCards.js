import { getAbilityDisplayName } from "../abilities/abilityMetadata.js";
import {
    CHARACTER_DEFINITIONS,
    getCharacterDefinition,
    getCharacterDefinitionByAbility
} from "../characters/characterRegistry.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { isRebirthActionAvailable } from "../characterAvailability.js";

const REBIRTH_BALANCE = REWARD_BALANCE.rebirth;
const RARE_EQUIPMENT_STAT_RANGE = REWARD_BALANCE.equipment.statRanges.rare;
const EQUIPMENT_STAT_VALUE_RATIOS = REWARD_BALANCE.equipment.statValueRatios;
const STAT_LABELS = Object.freeze({ hp: "HP", damage: "공격", speed: "속도", defense: "방어력" });

export const REBIRTH_BASE_STAT_KEYS = Object.freeze(["hp", "damage", "speed", "defense"]);
export const REBIRTH_MAX_CARD_RANK = REBIRTH_BALANCE.maxCardRank;
export const REBIRTH_MAX_EQUIPPED_CARDS = REBIRTH_BALANCE.maxEquippedCards;
export const REBIRTH_OFFER_SIZE = REBIRTH_BALANCE.offerSize;

export function getRebirthFighter(characterId) {
    return getCharacterDefinition(characterId)?.roster ?? null;
}

export function getSubAbilityIds(characterId, profile = null, options = {}) {
    const ownAbilityId = getRebirthFighter(characterId)?.ability;
    const availableOnly = options.availableOnly !== false;
    return CHARACTER_DEFINITIONS.filter((definition) => definition.rebirth.actionEligible !== false)
        .filter((definition) => !availableOnly || isRebirthActionAvailable(profile, definition.id))
        .map((definition) => definition.abilityId)
        .filter((abilityId) => abilityId !== ownAbilityId)
        .filter((abilityId, index, ids) => ids.indexOf(abilityId) === index);
}

function normalizeOwnedRank(rank) {
    return Math.max(0, Math.min(REBIRTH_MAX_CARD_RANK, Math.floor(rank || 0)));
}

function normalizeRank(rank) {
    return Math.max(1, normalizeOwnedRank(rank));
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
        const growth = card.growth[normalizedRank - 1];
        return {
            stats: {},
            modifiers: {},
            passiveModifiers: {},
            abilityTier: normalizedRank - 1,
            effectText: `Lv.${growth.level} ${growth.gameText}`
        };
    }

    const passive = REBIRTH_BALANCE.passiveCardRanks.globalCooldown;
    const reductionPercent = passive.reductionPercents[normalizedRank - 1];
    return {
        stats: {},
        modifiers: {},
        reductionPercent,
        passiveModifiers: {
            abilityCooldownMultiplier: (100 - reductionPercent) / 100
        },
        effectText: `전체 능력 쿨타임 -${reductionPercent}%`
    };
}

function createActionCard(characterId, abilityId, profile) {
    if (!getSubAbilityIds(characterId, profile, { availableOnly: false }).includes(abilityId)) return null;
    const character = getCharacterDefinitionByAbility(abilityId);
    if (!character) return null;
    const name = getAbilityDisplayName(abilityId);
    return Object.freeze({
        id: getActionCardId(abilityId),
        type: "action",
        categoryLabel: "액션",
        name: `${name} 호출`,
        description: `${name} 능력을 독립 쿨타임으로 사용합니다. 단계마다 원래 성장 능력을 해금합니다.`,
        effectText: "원래 캐릭터 성장 해금",
        abilityId,
        growth: character.abilityGrowth,
        subAction: character.rebirth.subAction,
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
        description: "장착하면 모든 능력의 쿨타임을 줄입니다. 단계마다 감소량이 증가합니다.",
        effectText: "전체 능력 쿨타임 감소",
        weight: REBIRTH_BALANCE.candidateWeights.passive,
        getRankEffect(rank) {
            return getCardRankEffect(this, rank);
        }
    });
}

export function getRebirthCardCatalog(characterId, profile = null, options = {}) {
    if (!getRebirthFighter(characterId)) return [];
    const availableOnly = options.availableOnly !== false;
    return [
        ...getSubAbilityIds(characterId, profile, { availableOnly })
            .map((abilityId) => createActionCard(characterId, abilityId, profile))
            .filter(Boolean),
        createPassiveCooldownCard()
    ];
}

export function getRebirthCardDefinition(characterId, cardId) {
    return (
        getRebirthCardCatalog(characterId, null, { availableOnly: false }).find((card) => card.id === cardId) ?? null
    );
}

export function getAvailableRebirthCardDefinition(profile, characterId, cardId) {
    return getRebirthCardCatalog(characterId, profile).find((card) => card.id === cardId) ?? null;
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

export function getRebirthOfferDefinition(characterId, offer, profile = null) {
    if (typeof offer === "string") return getAvailableRebirthCardDefinition(profile, characterId, offer);
    const material = normalizeRebirthOfferMaterial(characterId, offer);
    if (!material) return null;
    if (material.type === "statReward") return createStatRewardFromMaterial(material);
    return getAvailableRebirthCardDefinition(profile, characterId, material.id);
}

export function getRebirthOfferMaterial(characterId, offer, profile = null) {
    if (typeof offer === "string") {
        const card = getAvailableRebirthCardDefinition(profile, characterId, offer);
        return card ? { id: card.id, type: card.type } : null;
    }
    return normalizeRebirthOfferMaterial(characterId, offer);
}

export function getRebirthCardView(characterId, cardId, rank = 0, equippedCardIds = [], profile = null) {
    const card = profile
        ? getAvailableRebirthCardDefinition(profile, characterId, cardId)
        : getRebirthCardDefinition(characterId, cardId);
    if (!card) return null;
    const normalizedRank = normalizeOwnedRank(rank);
    const effect = card.getRankEffect(Math.max(1, normalizedRank));
    return {
        id: card.id,
        type: card.type,
        categoryLabel: card.categoryLabel,
        name: card.name,
        description: card.description,
        effectText: effect.effectText ?? card.effectText,
        rank: normalizedRank,
        rankLabel:
            normalizedRank >= REBIRTH_MAX_CARD_RANK
                ? `MAX · 단계 ${REBIRTH_MAX_CARD_RANK}/${REBIRTH_MAX_CARD_RANK}`
                : `단계 ${normalizedRank || 1}/${REBIRTH_MAX_CARD_RANK}`,
        maxRank: REBIRTH_MAX_CARD_RANK,
        isMax: normalizedRank >= REBIRTH_MAX_CARD_RANK,
        nextUnlockText:
            card.type === "action" && normalizedRank < REBIRTH_MAX_CARD_RANK
                ? `다음: Lv.${card.growth[normalizedRank].level} ${card.growth[normalizedRank].gameText}`
                : null,
        equipped: equippedCardIds.includes(card.id),
        stats: effect.stats,
        modifiers: effect.modifiers,
        passiveModifiers: effect.passiveModifiers,
        abilityId: card.abilityId ?? null
    };
}

export function getRebirthOfferView(characterId, offer, rank = 0, equippedCardIds = [], profile = null) {
    const reward = getRebirthOfferDefinition(characterId, offer, profile);
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
    return getRebirthCardView(
        characterId,
        reward.id,
        Math.min(REBIRTH_MAX_CARD_RANK, normalizeOwnedRank(rank) + 1),
        equippedCardIds,
        profile
    );
}
