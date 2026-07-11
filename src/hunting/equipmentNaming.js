export function getDominantEquipmentStat(stats = [], statValueUnits = {}) {
    let dominant = null;
    let highestValue = -Infinity;

    for (const stat of stats) {
        const unit = statValueUnits[stat?.type] ?? 1;
        const normalizedValue = (stat?.value ?? 0) / unit;
        if (normalizedValue > highestValue) {
            dominant = stat?.type ?? null;
            highestValue = normalizedValue;
        }
    }

    return dominant;
}

export function createEquipmentName(baseName, stats, { statValueUnits, prefixes, rng = Math.random } = {}) {
    const primaryStatType = getDominantEquipmentStat(stats, statValueUnits);
    const candidates = prefixes?.[primaryStatType] ?? [];
    if (!baseName || candidates.length === 0) return { name: baseName, primaryStatType };

    const prefix = candidates[Math.floor(rng() * candidates.length)];
    return { name: `${prefix} ${baseName}`, primaryStatType };
}
