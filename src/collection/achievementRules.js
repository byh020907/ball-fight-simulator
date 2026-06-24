// ── 업적 판정 로직 ──────────────────────────────────────────────────────────
//
// 토너먼트 완료 후 evaluateAchievements()를 호출하여
// 아직 해금되지 않은 업적을 판정하고 해금한다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 업적을 판정하고 새로 해금된 업적 목록을 반환한다.
 * 이미 해금된 업적은 건너뛴다.
 *
 * @param {object} profile - 플레이어 프로필 (직접 수정됨)
 * @param {ReadonlyArray<{id:string,evaluate:(ctx:object)=>boolean}>} definitions - 업적 정의 목록
 * @param {object} context - evaluate()에 전달할 컨텍스트
 * @returns {Array<{id:string,newlyUnlocked:boolean,reward:object|null}>}
 */
export function evaluateAchievements(profile, definitions, context) {
    const results = [];
    const achievements = profile.collection.achievements;

    for (const def of definitions) {
        const existing = achievements[def.id];
        if (existing?.unlockedAt) continue;

        if (def.evaluate(context)) {
            achievements[def.id] = {
                unlockedAt: Date.now(),
                rewardClaimed: false
            };
            results.push({
                id: def.id,
                newlyUnlocked: true,
                reward: def.reward ?? null
            });
        }
    }

    return results;
}

/**
 * 특정 업적의 ID가 유효한지 확인한다.
 * @param {string} id
 * @param {ReadonlyArray<{id:string}>} definitions
 * @returns {boolean}
 */
export function isValidAchievementId(id, definitions) {
    return definitions.some((def) => def.id === id);
}
