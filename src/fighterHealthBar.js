function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function getCombinedHealthBarPercentages({ hp, maxHp, shield, maximumShield }) {
    const safeMaxHp = Math.max(0, Number(maxHp) || 0);
    const safeMaximumShield = Math.max(0, Number(maximumShield) || 0);
    const totalCapacity = safeMaxHp + safeMaximumShield;
    if (totalCapacity <= 0) return { hpPct: 0, shieldPct: 0 };

    return {
        hpPct: (clamp(Number(hp) || 0, 0, safeMaxHp) / totalCapacity) * 100,
        shieldPct: (clamp(Number(shield) || 0, 0, safeMaximumShield) / totalCapacity) * 100
    };
}
