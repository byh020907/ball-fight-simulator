// ── 도전 난도 규칙 (캐릭터별) ───────────────────────────────────────────────
//
// 캐릭터 연계 등급 → AI 강화 수치 계산.
// AI에만 적용, 플레이어는 영향 없음.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 캐릭터 난도에 따른 AI 총 스탯 포인트.
 * 난도 0 = 100 (기본), 최대 200.
 */
export function getAiTotalStatPoints(challengeLevel) {
    return 100 + Math.min(challengeLevel * 4, 100);
}

/**
 * AI 균형 배분 가중치 (5단계부터 적용).
 * 난도 0~4 = 0, 이후 선형 증가, 최대 0.8.
 */
export function getAiBalancedWeight(challengeLevel) {
    if (challengeLevel <= 4) return 0;
    return Math.min((challengeLevel - 4) * 0.1, 0.8);
}

/**
 * AI 전력 배율 (hp, damage, defense에만 적용).
 * 난도 0 = 1.0, 난도당 +0.025.
 */
export function getAiPowerMultiplier(challengeLevel) {
    return 1 + challengeLevel * 0.025;
}

/**
 * AI용 랜덤 배분 (균형 가중치 적용).
 * @param {function} rng
 * @param {number} totalPoints
 * @param {number} balancedWeight 0~0.8
 * @param {string[]} statKeys 배분 가능한 스탯 키
 * @param {number} maxPerStat 스탯별 최대
 * @returns {object} allocation
 */
export function createAiStatAllocation(
    rng = Math.random,
    totalPoints = 100,
    balancedWeight = 0,
    statKeys = ["hp", "damage", "speed", "skill", "defense"],
    maxPerStat = 100
) {
    const allocation = Object.fromEntries(statKeys.map((k) => [k, 0]));
    const targetPerStat = balancedWeight > 0 ? totalPoints / statKeys.length : 0;
    let remaining = totalPoints;
    const order = [...statKeys];
    // Fisher-Yates shuffle for randomness
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    for (const key of order) {
        if (remaining <= 0) break;
        let desired;
        if (balancedWeight > 0 && rng() < balancedWeight) {
            desired = Math.round(targetPerStat);
        } else {
            desired = Math.ceil(rng() * Math.min(maxPerStat, remaining));
        }
        const allocated = Math.min(desired, remaining, maxPerStat);
        allocation[key] = allocated;
        remaining -= allocated;
    }
    // 남은 포인트를 순차 배분
    while (remaining > 0) {
        for (const key of order) {
            if (remaining <= 0) break;
            if (allocation[key] < maxPerStat) {
                allocation[key] += 1;
                remaining -= 1;
            }
        }
    }
    return allocation;
}
