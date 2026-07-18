const LEGACY_COOLDOWN_RANKS = Object.freeze([0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]);

function migrateLegacyRank(cardId, rank) {
    const numericRank = Math.max(0, Math.floor(Number(rank) || 0));
    return cardId === "passive:global-cooldown"
        ? LEGACY_COOLDOWN_RANKS[Math.min(10, numericRank)]
        : Math.min(4, numericRank);
}

export function migrateRebirthV0ToV1(legacyArea) {
    const byCharacter = Object.fromEntries(
        Object.entries(legacyArea?.byCharacter ?? {}).map(([characterId, state]) => {
            if (!state || typeof state !== "object") return [characterId, state];
            const cardRanks = Object.fromEntries(
                Object.entries(state.cardRanks ?? {}).map(([cardId, rank]) => [cardId, migrateLegacyRank(cardId, rank)])
            );
            const hadPendingOffer =
                (Array.isArray(state.pendingOfferCards) && state.pendingOfferCards.length > 0) ||
                (Array.isArray(state.pendingOfferCardIds) && state.pendingOfferCardIds.length > 0);
            return [
                characterId,
                {
                    ...state,
                    cardRanks,
                    pendingOfferCards: [],
                    pendingOfferNeedsRegeneration: hadPendingOffer
                }
            ];
        })
    );
    return { schemaVersion: 1, byCharacter };
}
