// ── 업적 정의 ───────────────────────────────────────────────────────────────
//
// 각 업적은 표시 정보(id/name/description/tier), 평가 함수(evaluate),
// 선택적 보상(reward)을 함께 소유한다.
// ACHIEVEMENT_POOL 같은 단순 데이터 저장소를 두지 않고,
// 각 정의의 evaluate()가 자신의 달성 조건을 판단한다.
// ─────────────────────────────────────────────────────────────────────────────

import { getActionPool } from "../clickActions.js";
import { getCharacterMasteryLevel } from "../character-mastery/index.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { HUNTING_MONSTER_TAGS } from "../hunting/huntingMonsters.js";
import { HUNTING_STAGE_IDS } from "../hunting/huntingConfig.js";

const ACHIEVEMENT_REWARDS = REWARD_BALANCE.progression.achievementRewards;

function getHuntingStats(context) {
    return context.profile?.hunting?.stats ?? {};
}

function getMonsterKillCount(context, tag) {
    return getHuntingStats(context).monsterKillsByTag?.[tag] ?? 0;
}

function createHuntingCounterAchievement({ id, name, description, tier, target, rewardKey, getCurrent }) {
    const reward = ACHIEVEMENT_REWARDS[rewardKey];
    return {
        id,
        name,
        description,
        tier,
        evaluate(context) {
            return getCurrent(context) >= target;
        },
        getProgress(context) {
            return { current: getCurrent(context), target };
        },
        reward: { ...reward },
        grant(handler) {
            return reward.type === "SHARDS" ? handler.shards(reward.amount) : handler.chest(reward.rarity);
        }
    };
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
            return context.report.matchReports?.every((m) => m.combatDamageTaken === 0) ?? false;
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.flawlessTournament
        },
        grant(handler) {
            return handler.equipment({
                rarity: ACHIEVEMENT_REWARDS.flawlessTournament.rarity,
                ...ACHIEVEMENT_REWARDS.flawlessTournament.equipment
            });
        }
    },
    {
        id: "comeback_match_win",
        name: "대역전",
        description: "매치 중 HP 15% 이하를 기록한 뒤 해당 매치에서 승리하세요.",
        tier: "silver",
        evaluate(context) {
            // 현재 토너먼트 리포트에서 역전승 매치 확인
            const hasComeback =
                context.report?.matchReports?.some((m) => m.playerWon && m.lowestHpRatio < 0.15) ?? false;
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
            return handler.equipment({
                rarity: ACHIEVEMENT_REWARDS.rosterChampion.rarity,
                ...ACHIEVEMENT_REWARDS.rosterChampion.equipment
            });
        }
    },
    {
        id: "mastery_complete",
        name: "도감 완성",
        description: "모든 캐릭터의 숙련도를 3단계까지 달성하세요.",
        tier: "gold",
        evaluate(context) {
            return context.roster.every((fighter) => getCharacterMasteryLevel(context.profile, fighter.id) >= 3);
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.masteryComplete
        },
        grant(handler) {
            return handler.equipment({
                rarity: ACHIEVEMENT_REWARDS.masteryComplete.rarity,
                ...ACHIEVEMENT_REWARDS.masteryComplete.equipment
            });
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
            return context.report?.matchReports?.some((m) => (m.maxHitDamage ?? 0) >= 150) ?? false;
        },
        reward: {
            ...ACHIEVEMENT_REWARDS.singleHitMonster
        },
        grant(handler) {
            return handler.equipment({
                rarity: ACHIEVEMENT_REWARDS.singleHitMonster.rarity,
                ...ACHIEVEMENT_REWARDS.singleHitMonster.equipment
            });
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
            payload: { feature: "battle_speed_2x", description: "2배속 관전 전환 해금 (관전 전투 화면 터치)" }
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
            payload: { feature: "battle_speed_4x", description: "4배속 관전 전환 해금 (관전 전투 화면 터치)" }
        },
        grant(handler) {
            return handler.unlockFeature("battle_speed_4x");
        }
    },
    createHuntingCounterAchievement({
        id: "hunting_depth_30",
        name: "심층 탐사자",
        description: "사냥터 30층에 도달하세요.",
        tier: "bronze",
        target: 30,
        rewardKey: "huntingDepth30",
        getCurrent: (context) => getHuntingStats(context).deepestFloor ?? 0
    }),
    createHuntingCounterAchievement({
        id: "hunting_critical_hp_win",
        name: "위기 돌파",
        description: "전투 시작 시 HP 20% 이하인 상태로 사냥터 전투에서 승리하세요.",
        tier: "silver",
        target: 1,
        rewardKey: "huntingCriticalHpWin",
        getCurrent: (context) => getHuntingStats(context).criticalHpCombatWins ?? 0
    }),
    createHuntingCounterAchievement({
        id: "hunting_portal_retreat_40",
        name: "무사 귀환",
        description: "40층 이상에서 포탈로 귀환하세요.",
        tier: "silver",
        target: 40,
        rewardKey: "huntingPortalRetreat40",
        getCurrent: (context) => getHuntingStats(context).bestPortalRetreatFloor ?? 0
    }),
    createHuntingCounterAchievement({
        id: "hunting_champion_victory",
        name: "난입 저지",
        description: "챔피언 난입 전투에서 승리하세요.",
        tier: "bronze",
        target: 1,
        rewardKey: "huntingChampionVictory",
        getCurrent: (context) => getHuntingStats(context).championVictories ?? 0
    }),
    createHuntingCounterAchievement({
        id: "hunting_secured_chests_10",
        name: "보관 전문가",
        description: "사냥터에서 상자 10개를 확보하세요.",
        tier: "bronze",
        target: 10,
        rewardKey: "huntingSecuredChests",
        getCurrent: (context) => getHuntingStats(context).securedChestCount ?? 0
    }),
    createHuntingCounterAchievement({
        id: "hunting_all_stages_clear",
        name: "전 지역 제패",
        description: "동굴, 숲, 사막의 최종 보스를 모두 처치하세요.",
        tier: "gold",
        target: Object.values(HUNTING_STAGE_IDS).length,
        rewardKey: "huntingAllStagesClear",
        getCurrent: (context) => getHuntingStats(context).clearedStageIds?.length ?? 0
    }),
    createHuntingCounterAchievement({
        id: "hunting_monster_slayer",
        name: "몹 학살자",
        description: "일반 몬스터를 300마리 처치하세요.",
        tier: "bronze",
        target: 300,
        rewardKey: "huntingMonsterSlayer",
        getCurrent: (context) => getMonsterKillCount(context, HUNTING_MONSTER_TAGS.MONSTER)
    }),
    createHuntingCounterAchievement({
        id: "hunting_rare_monster_slayer",
        name: "레어 몹 학살자",
        description: "레어 몬스터를 100마리 처치하세요.",
        tier: "silver",
        target: 100,
        rewardKey: "huntingRareMonsterSlayer",
        getCurrent: (context) => getMonsterKillCount(context, HUNTING_MONSTER_TAGS.RARITY_RARE)
    }),
    createHuntingCounterAchievement({
        id: "hunting_unique_monster_slayer",
        name: "유니크 몹 학살자",
        description: "유니크 몬스터를 75마리 처치하세요.",
        tier: "gold",
        target: 75,
        rewardKey: "huntingUniqueMonsterSlayer",
        getCurrent: (context) => getMonsterKillCount(context, HUNTING_MONSTER_TAGS.RARITY_UNIQUE)
    }),
    createHuntingCounterAchievement({
        id: "hunting_epic_monster_slayer",
        name: "에픽 몹 학살자",
        description: "에픽 몬스터를 50마리 처치하세요.",
        tier: "gold",
        target: 50,
        rewardKey: "huntingEpicMonsterSlayer",
        getCurrent: (context) => getMonsterKillCount(context, HUNTING_MONSTER_TAGS.RARITY_EPIC)
    })
]);
