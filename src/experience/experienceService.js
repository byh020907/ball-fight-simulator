import { calcMatchXp, calcTournamentXp } from "./experienceState.js";
import { getLevelFromXp, getXpForNextLevel, getXpProgressInLevel } from "./experienceState.js";
import { LEVEL_REWARDS, MAX_LEVEL, getLevelRequirement } from "./experienceConfig.js";

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
    const parts = [];
    if (reward.hp) parts.push(`HP +${reward.hp}`);
    if (reward.damage) parts.push(`공격 +${reward.damage}`);
    if (reward.abilityCooldownPercent) parts.push(`쿨타임 ${reward.abilityCooldownPercent}%`);
    if (reward.signatureBonusPercent) parts.push(`대표 행동 +${reward.signatureBonusPercent}%`);
    if (reward.actionHpCostPercent) parts.push(`액션 비용 ${reward.actionHpCostPercent}%`);
    if (reward.title) parts.push("칭호 해금");
    return parts.join(" · ");
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
    const merged = {
        hp: 0,
        damage: 0,
        actionHpCostPercent: 0,
        abilityCooldownPercent: 0,
        signatureBonusPercent: 0,
        title: false
    };
    for (let lv = 2; lv <= level; lv++) {
        const reward = LEVEL_REWARDS[lv];
        if (!reward) continue;
        for (const [key, value] of Object.entries(reward)) {
            if (key === "title") {
                merged.title = true;
            } else if (typeof value === "number") {
                merged[key] = (merged[key] ?? 0) + value;
            }
        }
    }
    return merged;
}

/**
 * XP 레벨 보상을 playerSpec에 적용 (startTournament에서 호출).
 */
export function applyExperienceEffectsToSpec(playerSpec, xpEffects) {
    if (xpEffects.hp) playerSpec.stats.hp += xpEffects.hp;
    if (xpEffects.damage) playerSpec.stats.damage += xpEffects.damage;
    if (xpEffects.actionHpCostPercent) {
        const reduction = Math.abs(xpEffects.actionHpCostPercent) / 100;
        playerSpec.mastery ||= { physics: {}, action: {}, passives: [] };
        playerSpec.mastery.action = {
            ...(playerSpec.mastery.action || {}),
            hpCostPercentReduction: (playerSpec.mastery.action?.hpCostPercentReduction ?? 0) + reduction
        };
    }
    if (xpEffects.abilityCooldownPercent || xpEffects.signatureBonusPercent) {
        playerSpec.mastery ||= { physics: {}, action: {}, passives: [] };
        playerSpec.mastery.action ||= {};
        if (xpEffects.abilityCooldownPercent) {
            playerSpec.mastery.action.cooldownPercent =
                (playerSpec.mastery.action?.cooldownPercent ?? 0) + xpEffects.abilityCooldownPercent;
        }
        if (xpEffects.signatureBonusPercent) {
            playerSpec.mastery.action.signatureBonusPercent =
                (playerSpec.mastery.action?.signatureBonusPercent ?? 0) + xpEffects.signatureBonusPercent;
        }
    }
}

export { calcMatchXp, calcTournamentXp, getLevelFromXp, getXpForNextLevel, getXpProgressInLevel };
