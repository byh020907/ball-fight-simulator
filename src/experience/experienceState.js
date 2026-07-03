import {
    XP_SCALE,
    STAGE_MULTIPLIERS,
    COMEBACK_THRESHOLD,
    COMEBACK_WEIGHT,
    MAX_DEAL_RATIO,
    getLevelRequirement,
    MAX_LEVEL
} from "./experienceConfig.js";

const STAGE_MUL_MAP = Object.freeze({
    1: STAGE_MULTIPLIERS.round1,
    2: STAGE_MULTIPLIERS.round2,
    3: STAGE_MULTIPLIERS.final
});

export function getStageMultiplier(stage) {
    return STAGE_MUL_MAP[stage] ?? 1.0;
}

export function calcMatchXp({ damageDealt, opponentMaxHp, hpRemain, myMaxHp, minHpRatio, won, stage, mulOverride }) {
    const dealRatio = Math.min(damageDealt / Math.max(1, opponentMaxHp), MAX_DEAL_RATIO);
    const hpRemainRatio = won ? Math.max(0, hpRemain / Math.max(1, myMaxHp)) : 0;
    const comebackBonus = won
        ? Math.max(0, (COMEBACK_THRESHOLD - Math.min(COMEBACK_THRESHOLD, minHpRatio)) * COMEBACK_WEIGHT)
        : 0;
    const stageMul = mulOverride ?? getStageMultiplier(stage);
    const raw = (dealRatio + hpRemainRatio + comebackBonus) * stageMul * XP_SCALE;
    return Math.max(0, Math.round(raw));
}

export function getLevelFromXp(totalXp) {
    for (let level = MAX_LEVEL; level >= 1; level--) {
        if (totalXp >= getLevelRequirement(level)) return level;
    }
    return 1;
}

export function getXpForNextLevel(totalXp) {
    const level = getLevelFromXp(totalXp);
    if (level >= MAX_LEVEL) return 0;
    const currentReq = getLevelRequirement(level);
    const nextReq = getLevelRequirement(level + 1);
    return nextReq - currentReq;
}

export function getXpProgressInLevel(totalXp) {
    const level = getLevelFromXp(totalXp);
    if (level >= MAX_LEVEL) return 1;
    const currentReq = getLevelRequirement(level);
    const nextReq = getLevelRequirement(level + 1);
    return (totalXp - currentReq) / (nextReq - currentReq);
}

export function calcTournamentXp(matches, won) {
    let total = 0;
    for (const match of matches) {
        const stage = match.stage ?? 1;
        const mXp = calcMatchXp({
            damageDealt: match.damageDealt,
            opponentMaxHp: match.opponentMaxHp,
            hpRemain: match.hpRemain,
            myMaxHp: match.myMaxHp,
            minHpRatio: match.minHpRatio ?? 1,
            won: match.won,
            stage
        });
        match.xp = mXp;
        total += mXp;
    }
    if (won) {
        const finalMatch = matches[matches.length - 1];
        if (finalMatch) {
            const winBonus = calcMatchXp({
                damageDealt: finalMatch.damageDealt,
                opponentMaxHp: finalMatch.opponentMaxHp,
                hpRemain: finalMatch.hpRemain,
                myMaxHp: finalMatch.myMaxHp,
                minHpRatio: finalMatch.minHpRatio ?? 1,
                won: true,
                mulOverride: STAGE_MULTIPLIERS.winBonus
            });
            total += winBonus;
        }
    }
    return Math.round(total);
}
