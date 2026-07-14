import { MAX_LEVEL } from "../experience/experienceConfig.js";
import { getCharacterExperienceSummary, resetCharacterExperience } from "../experience/experienceService.js";
import {
    getRebirthCardCatalog,
    getRebirthCardDefinition,
    getRebirthCardView,
    getRebirthFighter,
    REBIRTH_MAX_CARD_RANK,
    REBIRTH_MAX_EQUIPPED_CARDS,
    REBIRTH_OFFER_SIZE
} from "./rebirthCards.js";
import { getRebirthVisualProfile } from "./rebirthVisuals.js";

const EMPTY_REBIRTH_STATE = Object.freeze({
    rebirthCount: 0,
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

function ensureRebirthState(profile, characterId) {
    profile.rebirth ||= { byCharacter: {} };
    profile.rebirth.byCharacter ||= {};
    const current = getStateRecord(profile, characterId);
    const next = {
        rebirthCount: Math.max(0, Math.floor(current.rebirthCount ?? 0)),
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
    const catalog = getRebirthCardCatalog(characterId);
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
        .filter((cardId) => getRebirthCardDefinition(characterId, cardId))
        .slice(0, REBIRTH_OFFER_SIZE);
    return {
        rebirthCount: Math.max(0, Math.floor(state.rebirthCount ?? 0)),
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
        .map((cardId) => getRebirthCardDefinition(characterId, cardId))
        .filter(Boolean);
    const cards = validPending.length === REBIRTH_OFFER_SIZE ? validPending : createRebirthOffer(characterId, rng);
    state.pendingOfferCardIds = cards.map((card) => card.id);
    return {
        ok: true,
        cards: state.pendingOfferCardIds.map((cardId) => getRebirthCardDefinition(characterId, cardId))
    };
}

export function completeRebirth(profile, characterId, cardId) {
    if (!canRebirth(profile, characterId)) return { ok: false, error: "not_eligible" };
    const state = ensureRebirthState(profile, characterId);
    if (!state.pendingOfferCardIds.includes(cardId)) return { ok: false, error: "invalid_offer" };
    const card = getRebirthCardDefinition(characterId, cardId);
    if (!card) return { ok: false, error: "invalid_card" };

    const previousRank = normalizeRank(state.cardRanks[cardId]);
    const rank = Math.min(REBIRTH_MAX_CARD_RANK, previousRank + 1);
    state.cardRanks[cardId] = rank;
    state.rebirthCount += 1;
    state.pendingOfferCardIds = [];
    const experience = resetCharacterExperience(profile, characterId);
    return { ok: true, card, rank, duplicate: previousRank > 0, rebirthCount: state.rebirthCount, experience };
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
    const statBonuses = { hp: 0, damage: 0, speed: 0, skill: 0, defense: 0 };
    const subAbilities = [];
    for (const cardId of state.equippedCardIds) {
        const card = getRebirthCardDefinition(characterId, cardId);
        const rank = state.cardRanks[cardId];
        if (!card || rank <= 0) continue;
        const effect = card.getRankEffect(rank);
        for (const [stat, value] of Object.entries(effect.stats)) statBonuses[stat] += value;
        if (card.type === "subAbility") {
            subAbilities.push({
                cardId,
                abilityId: card.abilityId,
                rank,
                displayName: card.name,
                modifiers: effect.modifiers
            });
        }
    }
    return {
        characterId,
        rebirthCount: state.rebirthCount,
        statBonuses,
        subAbilities,
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
        .map((cardId) => getRebirthCardView(characterId, cardId, state.cardRanks[cardId] ?? 0, state.equippedCardIds))
        .filter(Boolean);
    return {
        visible: experience.isMax || state.rebirthCount > 0 || ownedCards.length > 0,
        canRebirth: canRebirth(profile, characterId),
        rebirthCount: state.rebirthCount,
        equippedCount: state.equippedCardIds.length,
        maxEquippedCards: REBIRTH_MAX_EQUIPPED_CARDS,
        ownedCards,
        pendingOfferCards,
        visual: getRebirthVisualProfile(state.rebirthCount)
    };
}
