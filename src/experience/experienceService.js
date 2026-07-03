import { calcMatchXp, calcTournamentXp } from "./experienceState.js";
import { getLevelFromXp, getXpForNextLevel, getXpProgressInLevel } from "./experienceState.js";
import { LEVEL_REWARDS } from "./experienceConfig.js";

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

    if (totalXp <= 0) return { xpGained: 0, totalXp: 0, level: 1, levelUp: false };

    const prevTotal = profile.experience?.currentXp ?? 0;
    const prevLevel = getLevelFromXp(prevTotal);
    const newTotal = prevTotal + totalXp;
    const newLevel = getLevelFromXp(newTotal);

    profile.experience = profile.experience || { currentXp: 0 };
    profile.experience.currentXp = newTotal;

    return {
        xpGained: totalXp,
        totalXp: newTotal,
        level: newLevel,
        levelUp: newLevel > prevLevel
    };
}

export function collectActiveExperienceEffects(profile) {
    const level = getLevelFromXp(profile.experience?.currentXp ?? 0);
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
