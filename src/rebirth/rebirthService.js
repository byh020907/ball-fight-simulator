import { MAX_LEVEL } from "../experience/experienceConfig.js";
import { getCharacterExperienceSummary, resetCharacterExperience } from "../experience/experienceService.js";
import {
    REBIRTH_BASE_STAT_KEYS,
    getRebirthCardDefinition,
    getRebirthCardView,
    getRebirthFighter,
    getRebirthOfferCatalog,
    getRebirthOfferDefinition,
    getRebirthOfferView,
    isValidRebirthOfferId,
    REBIRTH_MAX_CARD_RANK,
    REBIRTH_MAX_EQUIPPED_CARDS,
    REBIRTH_OFFER_SIZE
} from "./rebirthCards.js";
import { getRebirthVisualProfile } from "./rebirthVisuals.js";

const EMPTY_STAT_BONUSES = Object.freeze(Object.fromEntries(REBIRTH_BASE_STAT_KEYS.map((stat) => [stat, 0])));
const EMPTY_REBIRTH_STATE = Object.freeze({
    rebirthCount: 0,
    statBonuses: EMPTY_STAT_BONUSES,
    cardRanks: {},
    equippedCardIds: [],
    pendingOfferCardIds: []
});

function normalizeRank(value) {
    return Math.max(0, Math.min(REBIRTH_MAX_CARD_RANK, Math.floor(Number.isFinite(value) ? value : 0)));
}

function getStateRecord(profile, characterId) {
    return profile?.rebirth?.byCharacter?.[characterId] ?? EMPTY_REBIRTH_STATE;
}

function normalizeStatBonuses(statBonuses) {
    return Object.fromEntries(
        REBIRTH_BASE_STAT_KEYS.map((stat) => [
            stat,
            Math.max(0, Number.isFinite(statBonuses?.[stat]) ? statBonuses[stat] : 0)
        ])
    );
}

function hasStatBonuses(statBonuses) {
    return Object.values(statBonuses).some((value) => value > 0);
}

function ensureRebirthState(profile, characterId) {
    profile.rebirth ||= { byCharacter: {} };
    profile.rebirth.byCharacter ||= {};
    const current = getStateRecord(profile, characterId);
    const next = {
        rebirthCount: Math.max(0, Math.floor(current.rebirthCount ?? 0)),
        statBonuses: normalizeStatBonuses(current.statBonuses),
        cardRanks: { ...(current.cardRanks ?? {}) },
        equippedCardIds: [...(current.equippedCardIds ?? [])],
        pendingOfferCardIds: [...(current.pendingOfferCardIds ?? [])]
    };
    profile.rebirth.byCharacter[characterId] = next;
    return next;
}

function weightedPick(cards, rng) {
    const total = cards.reduce((sum, card) => sum + card.weight, 0);
    let cursor = Math.max(0, Math.min(0.999999999, rng())) * total;
    for (const card of cards) {
        cursor -= card.weight;
        if (cursor <= 0) return card;
    }
    return cards[cards.length - 1];
}

export function createRebirthOffer(characterId, rng = Math.random) {
    const catalog = getRebirthOfferCatalog(characterId);
    const pool = [...catalog];
    const offer = [];
    while (pool.length > 0 && offer.length < REBIRTH_OFFER_SIZE) {
        const selected = weightedPick(pool, rng);
        offer.push(selected);
        pool.splice(pool.indexOf(selected), 1);
    }
    return offer;
}

export function getRebirthState(profile, characterId) {
    const state = getStateRecord(profile, characterId);
    const cardRanks = Object.fromEntries(
        Object.entries(state.cardRanks ?? {}).filter(([cardId, rank]) => {
            return getRebirthCardDefinition(characterId, cardId) && normalizeRank(rank) > 0;
        })
    );
    const equippedCardIds = [...new Set(state.equippedCardIds ?? [])]
        .filter((cardId) => cardRanks[cardId] && getRebirthCardDefinition(characterId, cardId))
        .slice(0, REBIRTH_MAX_EQUIPPED_CARDS);
    const pendingOfferCardIds = [...new Set(state.pendingOfferCardIds ?? [])]
        .filter((cardId) => isValidRebirthOfferId(characterId, cardId))
        .slice(0, REBIRTH_OFFER_SIZE);
    return {
        rebirthCount: Math.max(0, Math.floor(state.rebirthCount ?? 0)),
        statBonuses: normalizeStatBonuses(state.statBonuses),
        cardRanks,
        equippedCardIds,
        pendingOfferCardIds
    };
}

export function canRebirth(profile, characterId) {
    const fighter = getRebirthFighter(characterId);
    const experience = getCharacterExperienceSummary(profile, characterId);
    return Boolean(fighter && experience.level >= MAX_LEVEL);
}

export function beginRebirth(profile, characterId, rng = Math.random) {
    if (!canRebirth(profile, characterId)) return { ok: false, error: "not_eligible", cards: [] };
    const state = ensureRebirthState(profile, characterId);
    const validPending = state.pendingOfferCardIds
        .map((cardId) => getRebirthOfferDefinition(characterId, cardId))
        .filter(Boolean);
    const offers = validPending.length === REBIRTH_OFFER_SIZE ? validPending : createRebirthOffer(characterId, rng);
    state.pendingOfferCardIds = offers.map((offer) => offer.id);
    return {
        ok: true,
        cards: state.pendingOfferCardIds.map((cardId) => getRebirthOfferDefinition(characterId, cardId))
    };
}

export function completeRebirth(profile, characterId, cardId) {
    if (!canRebirth(profile, characterId)) return { ok: false, error: "not_eligible" };
    const state = ensureRebirthState(profile, characterId);
    if (!state.pendingOfferCardIds.includes(cardId)) return { ok: false, error: "invalid_offer" };
    const reward = getRebirthOfferDefinition(characterId, cardId);
    if (!reward) return { ok: false, error: "invalid_offer" };

    const previousRank = normalizeRank(state.cardRanks[cardId]);
    const isStatReward = reward.type === "statReward";
    const rank = isStatReward ? 0 : Math.min(REBIRTH_MAX_CARD_RANK, previousRank + 1);
    if (isStatReward) {
        for (const [stat, value] of Object.entries(reward.stats)) state.statBonuses[stat] += value;
    } else {
        state.cardRanks[cardId] = rank;
    }
    state.rebirthCount += 1;
    state.pendingOfferCardIds = [];
    const experience = resetCharacterExperience(profile, characterId);
    return {
        ok: true,
        reward,
        rank,
        duplicate: !isStatReward && previousRank > 0,
        rebirthCount: state.rebirthCount,
        statBonuses: { ...state.statBonuses },
        experience
    };
}

export function toggleRebirthCardEquip(profile, characterId, cardId) {
    const state = ensureRebirthState(profile, characterId);
    if (!getRebirthCardDefinition(characterId, cardId) || normalizeRank(state.cardRanks[cardId]) <= 0) {
        return { ok: false, error: "not_owned" };
    }
    if (state.equippedCardIds.includes(cardId)) {
        state.equippedCardIds = state.equippedCardIds.filter((id) => id !== cardId);
        return { ok: true, equipped: false, equippedCardIds: [...state.equippedCardIds] };
    }
    if (state.equippedCardIds.length >= REBIRTH_MAX_EQUIPPED_CARDS) return { ok: false, error: "equip_limit" };
    state.equippedCardIds.push(cardId);
    return { ok: true, equipped: true, equippedCardIds: [...state.equippedCardIds] };
}

export function getRebirthLoadout(profile, characterId) {
    const state = getRebirthState(profile, characterId);
    const statBonuses = { ...state.statBonuses };
    const subAbilities = [];
    const passiveModifiers = { abilityCooldownMultiplier: 1 };
    for (const cardId of state.equippedCardIds) {
        const card = getRebirthCardDefinition(characterId, cardId);
        const rank = state.cardRanks[cardId];
        if (!card || rank <= 0) continue;
        const effect = card.getRankEffect(rank);
        if (card.type === "action") {
            subAbilities.push({
                cardId,
                abilityId: card.abilityId,
                rank,
                displayName: card.name,
                modifiers: effect.modifiers
            });
        }
        if (card.type === "passive") {
            passiveModifiers.abilityCooldownMultiplier *= effect.passiveModifiers?.abilityCooldownMultiplier ?? 1;
        }
    }
    return {
        characterId,
        rebirthCount: state.rebirthCount,
        statBonuses,
        subAbilities,
        passiveModifiers,
        visual: getRebirthVisualProfile(state.rebirthCount)
    };
}

export function applyRebirthLoadoutToBaseSpec(spec, loadout) {
    if (!loadout) return spec;
    const stats = { ...spec.stats };
    for (const [stat, value] of Object.entries(loadout.statBonuses)) {
        if (Number.isFinite(stats[stat]) && Number.isFinite(value)) stats[stat] += value;
    }
    return { ...spec, stats, rebirthCount: loadout.rebirthCount };
}

export function applyRebirthLoadoutToBattleBall(ball, simulation, loadout) {
    if (!ball || !simulation || !loadout) return;
    ball.rebirthCount = loadout.rebirthCount;
    ball.rebirthEffects = {
        ...ball.rebirthEffects,
        abilityCooldownMultiplier: loadout.passiveModifiers?.abilityCooldownMultiplier ?? 1
    };
    for (const subAbility of loadout.subAbilities) {
        const ability = simulation.createAbility(subAbility.abilityId, ball, {
            role: "sub",
            abilityTier: 0,
            instanceKey: `rebirth:${subAbility.cardId}`,
            displayName: subAbility.displayName,
            cardRank: subAbility.rank,
            rebirthModifiers: subAbility.modifiers
        });
        ball.abilities.addSubAbility(ability);
    }
}

export function getRebirthPresentation(profile, characterId) {
    const state = getRebirthState(profile, characterId);
    const experience = getCharacterExperienceSummary(profile, characterId);
    const ownedCards = Object.entries(state.cardRanks)
        .map(([cardId, rank]) => getRebirthCardView(characterId, cardId, rank, state.equippedCardIds))
        .filter(Boolean)
        .sort((left, right) => left.name.localeCompare(right.name));
    const pendingOfferCards = state.pendingOfferCardIds
        .map((cardId) => getRebirthOfferView(characterId, cardId, state.cardRanks[cardId] ?? 0, state.equippedCardIds))
        .filter(Boolean);
    return {
        visible:
            experience.isMax || state.rebirthCount > 0 || ownedCards.length > 0 || hasStatBonuses(state.statBonuses),
        canRebirth: canRebirth(profile, characterId),
        rebirthCount: state.rebirthCount,
        statBonuses: state.statBonuses,
        equippedCount: state.equippedCardIds.length,
        maxEquippedCards: REBIRTH_MAX_EQUIPPED_CARDS,
        ownedCards,
        pendingOfferCards,
        visual: getRebirthVisualProfile(state.rebirthCount)
    };
}
