// ── 업적 정의 ───────────────────────────────────────────────────────────────
//
// 각 업적은 표시 정보(id/name/description/tier), 평가 함수(evaluate),
// 선택적 보상(reward)을 함께 소유한다.
// ACHIEVEMENT_POOL 같은 단순 데이터 저장소를 두지 않고,
// 각 정의의 evaluate()가 자신의 달성 조건을 판단한다.
// ─────────────────────────────────────────────────────────────────────────────

import { getActionPool } from "../clickActions.js";
import { MASTERY_THRESHOLDS } from "./collectionViewModel.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const ACHIEVEMENT_REWARDS = REWARD_BALANCE.progression.achievementRewards;

/**
 * 숙련도 계산 (collection-view-model.js와 동일한 로직)
 * @param {number} tournamentWins
 * @returns {number} 0-3
 */
function getMasteryLevel(tournamentWins) {
    if (tournamentWins >= MASTERY_THRESHOLDS[2]) return 3;
    if (tournamentWins >= MASTERY_THRESHOLDS[1]) return 2;
    if (tournamentWins >= MASTERY_THRESHOLDS[0]) return 1;
    return 0;
}

/**
 * @typedef {object} AchievementContext
 * @property {object} profile - 전체 플레이어 프로필 (applyTournamentReport 적용 후)
 * @property {object} report - 현재 토너먼트 리포트 (matchReports 포함)
 * @property {Array} roster - 전체 로스터
 * @property {string} playerFighterId - 현재 플레이어 캐릭터 ID
 */

/** @type {ReadonlyArray<Readonly<{id:string,name:string,description:string,tier:string,evaluate:(ctx:AchievementContext)=>boolean,reward:object|null,grant:(handler:object)=>object}>>} */
export const ACHIEVEMENT_DEFINITIONS = Object.freeze([
    {
        id: "first_tournament_win",
        name: "첫 우승",
        description: "토너먼트에서 처음 우승하세요.",
        tier: "bronze",
        evaluate(context) {
            const career = context.profile.collection.careerStats;
            return career.playerTournamentsCompleted >= 1 && context.report?.playerWon === true;
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.firstTournamentWin
        },
        grant(handler) {
            return handler.shards(ACHIEVEMENT_REWARDS.firstTournamentWin.amount);
        }
    },
    {
        id: "flawless_tournament",
        name: "무결점 우승",
        description: "한 토너먼트의 모든 매치에서 전투 피해 0으로 우승하세요.",
        tier: "gold",
        evaluate(context) {
            if (!context.report?.playerWon) return false;
            return context.report.matchReports.every((m) => m.combatDamageTaken === 0);
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.flawlessTournament
        },
        grant(handler) {
            return handler.equipment(ACHIEVEMENT_REWARDS.flawlessTournament.rarity);
        }
    },
    {
        id: "comeback_match_win",
        name: "대역전",
        description: "매치 중 HP 15% 이하를 기록한 뒤 해당 매치에서 승리하세요.",
        tier: "silver",
        evaluate(context) {
            // 현재 토너먼트 리포트에서 역전승 매치 확인
            const hasComeback = context.report.matchReports.some((m) => m.playerWon && m.lowestHpRatio < 0.15);
            if (hasComeback) return true;

            // 이미 누적된 역전승 기록도 확인 (캐릭터 전체 합산)
            const characters = context.profile.collection.characters;
            return Object.values(characters).some((record) => (record.comebackMatchWins ?? 0) > 0);
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.comebackMatchWin
        },
        grant(handler) {
            return handler.chest(ACHIEVEMENT_REWARDS.comebackMatchWin.rarity);
        }
    },
    {
        id: "counter_expert",
        name: "반격 전문가",
        description: "카운터 액션을 10회 성공시키세요.",
        tier: "silver",
        evaluate(context) {
            const successCounts = context.profile.collection.careerStats.actionSuccessCounts ?? {};
            return (successCounts.counter ?? 0) >= 10;
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.counterExpert
        },
        grant(handler) {
            return handler.chest(ACHIEVEMENT_REWARDS.counterExpert.rarity);
        }
    },
    {
        id: "all_actions_used",
        name: "만능 플레이어",
        description: "모든 액션을 1회 이상 사용하세요.",
        tier: "bronze",
        evaluate(context) {
            const allActionIds = getActionPool().map((a) => a.id);
            const usedIds = context.profile.collection.careerStats.usedActionIds ?? [];
            return allActionIds.every((id) => usedIds.includes(id));
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.allActionsUsed
        },
        grant(handler) {
            return handler.chest(ACHIEVEMENT_REWARDS.allActionsUsed.rarity);
        }
    },
    {
        id: "roster_champion",
        name: "전캐릭터 우승",
        description: "모든 캐릭터로 토너먼트에서 1회 이상 우승하세요.",
        tier: "gold",
        evaluate(context) {
            return context.roster.every(
                (fighter) => (context.profile.collection.characters[fighter.id]?.tournamentWins ?? 0) >= 1
            );
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.rosterChampion
        },
        grant(handler) {
            return handler.equipment(ACHIEVEMENT_REWARDS.rosterChampion.rarity);
        }
    },
    {
        id: "mastery_complete",
        name: "도감 완성",
        description: "모든 캐릭터의 숙련도를 3단계까지 달성하세요.",
        tier: "gold",
        evaluate(context) {
            return context.roster.every((fighter) => {
                const wins = context.profile.collection.characters[fighter.id]?.tournamentWins ?? 0;
                return getMasteryLevel(wins) >= 3;
            });
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.masteryComplete
        },
        grant(handler) {
            return handler.equipment(ACHIEVEMENT_REWARDS.masteryComplete.rarity);
        }
    },
    {
        id: "marathon_50",
        name: "끈기",
        description: "플레이어가 참가한 매치를 50회 완료하세요.",
        tier: "bronze",
        evaluate(context) {
            return (context.profile.collection.careerStats.playerMatchesCompleted ?? 0) >= 50;
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.marathon50
        },
        grant(handler) {
            return handler.chest(ACHIEVEMENT_REWARDS.marathon50.rarity);
        }
    },
    {
        id: "single_hit_monster",
        name: "단일 대미지 150",
        description: "한 번의 공격으로 150 이상의 피해를 주세요.",
        tier: "gold",
        evaluate(context) {
            return context.report.matchReports.some((m) => (m.maxHitDamage ?? 0) >= 150);
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.singleHitMonster
        },
        grant(handler) {
            return handler.equipment(ACHIEVEMENT_REWARDS.singleHitMonster.rarity);
        }
    },
    {
        id: "tournament_streak_3",
        name: "연승",
        description: "토너먼트 3회 연속 우승하세요.",
        tier: "silver",
        evaluate(context) {
            const career = context.profile.collection.careerStats;
            return (career.bestTournamentWinStreak ?? 0) >= 3;
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.tournamentStreak3
        },
        grant(handler) {
            return handler.chest(ACHIEVEMENT_REWARDS.tournamentStreak3.rarity);
        }
    },
    {
        id: "speed_2x",
        name: "속도 해방 1단계",
        description: "토너먼트에서 처음 우승하세요.",
        tier: "bronze",
        evaluate(context) {
            const career = context.profile.collection.careerStats;
            return career.playerTournamentsCompleted >= 1 && context.report?.playerWon === true;
        },
        reward: {
            type: "FEATURE_UNLOCK",
            payload: { feature: "battle_speed_2x", description: "2배속 전투 관전 해금 (전투화면 상단 탭)" }
        },
        grant(handler) {
            return handler.unlockFeature("battle_speed_2x");
        }
    },
    {
        id: "speed_4x",
        name: "속도 해방 2단계",
        description: "토너먼트에서 3회 연속 우승하세요.",
        tier: "silver",
        evaluate(context) {
            const career = context.profile.collection.careerStats;
            return (career.bestTournamentWinStreak ?? 0) >= 3;
        },
        reward: {
            type: "FEATURE_UNLOCK",
            payload: { feature: "battle_speed_4x", description: "4배속 전투 관전 해금 (전투화면 상단 탭)" }
        },
        grant(handler) {
            return handler.unlockFeature("battle_speed_4x");
        }
    }
]);
