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

export function formatEquipmentSpecialName(name, specialOptions = [], specialSuffixes = {}) {
    const specialOptionType = specialOptions[0]?.type ?? null;
    const specialSuffix = specialSuffixes[specialOptionType] ?? "";
    if (!name || !specialSuffix) return name;

    const canonicalSuffix = ` • ${specialSuffix}`;
    if (name.endsWith(canonicalSuffix)) return name;

    const legacySuffix = ` ${specialSuffix}`;
    if (name.endsWith(legacySuffix)) {
        return `${name.slice(0, -legacySuffix.length)}${canonicalSuffix}`;
    }

    return `${name}${canonicalSuffix}`;
}

export function createEquipmentName(
    baseName,
    stats,
    { statValueRatios, prefixes, specialOptions = [], specialSuffixes = {}, rng = Math.random } = {}
) {
    const primaryStatType = getDominantEquipmentStat(stats, statValueRatios);
    const candidates = prefixes?.[primaryStatType] ?? [];
    const specialOptionType = specialOptions[0]?.type ?? null;
    const formattedBaseName = formatEquipmentSpecialName(baseName, specialOptions, specialSuffixes);
    if (!baseName || candidates.length === 0) {
        const result = { name: formattedBaseName, primaryStatType };
        if (specialOptionType) result.specialOptionType = specialOptionType;
        return result;
    }

    const prefix = candidates[Math.floor(rng() * candidates.length)];
    const result = {
        name: `${prefix} ${formattedBaseName}`,
        primaryStatType
    };
    if (specialOptionType) result.specialOptionType = specialOptionType;
    return result;
}
