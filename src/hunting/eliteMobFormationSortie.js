export const ELITE_FORMATION_SORTIE_PHASES = Object.freeze({
    HOLDING: "holding",
    ATTACKING: "attacking",
    RETURNING: "returning"
});

export const DEFAULT_ELITE_FORMATION_SORTIE_CONFIG = Object.freeze({
    behaviors: Object.freeze(["pursuer", "shockwave", "barrier", "splitter"]),
    holdDuration: 0.8,
    attackDuration: 1.2,
    returnDistance: 48
});

export function createEliteFormationSortieConfig(overrides = {}) {
    return {
        ...DEFAULT_ELITE_FORMATION_SORTIE_CONFIG,
        ...overrides,
        behaviors: overrides.behaviors ?? DEFAULT_ELITE_FORMATION_SORTIE_CONFIG.behaviors
    };
}

export function createEliteFormationSortieState(config = DEFAULT_ELITE_FORMATION_SORTIE_CONFIG) {
    return {
        phase: ELITE_FORMATION_SORTIE_PHASES.HOLDING,
        remaining: config.holdDuration
    };
}

export function advanceEliteFormationSortie(
    state,
    { behavior, delta, slotDistance },
    config = DEFAULT_ELITE_FORMATION_SORTIE_CONFIG
) {
    if (!config.behaviors.includes(behavior)) return { state: { ...state }, shouldAttack: false };

    if (state.phase === ELITE_FORMATION_SORTIE_PHASES.ATTACKING) {
        const remaining = Math.max(0, state.remaining - delta);
        if (remaining > 0) {
            return {
                state: { phase: ELITE_FORMATION_SORTIE_PHASES.ATTACKING, remaining },
                shouldAttack: true
            };
        }
        return {
            state: { phase: ELITE_FORMATION_SORTIE_PHASES.RETURNING, remaining: 0 },
            shouldAttack: false
        };
    }

    if (state.phase === ELITE_FORMATION_SORTIE_PHASES.RETURNING) {
        if (slotDistance > config.returnDistance) return { state: { ...state }, shouldAttack: false };
        return { state: createEliteFormationSortieState(config), shouldAttack: false };
    }

    const remaining = Math.max(0, state.remaining - delta);
    if (remaining > 0) {
        return {
            state: { phase: ELITE_FORMATION_SORTIE_PHASES.HOLDING, remaining },
            shouldAttack: false
        };
    }
    return {
        state: {
            phase: ELITE_FORMATION_SORTIE_PHASES.ATTACKING,
            remaining: config.attackDuration
        },
        shouldAttack: true
    };
}

export function finishEliteFormationSortie(state) {
    if (state.phase !== ELITE_FORMATION_SORTIE_PHASES.ATTACKING) return { ...state };
    return { phase: ELITE_FORMATION_SORTIE_PHASES.RETURNING, remaining: 0 };
}
