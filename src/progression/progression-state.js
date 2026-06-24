// ── 메타 성장 상태 — 보상 적용 ──────────────────────────────────────────────
//
// 업적 해금 시 지급되는 성장 보너스의 누적, 상한 보정, 중복 지급 방지를 담당.
// 보상 출처와 관계없이 이 모듈이 실제 누적과 상한 검증을 소유한다.
// ─────────────────────────────────────────────────────────────────────────────

/** 성장 보너스별 누적 상한 */
export const PROGRESSION_BONUS_CAPS = Object.freeze({
    extraStatPoints: 40,
    balanceTolerance: 10,
    perStatCapBonus: 50
});

/**
 * 성장 보너스 보상을 플레이어 프로필에 적용한다.
 * 이미 해금된 업적의 보상(rewardClaimed)은 건너뛴다.
 *
 * @param {object} profile - 플레이어 프로필 (직접 수정됨)
 * @param {object} reward - { type: "PROGRESSION_BONUS", payload: { bonusKey, amount } }
 * @param {string} achievementId - 보상 출처 업적 ID (중복 지급 방지용)
 * @returns {{ applied: boolean, bonusKey: string, amount: number, capped: number }} 적용 결과
 */
export function applyProgressionBonus(profile, reward, achievementId) {
    if (!reward || reward.type !== "PROGRESSION_BONUS") {
        return { applied: false, bonusKey: "", amount: 0, capped: 0 };
    }

    const { bonusKey, amount } = reward.payload ?? {};
    if (!bonusKey || typeof amount !== "number" || amount <= 0) {
        return { applied: false, bonusKey: "", amount: 0, capped: 0 };
    }

    // 중복 지급 방지
    const achievementState = profile.collection.achievements[achievementId];
    if (achievementState?.rewardClaimed) {
        return { applied: false, bonusKey, amount, capped: 0 };
    }

    const bonuses = profile.progression.bonuses;
    const current = bonuses[bonusKey] ?? 0;
    const cap = PROGRESSION_BONUS_CAPS[bonusKey] ?? Infinity;
    const capped = Math.min(amount, Math.max(0, cap - current));

    if (capped <= 0) {
        return { applied: false, bonusKey, amount, capped: 0 };
    }

    bonuses[bonusKey] = current + capped;

    // 중복 지급 방지 플래그
    if (achievementState) {
        achievementState.rewardClaimed = true;
    }

    return { applied: true, bonusKey, amount: capped, capped };
}

/**
 * 여러 보상을 순서대로 적용한다.
 * @param {object} profile
 * @param {Array<{id:string,reward:object|null}>} results - [{ id, reward }]
 * @returns {Array<{achievementId:string,applied:boolean,bonusKey:string,amount:number}>}
 */
export function applyAchievementRewards(profile, results) {
    const outcomes = [];
    for (const result of results) {
        if (!result.reward) {
            outcomes.push({
                achievementId: result.id,
                applied: false,
                bonusKey: "",
                amount: 0
            });
            continue;
        }
        const outcome = applyProgressionBonus(profile, result.reward, result.id);
        outcomes.push({
            achievementId: result.id,
            ...outcome
        });
    }
    return outcomes;
}

/**
 * 보상 설명 문자열을 생성한다.
 * @param {object} reward
 * @returns {string} 예: "추가 스탯 포인트 +2"
 */
export function formatRewardDescription(reward) {
    if (!reward || reward.type !== "PROGRESSION_BONUS") return "";
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
