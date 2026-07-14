const RARITY_LABELS = Object.freeze({
    common: "common",
    uncommon: "uncommon",
    rare: "rare",
    unique: "unique",
    epic: "epic",
    legendary: "legendary"
});

export function getRarityLabel(rarity, fallback = "common") {
    const normalized = typeof rarity === "string" && rarity.trim() ? rarity.trim().toLowerCase() : fallback;
    return RARITY_LABELS[normalized] ?? normalized;
}
