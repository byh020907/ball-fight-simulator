export const ELITE_FORMATION_SORTIE_PHASES = Object.freeze({
    HOLDING: "holding",
    ATTACKING: "attacking",
    RETURNING: "returning"
});

/**
 * 정예 근접 몹의 출격 체감은 이 기본 설정에서 조정한다.
 * 특정 몬스터만 다르게 쓰려면 spec.hunting.eliteFormationSortieConfig에 같은 키를 덮어쓴다.
 */
export const DEFAULT_ELITE_FORMATION_SORTIE_CONFIG = Object.freeze({
    // 출격 기능을 사용할 hunting.behavior 목록
    behaviors: Object.freeze(["pursuer", "shockwave", "barrier", "splitter"]),
    // 슬롯에 복귀한 뒤 다음 출격까지 기다리는 초. 줄이면 더 자주 공격한다.
    holdDuration: 0.8,
    // 플레이어를 추적하는 최대 초. 늘리면 더 오래 공격하고 진형 복귀가 늦어진다.
    attackDuration: 1.2,
    // 자기 슬롯에 이 거리까지 접근하면 복귀 완료로 판단한다. 늘리면 더 빨리 재정렬된다.
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
