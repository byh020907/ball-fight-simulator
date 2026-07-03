// ── 매치 리포트 ─────────────────────────────────────────────────────────────
// 전투가 끝난 직후 생성되어 토너먼트 종료 시 플레이어 프로필에 반영됨.

import { STAT_ORB_KEYS } from "../entities/index.js";

let _reportIdCounter = 0;

/**
 * @param {object} options
 * @param {function} [options.generateId] - ID 생성기, 테스트에서 주입 가능
 */
export function createMatchReport({ generateId } = {}) {
    const id = generateId ? generateId() : (crypto.randomUUID?.() ?? String(++_reportIdCounter));
    return {
        reportId: id,
        playerFighterId: null,
        playerWon: false,
        isTournamentFinal: false,
        // 피해 기록
        combatDamageTaken: 0,
        combatDamageDealt: 0,
        maxHitDamage: 0,
        actionHpCost: 0,
        lowestHpRatio: 1,
        opponentMaxHp: 0,
        hpRemain: 0,
        myMaxHp: 0,
        // 액션 기록
        usedActionIds: [],
        actionSuccessCounts: {},
        // 수집용
        tournamentRoundIndex: -1,
        timestamp: Date.now()
    };
}

export function recordDamageTaken(report, actualDamage) {
    if (actualDamage <= 0) return;
    report.combatDamageTaken += actualDamage;
}

export function recordDamageDealt(report, actualDamage) {
    if (actualDamage <= 0) return;
    report.combatDamageDealt += actualDamage;
    if (actualDamage > report.maxHitDamage) {
        report.maxHitDamage = actualDamage;
    }
}

export function recordActionHpCost(report, cost) {
    if (cost <= 0) return;
    report.actionHpCost += cost;
}

export function recordActionUsed(report, actionId) {
    if (!actionId) return;
    if (!report.usedActionIds.includes(actionId)) {
        report.usedActionIds.push(actionId);
    }
}

export function recordActionSuccess(report, actionId) {
    if (!actionId) return;
    report.actionSuccessCounts[actionId] = (report.actionSuccessCounts[actionId] ?? 0) + 1;
}

export function recordLowestHp(report, currentHp, maxHp) {
    if (maxHp <= 0) return;
    const ratio = currentHp / maxHp;
    if (ratio < report.lowestHpRatio) {
        report.lowestHpRatio = ratio;
    }
}
