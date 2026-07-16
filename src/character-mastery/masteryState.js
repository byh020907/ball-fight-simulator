// ── 숙련도 등급 상태 조회/변경 ───────────────────────────────────────────────
//
// 프로필의 characterMastery.levels를 읽고, 승급 처리한다.
// ─────────────────────────────────────────────────────────────────────────────

import { VALID_CHARACTER_IDS } from "../playerProfile.js";
import { MASTERY_EFFECT_DEFS, TIER_LABELS } from "./masteryDefinitions.js";

/** 캐릭터의 현재 숙련도 등급 (0~3) */
export function getCharacterMasteryLevel(profile, characterId) {
    if (!VALID_CHARACTER_IDS.includes(characterId)) return 0;
    const levels = profile?.characterMastery?.levels ?? {};
    const val = levels[characterId];
    if (typeof val !== "number" || !Number.isFinite(val)) return 0;
    return Math.max(0, Math.min(3, Math.floor(val)));
}

/** 등급 텍스트 */
export function getTierText(level) {
    return TIER_LABELS[Math.max(0, Math.min(3, level))] ?? "미해금";
}

/**
 * 승급 처리.
 * @returns {{ changed: boolean, reason?: string, previousLevel?: number, newLevel?: number, previousTier?: string, newTier?: string, completedChallengeLevel?: number }}
 */
export function advanceCharacterMastery(profile, { characterId, challengeLevel, playerWon }) {
    if (!playerWon) return { changed: false, reason: "lost" };
    if (!VALID_CHARACTER_IDS.includes(characterId)) return { changed: false, reason: "invalid_character" };

    const currentLevel = getCharacterMasteryLevel(profile, characterId);
    if (currentLevel >= 3) return { changed: false, reason: "max_level" };

    // 승급에 필요한 난도 확인
    const requiredLevel = currentLevel; // 0→1 needs ≥0, 1→2 needs ≥1, 2→3 needs ≥2
    if (challengeLevel < requiredLevel) {
        return { changed: false, reason: "insufficient_challenge" };
    }

    const newLevel = currentLevel + 1;
    // levels 객체 초기화
    if (!profile.characterMastery.levels) profile.characterMastery.levels = {};
    profile.characterMastery.levels[characterId] = newLevel;

    return {
        changed: true,
        characterId,
        previousLevel: currentLevel,
        newLevel,
        previousTier: TIER_LABELS[currentLevel],
        newTier: TIER_LABELS[newLevel],
        completedChallengeLevel: challengeLevel
    };
}
