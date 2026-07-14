import { calcMatchXp, calcTournamentXp } from "./experienceState.js";
import { getLevelFromXp, getXpForNextLevel, getXpProgressInLevel } from "./experienceState.js";
import { MAX_LEVEL, getLevelRequirement } from "./experienceConfig.js";
import { applyLevelRewardEffectsToBall, applyLevelRewardEffectsToBaseSpec } from "./reward-effects/effectRegistry.js";
import {
    getCharacterLevelProgression,
    getCharacterLevelRewardsBetween,
    getNextCharacterLevelReward
} from "./characterLevelProgression.js";

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

export function resetCharacterExperience(profile, characterId) {
    if (!characterId) return { characterId, previousTotalXp: 0, totalXp: 0, level: 1 };
    const before = getCharacterExperienceSummary(profile, characterId);
    const experience = ensureExperienceState(profile);
    delete experience.byCharacter[characterId];
    experience.currentXp = sumCharacterXp(experience.byCharacter);
    const after = getCharacterExperienceSummary(profile, characterId);
    return {
        characterId,
        previousTotalXp: before.totalXp,
        previousLevel: before.level,
        totalXp: after.totalXp,
        level: after.level
    };
}

export function getCharacterTotalXp(profile, characterId) {
    if (!characterId) return 0;
    return Math.max(0, profile?.experience?.byCharacter?.[characterId]?.currentXp ?? 0);
}

export function getExperienceRewardText(reward = {}) {
    return reward?.text ?? "";
}

function getNextRewardText(characterId, level) {
    const reward = getNextCharacterLevelReward(characterId, level);
    return reward ? `Lv.${reward.level} · ${getExperienceRewardText(reward)}` : "모든 레벨 보상 획득";
}

export function getExperienceRewardsBetween(characterId, previousLevel, level) {
    return getCharacterLevelRewardsBetween(characterId, previousLevel, level);
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
    const nextRewardText = isMax ? "최대 레벨" : getNextRewardText(characterId, level);

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
        previousLevelLabel: before.levelLabel,
        level: newLevel,
        levelUp: newLevel > prevLevel,
        earnedRewards: getExperienceRewardsBetween(characterId, prevLevel, newLevel),
        progressBefore: before.progress,
        progressAfter: after.progress,
        progressBeforePct: before.progressPct,
        progressAfterPct: after.progressPct,
        previousProgressText: before.progressText,
        previousNextText: before.nextText,
        previousNextRewardText: before.nextRewardText,
        remainingXp: after.remainingXp,
        progressText: after.progressText,
        nextText: after.nextText,
        nextRewardText: after.nextRewardText,
        levelLabel: after.levelLabel
    };
}

export function collectActiveExperienceProgression(profile, characterId) {
    const level = getLevelFromXp(getCharacterTotalXp(profile, characterId));
    return getCharacterLevelProgression(characterId, level);
}

export function applyExperienceProgressionToBall(ball, progression) {
    if (!progression) return;
    ball.progression = {
        characterId: progression.characterId,
        level: progression.level,
        baseStatBonuses: { ...progression.baseStatBonuses },
        abilityTier: 0,
        rewardIds: [...progression.rewardIds]
    };
    applyLevelRewardEffectsToBall(ball, progression.effects);
}

export function applyExperienceProgressionToBaseSpec(spec, progression) {
    return applyLevelRewardEffectsToBaseSpec(spec, progression?.effects);
}

export { calcMatchXp, calcTournamentXp, getLevelFromXp, getXpForNextLevel, getXpProgressInLevel };
