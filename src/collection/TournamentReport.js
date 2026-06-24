// ── 토너먼트 리포트 ──────────────────────────────────────────────────────────
// 토너먼트 완료 후 한 번 생성. 중복 반영 방지를 위해 reportId 보유.

import { VALID_CHARACTER_IDS } from "../playerProfile.js";
import { createMatchReport } from "./matchReport.js";

let _reportIdCounter = 0;

export function createTournamentReport({ generateId } = {}) {
    const id = generateId ? generateId() : (crypto.randomUUID?.() ?? String(++_reportIdCounter));
    return {
        reportId: id,
        playerFighterId: null,
        playerWon: false,
        placement: null,
        matchReports: [],
        timestamp: Date.now()
    };
}

export function addMatchReport(tournamentReport, matchReport) {
    tournamentReport.matchReports.push(matchReport);
}

/**
 * 토너먼트 리포트를 플레이어 프로필에 반영.
 * 중복 반영 방지: 이미 처리된 reportId는 건너뜀.
 * @returns {{ alreadyProcessed: boolean }}
 */
export function applyTournamentReport(profile, report) {
    const processed = profile.collection.careerStats.processedTournamentReportIds;
    if (processed.includes(report.reportId)) {
        return { alreadyProcessed: true };
    }

    const charId = report.playerFighterId;
    if (!VALID_CHARACTER_IDS.includes(charId)) {
        return { alreadyProcessed: false };
    }

    // 캐릭터 기록 초기화 (없으면 생성)
    const charRecord = profile.collection.characters[charId] || createDefaultCharRecord();
    profile.collection.characters[charId] = charRecord;

    // 토너먼트 완료 카운트
    charRecord.tournamentsCompleted += 1;
    profile.collection.careerStats.playerTournamentsCompleted += 1;

    // 우승 처리
    if (report.playerWon) {
        charRecord.tournamentWins += 1;
        profile.collection.careerStats.currentTournamentWinStreak += 1;
        if (
            profile.collection.careerStats.currentTournamentWinStreak >
            profile.collection.careerStats.bestTournamentWinStreak
        ) {
            profile.collection.careerStats.bestTournamentWinStreak =
                profile.collection.careerStats.currentTournamentWinStreak;
        }
    } else {
        profile.collection.careerStats.currentTournamentWinStreak = 0;
    }

    // 배치
    if (report.placement != null) {
        const currentBest = charRecord.bestPlacement;
        if (currentBest == null || report.placement < currentBest) {
            charRecord.bestPlacement = report.placement;
        }
    }

    // 첫/마지막 토너먼트 시간
    const now = report.timestamp || Date.now();
    if (!charRecord.firstTournamentAt) {
        charRecord.firstTournamentAt = now;
    }
    charRecord.lastTournamentAt = now;

    // 매치 기록 반영
    for (const match of report.matchReports) {
        charRecord.matchWins += match.playerWon ? 1 : 0;
        charRecord.totalDamageDealt += match.combatDamageDealt || 0;
        profile.collection.careerStats.playerMatchesCompleted += 1;

        // 역전승
        if (match.playerWon && match.lowestHpRatio < 0.15) {
            charRecord.comebackMatchWins += 1;
        }

        // 액션 기록
        for (const actionId of match.usedActionIds || []) {
            if (!profile.collection.careerStats.usedActionIds.includes(actionId)) {
                profile.collection.careerStats.usedActionIds.push(actionId);
            }
        }
        for (const [actionId, count] of Object.entries(match.actionSuccessCounts || {})) {
            profile.collection.careerStats.actionSuccessCounts[actionId] =
                (profile.collection.careerStats.actionSuccessCounts[actionId] || 0) + count;
        }
    }

    // 중복 방지 목록 갱신
    processed.push(report.reportId);
    if (processed.length > 64) {
        profile.collection.careerStats.processedTournamentReportIds = processed.slice(-64);
    }

    return { alreadyProcessed: false };
}

function createDefaultCharRecord() {
    return {
        tournamentsCompleted: 0,
        tournamentWins: 0,
        matchWins: 0,
        bestPlacement: null,
        totalDamageDealt: 0,
        comebackMatchWins: 0,
        firstTournamentAt: null,
        lastTournamentAt: null
    };
}
