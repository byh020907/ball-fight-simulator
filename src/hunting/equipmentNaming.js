export function getDominantEquipmentStat(stats = [], statValueRatios = {}) {
    let dominant = null;
    let highestValue = -Infinity;

    for (const stat of stats) {
        const ratio = statValueRatios[stat?.type] ?? 1;
        const normalizedValue = (stat?.value ?? 0) / ratio;
        if (normalizedValue > highestValue) {
            dominant = stat?.type ?? null;
            highestValue = normalizedValue;
        }
    }

    return dominant;
}

export function createEquipmentName(
    baseName,
    stats,
    { statValueRatios, prefixes, specialOptions = [], specialSuffixes = {}, rng = Math.random } = {}
) {
    const primaryStatType = getDominantEquipmentStat(stats, statValueRatios);
    const candidates = prefixes?.[primaryStatType] ?? [];
    const specialOptionType = specialOptions[0]?.type ?? null;
    const specialSuffix = specialSuffixes[specialOptionType] ?? "";
    if (!baseName || candidates.length === 0) {
        const result = { name: specialSuffix ? `${baseName} ${specialSuffix}` : baseName, primaryStatType };
        if (specialOptionType) result.specialOptionType = specialOptionType;
        return result;
    }

    const prefix = candidates[Math.floor(rng() * candidates.length)];
    const result = {
        name: `${prefix} ${baseName}${specialSuffix ? ` ${specialSuffix}` : ""}`,
        primaryStatType
    };
    if (specialOptionType) result.specialOptionType = specialOptionType;
    return result;
}
