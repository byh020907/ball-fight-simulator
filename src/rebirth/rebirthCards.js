import { getAbilityDisplayName } from "../abilities/abilityMetadata.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createRoster } from "../roster.js";

const REBIRTH_BALANCE = REWARD_BALANCE.rebirth;
const ROSTER_BY_ID = new Map(createRoster().map((fighter) => [fighter.id, fighter]));
const STAT_LABELS = Object.freeze({ hp: "HP", damage: "공격", speed: "속도", defense: "방어력" });
const STAT_VARIANTS = Object.freeze(["balanced", "primary", "secondary"]);
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

export function getRebirthStatPair(characterId) {
    const pair = REBIRTH_BALANCE.statPairs[characterId];
    return Array.isArray(pair) && pair.length === 2 && pair.every((stat) => REBIRTH_BASE_STAT_KEYS.includes(stat))
        ? pair
        : null;
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

function getStatRewardId(characterId, variant) {
    return `rebirth-stat:${characterId}:${variant}`;
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

function createStatReward(characterId, variant) {
    const statPair = getRebirthStatPair(characterId);
    if (!statPair || !STAT_VARIANTS.includes(variant)) return null;
    const [primaryStat, secondaryStat] = statPair;
    const values = REBIRTH_BALANCE.statRewardValues[variant];
    const stats = Object.freeze({
        [primaryStat]: values.primary,
        [secondaryStat]: values.secondary
    });
    const label =
        variant === "balanced"
            ? `${STAT_LABELS[primaryStat]} · ${STAT_LABELS[secondaryStat]} 공명`
            : `${STAT_LABELS[variant === "primary" ? primaryStat : secondaryStat]} 집중`;
    const effectText = Object.entries(stats)
        .filter(([, value]) => value > 0)
        .map(([stat, value]) => `${STAT_LABELS[stat]} +${value}`)
        .join(" · ");
    return Object.freeze({
        id: getStatRewardId(characterId, variant),
        type: "statReward",
        categoryLabel: "기초 수치",
        name: label,
        description: "선택 즉시 캐릭터의 영구 기초 수치에 누적됩니다.",
        effectText,
        stats,
        weight: REBIRTH_BALANCE.candidateWeights.stat
    });
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

export function getRebirthStatRewardCatalog(characterId) {
    if (!getRebirthFighter(characterId)) return [];
    return STAT_VARIANTS.map((variant) => createStatReward(characterId, variant)).filter(Boolean);
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

export function getRebirthOfferCatalog(characterId) {
    return [...getRebirthStatRewardCatalog(characterId), ...getRebirthCardCatalog(characterId)];
}

export function getRebirthCardDefinition(characterId, cardId) {
    return getRebirthCardCatalog(characterId).find((card) => card.id === cardId) ?? null;
}

export function getRebirthStatRewardDefinition(characterId, rewardId) {
    return getRebirthStatRewardCatalog(characterId).find((reward) => reward.id === rewardId) ?? null;
}

export function getRebirthOfferDefinition(characterId, offerId) {
    return getRebirthStatRewardDefinition(characterId, offerId) ?? getRebirthCardDefinition(characterId, offerId);
}

export function isValidRebirthCardId(characterId, cardId) {
    return typeof cardId === "string" && Boolean(getRebirthCardDefinition(characterId, cardId));
}

export function isValidRebirthOfferId(characterId, offerId) {
    return typeof offerId === "string" && Boolean(getRebirthOfferDefinition(characterId, offerId));
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

export function getRebirthOfferView(characterId, offerId, rank = 0, equippedCardIds = []) {
    const reward = getRebirthStatRewardDefinition(characterId, offerId);
    if (reward) {
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
    return getRebirthCardView(characterId, offerId, rank, equippedCardIds);
}
