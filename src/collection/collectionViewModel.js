// ── 컬렉션 허브 ViewModel ───────────────────────────────────────────────────
//
// profile + roster + mastery/achievement definitions → UI 전용 데이터 생성.
// Alpine 템플릿과 UIController는 이 ViewModel을 통해 데이터를 표시한다.
// ─────────────────────────────────────────────────────────────────────────────

import { formatRewardDescription } from "../progression/progressionState.js";
import { getCharacterExperienceSummary } from "../experience/experienceService.js";

export const MASTERY_THRESHOLDS = Object.freeze([1, 5, 15]);
export const COLLECTION_HUB_TABS = Object.freeze([
    { id: "roster", label: "도감" },
    { id: "mastery", label: "숙련도" },
    { id: "achievements", label: "업적" }
]);

/** 숙련도 계산 */
export function getMasteryLevel(tournamentWins) {
    if (tournamentWins >= MASTERY_THRESHOLDS[2]) return 3;
    if (tournamentWins >= MASTERY_THRESHOLDS[1]) return 2;
    if (tournamentWins >= MASTERY_THRESHOLDS[0]) return 1;
    return 0;
}

export function getNextMasteryThreshold(currentLevel) {
    if (currentLevel >= 3) return null;
    return MASTERY_THRESHOLDS[currentLevel];
}

export function getMasteryProgress(tournamentWins) {
    const level = getMasteryLevel(tournamentWins);
    if (level >= 3) return 1;
    const nextThreshold = MASTERY_THRESHOLDS[level];
    if (level === 0) return Math.min(1, tournamentWins / nextThreshold);
    const prevThreshold = MASTERY_THRESHOLDS[level - 1];
    return (tournamentWins - prevThreshold) / (nextThreshold - prevThreshold);
}

/**
 * 컬렉션 허브 ViewModel 생성.
 * profile, roster, masteryDefinitions, achievementDefinitions, currentPlayerFighterId를 입력받는다.
 */
export function createCollectionHubViewModel({
    profile,
    roster,
    masteryDefinitions = [],
    achievementDefinitions = [],
    currentPlayerFighterId = null
} = {}) {
    const rosterSize = roster.length;
    const masteryLevels = profile?.characterMastery?.levels ?? {};
    const characters = profile?.collection?.characters ?? {};
    const careerStats = profile?.collection?.careerStats ?? {};

    // 도감 항목
    const rosterItems = roster.map((fighter) => {
        const record = characters[fighter.id] || {};
        const tournamentWins = record.tournamentWins ?? 0;
        const mastery = getMasteryLevel(tournamentWins);
        const hasRecord = record.tournamentsCompleted > 0;
        const masteryLevel = masteryLevels[fighter.id] ?? 0;
        const masteryUnlocked = masteryLevel > 0;
        const masteryActive = masteryUnlocked && fighter.id !== currentPlayerFighterId;
        const isCurrent = fighter.id === currentPlayerFighterId;
        const experience = getCharacterExperienceSummary(profile, fighter.id);

        return {
            id: fighter.id,
            name: fighter.name,
            color: fighter.color,
            ability: fighter.ability,
            hasRecord,
            tournamentsCompleted: record.tournamentsCompleted ?? 0,
            tournamentWins,
            matchWins: record.matchWins ?? 0,
            bestPlacement: record.bestPlacement ?? null,
            totalDamageDealt: record.totalDamageDealt ?? 0,
            comebackMatchWins: record.comebackMatchWins ?? 0,
            firstTournamentAt: record.firstTournamentAt ?? null,
            lastTournamentAt: record.lastTournamentAt ?? null,
            mastery,
            masteryProgress: getMasteryProgress(tournamentWins),
            nextMasteryThreshold: getNextMasteryThreshold(mastery),
            isCurrent,
            masteryLevel,
            masteryUnlocked,
            masteryActive,
            experience,
            experienceLevel: experience.level,
            experienceLevelLabel: experience.levelLabel,
            experienceTotalXp: experience.totalXp,
            experienceProgressPct: experience.progressPct,
            experienceProgressText: experience.progressText,
            experienceNextText: experience.nextText,
            experienceNextRewardText: experience.nextRewardText
        };
    });

    // 숙련도 항목
    const masteryItems = masteryDefinitions.map((def) => {
        const level = masteryLevels[def.sourceFighterId] ?? 0;
        const unlocked = level > 0;
        const isSelf = def.sourceFighterId === currentPlayerFighterId;
        const active = unlocked && !isSelf;
        const sourceName = roster.find((f) => f.id === def.sourceFighterId)?.name ?? def.sourceFighterId;
        const unlockCondition = `${sourceName}으로 토너먼트 우승`;
        return {
            id: def.id,
            sourceFighterId: def.sourceFighterId,
            name: def.name,
            kind: def.kind,
            description: def.description,
            tierValues: def.tierValues,
            formatValue: def.formatValue,
            level: masteryLevels[def.sourceFighterId] ?? 0,
            unlocked,
            isSelf,
            active,
            sourceName,
            unlockCondition
        };
    });

    // 업적 항목
    const achievementItems = achievementDefinitions.map((def) => {
        const state = profile?.collection?.achievements?.[def.id];
        const unlocked = !!state?.unlockedAt;
        const rewardDesc = formatRewardDescription(def.reward);
        return {
            id: def.id,
            name: def.name,
            description: def.description,
            tier: def.tier || "bronze",
            unlocked,
            unlockedAt: state?.unlockedAt ?? null,
            reward: def.reward ?? null,
            rewardText: rewardDesc
        };
    });

    // 요약
    const playedCharacters = rosterItems.filter((item) => item.hasRecord).length;
    const cumulativeLevels = rosterItems.reduce((sum, item) => sum + item.masteryLevel, 0);
    const maxLevels = rosterItems.length * 3;
    const unlockedMastery = masteryItems.filter((item) => item.unlocked).length;
    const unlockedAchievements = achievementItems.filter((item) => item.unlocked).length;
    const masteryTotal = rosterItems.reduce((sum, item) => sum + item.mastery, 0);

    return {
        rosterSize,
        rosterItems,
        masteryItems,
        achievementItems,
        summary: {
            cumulativeLevels,
            maxLevels,
            playedCharacters,
            rosterSize,
            unlockedMastery,
            totalMastery: masteryDefinitions.length,
            unlockedAchievements,
            totalAchievements: achievementDefinitions.length,
            masteryTotal
        }
    };
}
