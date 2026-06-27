// ── 메타 성장 상태 — 보상 계산 ──────────────────────────────────────────────
//
// 업적 해금 상태(achievements.unlockedAt)만 저장하고, 보상 수치는 정의에서 동적 계산.
// 보상 수치 변경 시 재접속만으로 자동 반영된다.
// evaluateAchievements가 unlockedAt 중복 체크를 하므로 rewardClaimed 불필요.
// ─────────────────────────────────────────────────────────────────────────────

/** 성장 보너스별 누적 상한 */
export const PROGRESSION_BONUS_CAPS = Object.freeze({
    extraStatPoints: 40,
    balanceTolerance: 10,
    perStatCapBonus: 50
});

/**
 * 해금된 업적의 PROGRESSION_BONUS 보상을 합산하여 현재 유효 보너스를 계산한다.
 * 저장된 상태(achievements.unlockedAt)만 참조하며, 정의 변경 시 자동 반영된다.
 *
 * @param {object} profile - 플레이어 프로필 (읽기 전용)
 * @param {ReadonlyArray<{id:string,reward:object|null}>} definitions - 업적 정의 목록
 * @returns {{ extraStatPoints: number, balanceTolerance: number, perStatCapBonus: number }}
 */
export function computeEffectiveBonuses(profile, definitions) {
    const totals = { extraStatPoints: 0, balanceTolerance: 0, perStatCapBonus: 0 };
    const achievements = profile?.collection?.achievements ?? {};

    for (const def of definitions) {
        const state = achievements[def.id];
        if (!state?.unlockedAt) continue;

        const reward = def.reward;
        if (!reward || reward.type !== "PROGRESSION_BONUS") continue;

        const { bonusKey, amount } = reward.payload ?? {};
        if (!bonusKey || typeof amount !== "number") continue;

        totals[bonusKey] = (totals[bonusKey] ?? 0) + amount;
    }

    // 상한 적용
    for (const key of Object.keys(totals)) {
        const cap = PROGRESSION_BONUS_CAPS[key] ?? Infinity;
        totals[key] = Math.min(totals[key], cap);
    }

    return totals;
}

/**
 * 업적 해금 알림용. evaluateAchievements가 중복을 막으므로 항상 applied: true 반환.
 * FEATURE_UNLOCK 타입만 별도 처리 (기능 해금 알림).
 *
 * @param {object} reward - { type: "PROGRESSION_BONUS" | "FEATURE_UNLOCK", payload: {...} }
 * @returns {{ applied: boolean, bonusKey: string, amount: number }}
 */
export function applyProgressionBonus(reward) {
    if (reward?.type === "FEATURE_UNLOCK") {
        return { applied: true, bonusKey: "", amount: 0 };
    }

    if (!reward || reward.type !== "PROGRESSION_BONUS") {
        return { applied: false, bonusKey: "", amount: 0 };
    }

    const { bonusKey, amount } = reward.payload ?? {};
    if (!bonusKey || typeof amount !== "number" || amount <= 0) {
        return { applied: false, bonusKey: "", amount: 0 };
    }

    return { applied: true, bonusKey, amount };
}

/**
 * 여러 보상의 알림 결과를 반환한다.
 * @param {Array<{id:string,reward:object|null}>} results - [{ id, reward }]
 * @returns {Array<{achievementId:string,applied:boolean,bonusKey:string,amount:number}>}
 */
export function applyAchievementRewards(results) {
    const outcomes = [];
    for (const result of results) {
        if (!result.reward) {
            outcomes.push({ achievementId: result.id, applied: false, bonusKey: "", amount: 0 });
            continue;
        }
        const outcome = applyProgressionBonus(result.reward);
        outcomes.push({ achievementId: result.id, ...outcome });
    }
    return outcomes;
}

/**
 * 보상 설명 문자열을 생성한다.
 * @param {object} reward
 * @returns {string} 예: "추가 스탯 포인트 +2"
 */
export function formatRewardDescription(reward) {
    if (!reward) return "";
    if (reward.type === "FEATURE_UNLOCK") {
        return reward.payload?.description ?? "";
    }
    if (reward.type !== "PROGRESSION_BONUS") return "";
    const { bonusKey, amount } = reward.payload ?? {};
    if (!bonusKey || !amount) return "";

    const LABELS = {
        extraStatPoints: "추가 스탯 포인트",
        balanceTolerance: "빌드 유연성",
        perStatCapBonus: "집중 투자 한도"
    };
    const label = LABELS[bonusKey] ?? bonusKey;
    return `${label} +${amount}`;
}

/**
 * 도전 단계 완료 처리.
 * 최고 해금 단계에서 플레이어가 우승하면 다음 단계를 해금하고 자동 선택한다.
 *
 * @param {object} profile - 플레이어 프로필 (변경됨)
 * @param {{ selectedLevel: number, playerWon: boolean }} params
 * @returns {{ unlocked: boolean, previousLevel: number, unlockedLevel: number|null }}
 */
export function completeChallengeTournament(profile, { selectedLevel, playerWon }) {
    if (typeof profile.progression?.challenge?.highestUnlockedLevel !== "number") {
        return { unlocked: false, previousLevel: selectedLevel, unlockedLevel: null };
    }

    if (!playerWon) {
        return { unlocked: false, previousLevel: selectedLevel, unlockedLevel: null };
    }

    const current = profile.progression.challenge.highestUnlockedLevel;
    if (selectedLevel >= current) {
        const newLevel = current + 1;
        profile.progression.challenge.highestUnlockedLevel = newLevel;
        profile.progression.challenge.selectedLevel = newLevel;
        return { unlocked: true, previousLevel: current, unlockedLevel: newLevel };
    }

    return { unlocked: false, previousLevel: selectedLevel, unlockedLevel: null };
}

/**
 * 성장 보너스 요약 문자열 (UI 표시용).
 * @param {{ extraStatPoints: number, balanceTolerance: number, perStatCapBonus: number }} bonuses
 * @returns {string} 예: "배분 +20 · 유연성 +5 · 집중 한도 +15"
 */
export function formatBonusSummary(bonuses) {
    const parts = [];
    if (bonuses.extraStatPoints > 0) parts.push(`배분 +${bonuses.extraStatPoints}`);
    if (bonuses.balanceTolerance > 0) parts.push(`유연성 +${bonuses.balanceTolerance}`);
    if (bonuses.perStatCapBonus > 0) parts.push(`집중 한도 +${bonuses.perStatCapBonus}`);
    return parts.length > 0 ? parts.join(" · ") : "";
}
