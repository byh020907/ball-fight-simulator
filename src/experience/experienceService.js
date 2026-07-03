import { calcMatchXp, calcTournamentXp } from "./experienceState.js";
import { getLevelFromXp, getXpForNextLevel, getXpProgressInLevel } from "./experienceState.js";

export function matchReportToXpInput(report) {
    return {
        damageDealt: report.combatDamageDealt,
        opponentMaxHp: report.opponentMaxHp,
        hpRemain: report.hpRemain,
        myMaxHp: report.myMaxHp,
        minHpRatio: report.lowestHpRatio,
        won: report.playerWon,
        stage: report.tournamentRoundIndex
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

export { calcMatchXp, calcTournamentXp, getLevelFromXp, getXpForNextLevel, getXpProgressInLevel };
