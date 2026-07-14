import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createRoster } from "../roster.js";
import { getAbilityDisplayName } from "../abilities/abilityMetadata.js";

const REBIRTH_BALANCE = REWARD_BALANCE.rebirth;
const ROSTER_BY_ID = new Map(createRoster().map((fighter) => [fighter.id, fighter]));
const STAT_LABELS = Object.freeze({ hp: "HP", damage: "공격", speed: "속도", skill: "스킬", defense: "방어력" });
const STAT_VARIANTS = Object.freeze(["balanced", "primary", "secondary"]);
const SUB_ABILITY_EFFECT_LABELS = Object.freeze({
    archer: "화살 속도",
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
    phantom: "그림자 일격 피해",
    hero: "오브 자석 범위"
});

export const REBIRTH_MAX_CARD_RANK = REBIRTH_BALANCE.maxCardRank;
export const REBIRTH_MAX_EQUIPPED_CARDS = REBIRTH_BALANCE.maxEquippedCards;
export const REBIRTH_OFFER_SIZE = REBIRTH_BALANCE.offerSize;

export function getRebirthFighter(characterId) {
    return ROSTER_BY_ID.get(characterId) ?? null;
}

export function getRebirthStatPair(characterId) {
    const pair = REBIRTH_BALANCE.statPairs[characterId];
    return Array.isArray(pair) && pair.length === 2 ? pair : null;
}

export function getSubAbilityIds(characterId) {
    const ownAbilityId = getRebirthFighter(characterId)?.ability;
    return [...ROSTER_BY_ID.values()]
        .map((fighter) => fighter.ability)
        .filter((abilityId) => abilityId !== ownAbilityId)
        .filter((abilityId, index, ids) => ids.indexOf(abilityId) === index);
}

function getStatCardId(characterId, variant) {
    return `stat:${characterId}:${variant}`;
}

function getSubAbilityCardId(abilityId) {
    return `ability:${abilityId}`;
}

function getCardRankEffect(card, rank) {
    const normalizedRank = Math.max(1, Math.min(REBIRTH_MAX_CARD_RANK, Math.floor(rank || 1)));
    if (card.type === "stat") {
        const values = REBIRTH_BALANCE.statCardRanks[card.variant];
        const [primaryStat, secondaryStat] = card.statPair;
        return {
            stats: {
                [primaryStat]: values.primary + values.perRank * (normalizedRank - 1),
                [secondaryStat]: values.secondary + values.perRank * (normalizedRank - 1)
            },
            modifiers: {}
        };
    }

    const modifier = REBIRTH_BALANCE.subAbilityRankModifiers[card.abilityId];
    return {
        stats: {},
        modifiers: {
            [modifier.key]: modifier.base + modifier.perRank * normalizedRank
        }
    };
}

function createStatCard(characterId, variant) {
    const statPair = getRebirthStatPair(characterId);
    if (!statPair || !STAT_VARIANTS.includes(variant)) return null;
    const [primaryStat, secondaryStat] = statPair;
    const values = REBIRTH_BALANCE.statCardRanks[variant];
    const label =
        variant === "balanced"
            ? `${STAT_LABELS[primaryStat]} · ${STAT_LABELS[secondaryStat]} 공명`
            : `${STAT_LABELS[variant === "primary" ? primaryStat : secondaryStat]} 집중`;
    const initialEffect = getCardRankEffect({ type: "stat", variant, statPair }, 1).stats;
    const effectText = Object.entries(initialEffect)
        .filter(([, value]) => value > 0)
        .map(([stat, value]) => `${STAT_LABELS[stat]} +${value}`)
        .join(" · ");
    return {
        id: getStatCardId(characterId, variant),
        type: "stat",
        categoryLabel: "스탯",
        name: label,
        description: `${effectText}. 등급마다 허용 스탯 수치가 증가합니다.`,
        effectText,
        characterId,
        variant,
        statPair,
        weight: REBIRTH_BALANCE.candidateWeights.stat,
        getRankEffect(rank) {
            return getCardRankEffect(this, rank);
        }
    };
}

function createSubAbilityCard(characterId, abilityId) {
    if (!getSubAbilityIds(characterId).includes(abilityId)) return null;
    const modifier = REBIRTH_BALANCE.subAbilityRankModifiers[abilityId];
    if (!modifier) return null;
    const name = getAbilityDisplayName(abilityId);
    return {
        id: getSubAbilityCardId(abilityId),
        type: "subAbility",
        categoryLabel: "서브 스킬",
        name: `${name} 호출`,
        description: `${name} 능력을 독립 쿨다운으로 사용합니다. 등급은 기존 수치만 강화합니다.`,
        effectText: `등급당 ${SUB_ABILITY_EFFECT_LABELS[abilityId] ?? "능력 수치"} 강화`,
        abilityId,
        weight: REBIRTH_BALANCE.candidateWeights.subAbility,
        getRankEffect(rank) {
            return getCardRankEffect(this, rank);
        }
    };
}

export function getRebirthCardCatalog(characterId) {
    if (!getRebirthFighter(characterId)) return [];
    return [
        ...STAT_VARIANTS.map((variant) => createStatCard(characterId, variant)).filter(Boolean),
        ...getSubAbilityIds(characterId)
            .map((abilityId) => createSubAbilityCard(characterId, abilityId))
            .filter(Boolean)
    ];
}

export function getRebirthCardDefinition(characterId, cardId) {
    return getRebirthCardCatalog(characterId).find((card) => card.id === cardId) ?? null;
}

export function isValidRebirthCardId(characterId, cardId) {
    return typeof cardId === "string" && Boolean(getRebirthCardDefinition(characterId, cardId));
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
        effectText: card.effectText,
        rank: normalizedRank,
        rankLabel: `등급 ${normalizedRank || 1}`,
        equipped: equippedCardIds.includes(card.id),
        stats: effect.stats,
        modifiers: effect.modifiers,
        abilityId: card.abilityId ?? null
    };
}
