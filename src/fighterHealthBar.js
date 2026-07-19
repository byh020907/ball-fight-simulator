function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function getCombinedHealthBarPercentages({ hp, maxHp, shield, maximumShield }) {
    const safeMaxHp = Math.max(0, Number(maxHp) || 0);
    const safeMaximumShield = Math.max(0, Number(maximumShield) || 0);
    const safeShield = clamp(Number(shield) || 0, 0, safeMaximumShield);
    const totalCapacity = safeMaxHp + safeShield;
    if (totalCapacity <= 0) return { hpPct: 0, shieldPct: 0 };

    return {
        hpPct: (clamp(Number(hp) || 0, 0, safeMaxHp) / totalCapacity) * 100,
        shieldPct: (safeShield / totalCapacity) * 100
    };
}
