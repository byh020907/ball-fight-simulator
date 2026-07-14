export const BOSS_MOB_MULTIPLIERS = Object.freeze({
    radius: 1.5,
    mass: 2.25,
    hp: 2,
    damage: 1.5,
    defense: 1.5
});

function scaleInteger(value, multiplier) {
    return Number.isFinite(value) ? Math.round(value * multiplier) : value;
}

function scaleDecimal(value, multiplier) {
    return Number.isFinite(value) ? Number((value * multiplier).toFixed(3)) : value;
}

export function applyBossMob(spec) {
    if (!spec?.stats) return spec;

    return {
        ...spec,
        id: `${spec.id}-boss`,
        name: `${spec.name} 중간 보스`,
        title: `${spec.title} 중간 보스`,
        stats: {
            ...spec.stats,
            radius: scaleDecimal(spec.stats.radius, BOSS_MOB_MULTIPLIERS.radius),
            mass: scaleDecimal(spec.stats.mass, BOSS_MOB_MULTIPLIERS.mass),
            hp: scaleInteger(spec.stats.hp, BOSS_MOB_MULTIPLIERS.hp),
            damage: scaleDecimal(spec.stats.damage, BOSS_MOB_MULTIPLIERS.damage),
            defense: scaleDecimal(spec.stats.defense, BOSS_MOB_MULTIPLIERS.defense)
        },
        hunting: {
            ...(spec.hunting ?? {}),
            isMob: true,
            isMiniboss: true,
            bossKind: "monster"
        }
    };
}
