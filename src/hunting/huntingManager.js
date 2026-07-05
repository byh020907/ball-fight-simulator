import {
    createHuntingRun,
    recordHuntingFloorResult,
    advanceHuntingRun,
    retreatHuntingRun,
    defeatHuntingRun,
    canRetreatFromHuntingRun,
    completeHuntingStage,
    getEligibleHuntingCharacters,
    canEnterHunting,
    getSelectedHuntingStageId,
    applyHuntingEventRecovery,
    applyHuntingCursedAltar,
    applyHuntingStatModifiersToSpec
} from "./huntingState.js";
import { rollShardReward, createHuntingChest, createEmptyHuntingLoot } from "./huntingRewards.js";
import {
    HUNTING_ADVANCE_STEPS,
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_FLOOR_OUTCOME_TYPES
} from "./huntingConfig.js";
import { getHuntingStage, getHuntingStageArena, getNextHuntingStageId } from "./huntingEncounters.js";
import { applyEquipmentStats } from "./equipmentConfig.js";
import {
    HUNTING_TEAMS,
    createHuntingMinibossSpec,
    createHuntingMobEncounter,
    shouldUseRosterMiniboss
} from "./huntingMonsters.js";
import { createMatchReport, recordLowestHp } from "../collection/index.js";
import { grantExperienceFromMatchReport } from "../experience/experienceService.js";
import { applyStatAllocation } from "../statAllocation.js";
import { savePlayerProfile } from "../playerProfile.js";

export class HuntingManager {
    constructor(app) {
        this.app = app;
        this._run = null;
        this._moving = false;
    }

    showCharacterSelect() {
        const app = this.app;
        const eligible = getEligibleHuntingCharacters(app.playerProfile, app.roster);
        if (eligible.length === 0) {
            if (window.PopupService) {
                window.PopupService.show({
                    title: "사냥터",
                    bodyHtml:
                        '<p style="padding:12px 0">사냥터에 입장하려면 먼저 토너먼트에서 우승한 캐릭터가 필요합니다.</p>'
                });
            }
            return;
        }

        const bodyHtml = `
            <div class="hunting-char-grid">
                ${eligible
                    .map(
                        (c) => `
                    <button class="hunting-char-btn" data-char="${c.id}" style="border-color:${c.color}">
                        <strong>${c.name}</strong>
                        <span>${c.title}</span>
                    </button>
                `
                    )
                    .join("")}
            </div>
            <p style="margin-top:8px;font-size:0.75rem;color:#888">우승 경험 캐릭터만 입장 가능</p>
        `;

        if (window.PopupService) {
            window.PopupService.show({ title: "사냥터 — 캐릭터 선택", bodyHtml });
            // Delegate click on character buttons
            setTimeout(() => {
                document.querySelectorAll(".hunting-char-btn").forEach((btn) => {
                    btn.addEventListener("click", () => {
                        const charId = btn.dataset.char;
                        this.startRun(charId);
                    });
                });
            }, 50);
        }
    }

    startRun(characterId) {
        if (window.PopupService) window.PopupService.close();
        if (!canEnterHunting(this.app.playerProfile, characterId)) return;
        const stageId = getSelectedHuntingStageId(this.app.playerProfile);
        this._run = createHuntingRun({ characterId, stageId });
        this.app.playerFighterId = characterId;
        this.app.ui.setHuntingActive(true);
        this.app.ui.setHuntingOverlayState({ huntingChoiceVisible: false });
        const stage = getHuntingStage(stageId);
        this.app.ui.addLog(`[Hunting] ${stage.name} 원정 시작`);
        this.advance();
    }

    _startFloorBattle() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;

        const playerSpec = app.roster.find((f) => f.id === run.characterId);
        if (!playerSpec) return;

        const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
        const encounterEnemyType = run.lastEncounter?.enemyType;
        const minibossType =
            isFinalBoss || run.lastEvent?.type === HUNTING_EVENT_TYPES.CHAMPION_INTRUSION
                ? HUNTING_ENEMY_TYPES.CHAMPION
                : encounterEnemyType === HUNTING_ENEMY_TYPES.ELITE
                  ? HUNTING_ENEMY_TYPES.ELITE
                  : HUNTING_ENEMY_TYPES.ELITE;
        const mobSpecs = createHuntingMobEncounter({ floor: run.floor });
        const miniboss =
            isFinalBoss || shouldUseRosterMiniboss(run.floor, run.lastEvent)
                ? createHuntingMinibossSpec({
                      roster: app.roster,
                      characterId: run.characterId,
                      floor: run.floor,
                      enemyType: minibossType
                  })
                : null;
        const enemySpecs = miniboss ? [miniboss, ...mobSpecs.slice(0, Math.max(1, mobSpecs.length - 1))] : mobSpecs;

        const appliedSpec = applyHuntingStatModifiersToSpec(
            applyEquipmentStats(
                { ...applyStatAllocation(playerSpec, app.playerStatAllocation, true), teamId: HUNTING_TEAMS.PLAYER },
                app.playerProfile
            ),
            run.statModifiers
        );
        const matchSpecs = [appliedSpec, ...enemySpecs];
        app._currentMatchReport = createMatchReport();
        app._currentMatchReport.playerFighterId = run.characterId;

        app._onSimulationResult = (a) => this._handleFinish(a);

        app.playerFighterId = run.characterId;

        const arena = getHuntingStageArena(run.stageId);
        app.startMatch(matchSpecs, {
            keepLog: false,
            skipActionPick: true,
            arenaWidth: arena.WIDTH,
            arenaHeight: arena.HEIGHT,
            cameraZoom: 1
        });

        if (run.carriedHp !== null) {
            const ball = app.simulation?.fighters?.find((f) => f.id === run.characterId);
            if (ball) {
                ball.hp = Math.min(ball.maxHp, Math.max(1, run.carriedHp));
            }
        }
    }

    _handleFinish(app) {
        app._cleanupMatch();
        app.matchFinalized = true;
        app._onSimulationResult = null;

        const run = this._run;
        if (!run) return;

        const playerBall = app.simulation.fighters.find((f) => f.id === run.characterId);
        const winner = app.simulation.winner;
        const playerWon = Boolean(
            playerBall &&
            winner &&
            (winner === playerBall ||
                (typeof app.simulation.isHostile === "function" && !app.simulation.isHostile(winner, playerBall)))
        );

        if (app._currentMatchReport) {
            app._currentMatchReport.playerWon = playerWon;
            if (playerBall) {
                recordLowestHp(app._currentMatchReport, playerBall.hp, playerBall.maxHp);
                app._currentMatchReport.hpRemain = playerBall.hp;
                app._currentMatchReport.myMaxHp = playerBall.maxHp;
            }
            const oppMaxHp = app.simulation.fighters
                .filter((f) => f.id !== run.characterId)
                .reduce((s, f) => s + f.maxHp, 0);
            app._currentMatchReport.opponentMaxHp = oppMaxHp;

            const xpResult = grantExperienceFromMatchReport(app.playerProfile, app._currentMatchReport);
            if (xpResult?.xpGained > 0) {
                app.ui.addLog(`[사냥터 XP] ${xpResult.xpGained}XP (Lv.${xpResult.level})`);
            }
            app._currentMatchReport = null;
        }

        if (playerWon) {
            const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
            const rewardMultiplier = isFinalBoss
                ? 2
                : run.lastEvent?.type === HUNTING_EVENT_TYPES.CHAMPION_INTRUSION
                  ? (run.lastEvent.rewardMultiplier ?? 1.5)
                  : run.floor % 3 === 0
                    ? 1.25
                    : 1;
            const rewardEnemyType =
                isFinalBoss || run.lastEvent?.type === HUNTING_EVENT_TYPES.CHAMPION_INTRUSION
                    ? HUNTING_ENEMY_TYPES.CHAMPION
                    : run.floor % 3 === 0
                      ? HUNTING_ENEMY_TYPES.ELITE
                      : HUNTING_ENEMY_TYPES.NORMAL;
            const floorLoot = {
                shards: Math.round(
                    rollShardReward({ floor: run.floor, enemyType: rewardEnemyType }) * rewardMultiplier
                ),
                chests: Math.random() < 0.15 ? [createHuntingChest({ rarity: "common" })] : [],
                xp: 0
            };

            this._run = recordHuntingFloorResult(run, {
                hpRemain: Math.ceil(playerBall?.hp ?? run.carriedHp ?? 0),
                maxHp: playerBall?.maxHp ?? run.carriedMaxHp,
                loot: floorLoot
            });

            const name = playerBall?.name ?? run.characterId;
            const shardsText = `파편 +${floorLoot.shards}`;
            const pendingText = `보유 파편 ${this._run.pendingLoot.shards}`;
            const subtext = `층 ${run.floor} 완료 · ${shardsText}`;

            if (isFinalBoss) {
                const stage = getHuntingStage(run.stageId);
                const nextStageId = getNextHuntingStageId(run.stageId);
                const stageResult = completeHuntingStage(app.playerProfile, run.stageId);
                this._run = retreatHuntingRun(this._run, { reason: "stage_clear" });
                const securedShards = this._run.securedLoot?.shards ?? 0;
                this._mergeIntoSecured(app);
                app._refreshCollectionHub();
                app.refreshPlayerSetup();
                app.ui.setHuntingActive(false);
                app.ui.setHuntingOverlayState({
                    huntingChoiceVisible: false,
                    huntingCanRetreat: false,
                    huntingMoving: false
                });
                app._huntingDone = true;
                app.ui.showOverlay(
                    "스테이지 클리어",
                    `${stage.name} 보스 격파`,
                    stageResult.unlockedStageId
                        ? `${getHuntingStage(nextStageId).name} 해금 · 파편 ${securedShards} 확보`
                        : `파편 ${securedShards} 확보`
                );
                app.ui.setStartButton({ text: "확인", hidden: false, disabled: false });
                this._run = null;
                return;
            }

            app.ui.showOverlay("사냥터", `${name} 승리!`, subtext);
            app.ui.setHuntingOverlayState({
                huntingChoiceVisible: true,
                huntingCanRetreat: false,
                huntingMoving: false,
                huntingFloor: run.floor,
                huntingCharacterName: name,
                huntingLootSummary: pendingText
            });
            app.ui.setStartButton({ hidden: true, disabled: true, text: "" });
            savePlayerProfile(app.playerProfile);
        } else {
            this._run = defeatHuntingRun(run);
            const name = playerBall?.name ?? run.characterId;
            const securedShards = this._run.securedLoot?.shards ?? 0;
            const lostShards = this._run.defeatLosses?.shards ?? 0;

            this._mergeIntoSecured(app);
            app._refreshCollectionHub();
            app.refreshPlayerSetup();

            app.ui.showOverlay("사냥터 패배", `${name} 쓰러짐`, `획득 ${securedShards} 파편 · 손실 ${lostShards} 파편`);
            app.ui.setHuntingActive(false);
            app.ui.setHuntingOverlayState({ huntingChoiceVisible: false });
            app._huntingDone = true;
            app.ui.setStartButton({ text: "확인", hidden: false, disabled: false });
            this._run = null;
        }
    }

    retreat() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        if (!canRetreatFromHuntingRun(run)) {
            app.ui.showToast("포탈을 발견해야 귀환할 수 있습니다.");
            return;
        }

        this._run = retreatHuntingRun(run);
        const securedShards = this._run.securedLoot?.shards ?? 0;

        this._mergeIntoSecured(app);
        app._refreshCollectionHub();
        app.refreshPlayerSetup();

        app.ui.setHuntingActive(false);
        app.ui.setHuntingOverlayState({ huntingChoiceVisible: false });

        app._huntingDone = true;
        app.ui.showOverlay("사냥터 종료", "귀환 완료", `파편 ${securedShards} 확보 · 최고 층 ${run.floor}`);
        app.ui.setStartButton({ text: "확인", hidden: false, disabled: false });
        this._run = null;
    }

    advance() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;

        this._run = advanceHuntingRun(this._run);
        if (this._run.status !== "active") {
            this.retreat();
            return;
        }

        app.ui.setHuntingOverlayState({ huntingChoiceVisible: false });

        const event = this._run.lastEvent;
        if (event) {
            if (event.type === HUNTING_EVENT_TYPES.REST_SITE) {
                const healAmount = Math.floor(
                    (this._run.carriedMaxHp ?? this._run.carriedHp ?? 100) * (event.recoveryRatio ?? 0.25)
                );
                this._run = applyHuntingEventRecovery(this._run, { amount: healAmount });
                const name = app.roster.find((f) => f.id === run.characterId)?.name ?? run.characterId;
                app.ui.addLog(`[Hunting] Rest site: ${name} recovered ${healAmount} HP`);
                app.ui.showToast(`Rest site: HP +${healAmount}`);
            } else if (event.type === HUNTING_EVENT_TYPES.CHEST_ROOM) {
                const chest = createHuntingChest({ rarity: event.chestRarity ?? "common" });
                this._run = recordHuntingFloorResult(this._run, {
                    hpRemain: run.carriedHp,
                    maxHp: run.carriedMaxHp,
                    loot: { shards: 0, chests: [chest], xp: 0 },
                    consumeStatModifiers: false
                });
                app.ui.addLog(`[Hunting] Chest room: gained ${chest.rarity} chest`);
                app.ui.showToast(`Chest room: ${chest.rarity} chest`);
            } else if (event.type === HUNTING_EVENT_TYPES.CURSED_ALTAR) {
                this._run = applyHuntingCursedAltar(this._run, { trade: event.trade });
                app.ui.addLog(
                    `[Hunting] Cursed altar: ${event.trade?.gainStat} x${event.trade?.gainMultiplier} / ${event.trade?.loseStat} x${event.trade?.loseMultiplier}`
                );
                app.ui.showToast("Cursed altar: stat trade active");
            } else if (event.type === HUNTING_EVENT_TYPES.CHAMPION_INTRUSION) {
                app.ui.addLog("[Hunting] Champion intrusion: next floor includes an empowered miniboss");
                app.ui.showToast("Champion intrusion: miniboss incoming");
            }
        }

        this._startFloorBattle();
    }

    _mergeIntoSecured(app) {
        const run = this._run;
        if (!run) return;
        const profile = app.playerProfile;
        if (profile.hunting) {
            profile.hunting.shards = (profile.hunting.shards ?? 0) + (run.securedLoot?.shards ?? 0);
            if (run.securedLoot?.chests?.length > 0) {
                profile.hunting.chests.push(...run.securedLoot.chests);
            }
            profile.hunting.stats = profile.hunting.stats || {};
            profile.hunting.stats.runsStarted = (profile.hunting.stats.runsStarted ?? 0) + 1;
            if (run.status === "retreated") {
                profile.hunting.stats.runsRetreated = (profile.hunting.stats.runsRetreated ?? 0) + 1;
            } else if (run.status === "defeated") {
                profile.hunting.stats.runsDefeated = (profile.hunting.stats.runsDefeated ?? 0) + 1;
            }
            profile.hunting.stats.deepestFloor = Math.max(profile.hunting.stats.deepestFloor ?? 0, run.floor);
        }
        savePlayerProfile(profile);
    }
}
