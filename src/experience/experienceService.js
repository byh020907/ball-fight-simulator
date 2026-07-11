import { calcMatchXp, calcTournamentXp } from "./experienceState.js";
import { getLevelFromXp, getXpForNextLevel, getXpProgressInLevel } from "./experienceState.js";
import { LEVEL_REWARDS, MAX_LEVEL, getLevelRequirement } from "./experienceConfig.js";
import { applyLevelRewardEffectsToBall, getLevelRewardEffectText } from "./reward-effects/effectRegistry.js";

export function matchReportToXpInput(report) {
    return {
        damageDealt: report.combatDamageDealt,
        opponentMaxHp: report.opponentMaxHp,
        hpRemain: report.hpRemain,
        myMaxHp: report.myMaxHp,
        minHpRatio: report.lowestHpRatio,
        won: report.playerWon,
        stage: report.tournamentRoundIndex + 1
    };
}

export function grantExperienceFromTournamentReport(profile, report) {
    const xpInputs = report.matchReports.map(matchReportToXpInput);
    const totalXp = calcTournamentXp(xpInputs, report.playerWon);

    return grantExperience(profile, report.playerFighterId, totalXp);
}

export function grantExperienceFromMatchReport(profile, report) {
    return grantExperience(profile, report.playerFighterId, calcMatchXp(matchReportToXpInput(report)));
}

function ensureExperienceState(profile) {
    profile.experience ||= { currentXp: 0, byCharacter: {} };
    profile.experience.byCharacter ||= {};
    return profile.experience;
}

function sumCharacterXp(byCharacter) {
    return Object.values(byCharacter).reduce((sum, record) => sum + Math.max(0, record?.currentXp ?? 0), 0);
}

export function getCharacterTotalXp(profile, characterId) {
    if (!characterId) return 0;
    return Math.max(0, profile?.experience?.byCharacter?.[characterId]?.currentXp ?? 0);
}

export function getExperienceRewardText(reward = {}) {
    return reward.effect ? getLevelRewardEffectText(reward.effect) : "";
}

export function getExperienceRewardsBetween(previousLevel, level) {
    const startLevel = Math.max(2, previousLevel + 1);
    return Array.from({ length: Math.max(0, level - startLevel + 1) }, (_, index) => LEVEL_REWARDS[startLevel + index])
        .filter(Boolean)
        .map((reward) => ({ ...reward, text: getExperienceRewardText(reward) }));
}

export function getCharacterExperienceSummary(profile, characterId) {
    const totalXp = getCharacterTotalXp(profile, characterId);
    const level = getLevelFromXp(totalXp);
    const isMax = level >= MAX_LEVEL;
    const levelStartXp = getLevelRequirement(level);
    const nextLevelXp = isMax ? levelStartXp : getLevelRequirement(level + 1);
    const levelSpan = Math.max(1, nextLevelXp - levelStartXp);
    const xpInLevel = isMax ? levelSpan : Math.max(0, totalXp - levelStartXp);
    const remainingXp = isMax ? 0 : Math.max(0, nextLevelXp - totalXp);
    const progress = isMax ? 1 : getXpProgressInLevel(totalXp);
    const nextRewardText = isMax ? "최대 레벨" : getExperienceRewardText(LEVEL_REWARDS[level + 1]) || "보상 없음";

    return {
        characterId,
        totalXp,
        level,
        levelLabel: `Lv.${level}${isMax ? " MAX" : ""}`,
        isMax,
        progress,
        progressPct: Math.round(progress * 100),
        levelStartXp,
        nextLevelXp,
        xpInLevel,
        levelSpan,
        remainingXp,
        progressText: isMax ? `${totalXp.toLocaleString()} XP` : `${xpInLevel}/${levelSpan} XP`,
        nextText: isMax ? "최대 레벨" : `다음 레벨까지 ${remainingXp}XP`,
        nextRewardText
    };
}

function grantExperience(profile, characterId, totalXp) {
    if (totalXp <= 0 || !characterId) {
        return { characterId, xpGained: 0, totalXp: 0, level: 1, levelUp: false };
    }

    const experience = ensureExperienceState(profile);
    const record = experience.byCharacter[characterId] || { currentXp: 0 };
    const prevTotal = Math.max(0, record.currentXp ?? 0);
    const before = getCharacterExperienceSummary(profile, characterId);
    const prevLevel = before.level;
    const newTotal = prevTotal + totalXp;
    record.currentXp = newTotal;
    experience.byCharacter[characterId] = record;
    experience.currentXp = sumCharacterXp(experience.byCharacter);

    const after = getCharacterExperienceSummary(profile, characterId);
    const newLevel = getLevelFromXp(newTotal);

    return {
        characterId,
        xpGained: totalXp,
        totalXp: newTotal,
        previousTotalXp: prevTotal,
        previousLevel: prevLevel,
        level: newLevel,
        levelUp: newLevel > prevLevel,
        earnedRewards: getExperienceRewardsBetween(prevLevel, newLevel),
        progressBefore: before.progress,
        progressAfter: after.progress,
        progressBeforePct: before.progressPct,
        progressAfterPct: after.progressPct,
        remainingXp: after.remainingXp,
        progressText: after.progressText,
        nextText: after.nextText,
        nextRewardText: after.nextRewardText,
        levelLabel: after.levelLabel
    };
}

export function collectActiveExperienceEffects(profile, characterId) {
    const level = getLevelFromXp(getCharacterTotalXp(profile, characterId));
    return getExperienceRewardsBetween(1, level).map((reward) => reward.effect);
}

export function applyExperienceEffectsToBall(ball, effects) {
    applyLevelRewardEffectsToBall(ball, effects);
}

export { calcMatchXp, calcTournamentXp, getLevelFromXp, getXpForNextLevel, getXpProgressInLevel };
