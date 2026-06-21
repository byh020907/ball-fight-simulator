export const PLAYER_STAT_POINTS = 100;
export const MAX_POINTS_PER_STAT = 100;

export const ALLOCATABLE_STATS = [
    {
        key: "hp",
        label: "체력",
        shortLabel: "HP",
        description: "종족값 체력을 포인트당 1% 올립니다."
    },
    {
        key: "damage",
        label: "공격",
        shortLabel: "ATK",
        description: "종족값 공격 배율을 포인트당 1% 올립니다."
    },
    {
        key: "speed",
        label: "속도",
        shortLabel: "SPD",
        description: "종족값 이동 속도를 포인트당 1% 올립니다."
    }
];

const STAT_KEYS = ALLOCATABLE_STATS.map((stat) => stat.key);

// ── 스탯 밸런스 배율 시스템 ─────────────────────────────────────────────────

/**
 * 스탯 분산 기반 배율 설정 상수
 *
 * - BASE_MULTIPLIER: 분산이 극대화되어도 유지되는 최소 배율
 * - MAX_BONUS: 균등 분배 시 추가되는 최대 보너스 (BASE_MULTIPLIER에 더해짐)
 * - SENSITIVITY: 낮을수록 균등 분배 강제, 높을수록 올인 우대
 */
export const STAT_BALANCER_CONFIG = {
    BASE_MULTIPLIER: 1.0,
    MAX_BONUS: 1.0,
    SENSITIVITY: 20.0
};

/**
 * 표준편차 기반 스탯 배율 계산
 * @param {number[]} stats - 스탯 포인트 배열 (예: [30, 40, 30])
 * @returns {{ multiplier: number, stdDev: number }}
 */
export function calculateStatMultiplier(stats) {
    const { BASE_MULTIPLIER, MAX_BONUS, SENSITIVITY } = STAT_BALANCER_CONFIG;

    if (!stats || stats.length === 0) {
        return { multiplier: BASE_MULTIPLIER, stdDev: 0 };
    }

    const sum = stats.reduce((acc, val) => acc + val, 0);
    const average = sum / stats.length;
    const sumOfSquares = stats.reduce((acc, val) => acc + Math.pow(val - average, 2), 0);
    const variance = sumOfSquares / stats.length;
    const stdDev = Math.sqrt(variance);

    const multiplier = BASE_MULTIPLIER + MAX_BONUS * (SENSITIVITY / (SENSITIVITY + stdDev));

    return {
        multiplier: Number(multiplier.toFixed(3)),
        stdDev: Number(stdDev.toFixed(3))
    };
}

export function createEmptyStatAllocation() {
    return Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
}

export function getSpentStatPoints(allocation) {
    return STAT_KEYS.reduce((total, key) => total + (allocation[key] ?? 0), 0);
}

export function getRemainingStatPoints(allocation, total = PLAYER_STAT_POINTS) {
    return Math.max(0, total - getSpentStatPoints(allocation));
}

export function adjustStatAllocation(allocation, statKey, delta, total = PLAYER_STAT_POINTS) {
    if (!STAT_KEYS.includes(statKey) || delta === 0) {
        return { ...allocation };
    }

    const next = { ...allocation };
    const current = next[statKey] ?? 0;
    if (delta > 0) {
        const remaining = getRemainingStatPoints(next, total);
        next[statKey] = Math.min(MAX_POINTS_PER_STAT, current + Math.min(delta, remaining));
        return next;
    }

    next[statKey] = Math.max(0, current + delta);
    return next;
}

export function createRandomStatAllocation(rng = Math.random, total = PLAYER_STAT_POINTS) {
    const allocation = createEmptyStatAllocation();
    for (let point = 0; point < total; point += 1) {
        const available = STAT_KEYS.filter((key) => allocation[key] < MAX_POINTS_PER_STAT);
        const pickedIndex = Math.min(available.length - 1, Math.floor(rng() * available.length));
        const picked = available[pickedIndex];
        allocation[picked] += 1;
    }
    return allocation;
}

export function applyStatAllocation(fighter, allocation, isPlayer = false) {
    const stats = { ...fighter.stats };
    const points = STAT_KEYS.map((key) => allocation[key] ?? 0);
    const { multiplier } = calculateStatMultiplier(points);

    for (const stat of ALLOCATABLE_STATS) {
        const pts = allocation[stat.key] ?? 0;
        stats[stat.key] = Number((stats[stat.key] * (1 + pts / 100) * multiplier).toFixed(3));
    }

    return {
        ...fighter,
        stats,
        statAllocation: { ...allocation },
        isPlayer
    };
}

export function formatStatAllocation(allocation) {
    return ALLOCATABLE_STATS.map((stat) => `${stat.label} +${allocation[stat.key] ?? 0}%`).join(" · ");
}

export function createTournamentRoster(roster, playerId, playerAllocation, rng = Math.random) {
    return roster.map((fighter) => {
        const isPlayer = fighter.id === playerId;
        const allocation = isPlayer ? playerAllocation : createRandomStatAllocation(rng);
        return applyStatAllocation(fighter, allocation, isPlayer);
    });
}
