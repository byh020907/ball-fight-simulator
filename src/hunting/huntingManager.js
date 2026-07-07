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
    getUnlockedHuntingStageIds,
    applyHuntingEventRecovery,
    applyHuntingCursedAltar,
    applyHuntingStatModifiersToSpec
} from "./huntingState.js";
import { rollShardReward, createHuntingChest, createEmptyHuntingLoot } from "./huntingRewards.js";
import {
    HUNTING_ADVANCE_STEPS,
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_FLOOR_OUTCOME_TYPES,
    HUNTING_PORTAL_DECLINE
} from "./huntingConfig.js";
import { getHuntingStage, getHuntingStageArena, getNextHuntingStageId } from "./huntingEncounters.js";
import { applyEquipmentStats } from "./equipmentConfig.js";
import { createHuntingTerrain } from "../terrain/index.js";
import {
    HUNTING_TEAMS,
    createHuntingMinibossSpec,
    createHuntingMobEncounter,
    shouldUseRosterMiniboss,
    getHuntingMobCount
} from "./huntingMonsters.js";
import { createMerchantOffers, applyMerchantOffer, formatOfferResultToast } from "./huntingMerchant.js";
import { formatPendingLootSummary, formatDefeatLossText } from "./huntingFormat.js";
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

        const unlockedIds = getUnlockedHuntingStageIds(app.playerProfile);
        const selectedId = getSelectedHuntingStageId(app.playerProfile);
        const stages = unlockedIds.map((id) => getHuntingStage(id)).filter(Boolean);
        const selectedStage = getHuntingStage(selectedId);

        const stageButtons = stages
            .map(
                (stage) => `
                <button class="hunting-stage-btn${stage.id === selectedId ? " active" : ""}" data-stage="${stage.id}">
                    <strong>${stage.name}</strong>
                    <span>${stage.arena.WIDTH}×${stage.arena.HEIGHT}</span>
                </button>`
            )
            .join("");

        const stageDesc = selectedStage
            ? `<p class="hunting-stage-desc">${selectedStage.description}<br>전장 ${selectedStage.arena.WIDTH}×${selectedStage.arena.HEIGHT}</p>`
            : "";

        const bodyHtml = `
            <div class="hunting-stage-select">
                <span class="hunting-section-label">원정지 선택</span>
                <div class="hunting-stage-grid">${stageButtons}</div>
                ${stageDesc}
            </div>
            <div class="hunting-section-divider"></div>
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
            window.PopupService.show({ title: "사냥터 — 원정 준비", bodyHtml });
            setTimeout(() => {
                document.querySelectorAll(".hunting-stage-btn").forEach((btn) => {
                    btn.addEventListener("click", () => {
                        const stageId = btn.dataset.stage;
                        app.playerProfile.hunting.selectedStageId = stageId;
                        savePlayerProfile(app.playerProfile);
                        // Refresh popup with updated selection
                        this.showCharacterSelect();
                    });
                });
                document.querySelectorAll(".hunting-char-btn").forEach((btn) => {
                    btn.addEventListener("click", () => {
                        const charId = btn.dataset.char;
                        this.startRun(charId);
                    });
                });
            }, 50);
        }
    }

    async startRun(characterId) {
        if (window.PopupService) window.PopupService.close();
        if (!canEnterHunting(this.app.playerProfile, characterId)) return;
        const stageId = getSelectedHuntingStageId(this.app.playerProfile);
        this._run = createHuntingRun({ characterId, stageId });
        this.app.playerFighterId = characterId;
        this.app.ui.setHuntingActive(true);
        this.app.ui.setHuntingOverlayState({ huntingChoiceVisible: false });
        const stage = getHuntingStage(stageId);
        this.app.ui.addLog(`[Hunting] ${stage.name} 원정 시작`);
        await this.advance();
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
        const stageTheme = getHuntingStage(run.stageId).theme;
        const terrain = createHuntingTerrain({
            stageId: run.stageId,
            floor: run.floor,
            width: arena.WIDTH,
            height: arena.HEIGHT
        });
        app.startMatch(matchSpecs, {
            keepLog: false,
            skipActionPick: true,
            arenaWidth: arena.WIDTH,
            arenaHeight: arena.HEIGHT,
            cameraZoom: 1,
            arenaTheme: stageTheme,
            terrain
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
                loot: floorLoot,
                combatCleared: true
            });

            const name = playerBall?.name ?? run.characterId;
            const shardsText = `파편 +${floorLoot.shards}`;
            const pendingText = formatPendingLootSummary(this._run.pendingLoot);
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
                huntingLootSummary: pendingText,
                huntingMoveMessage: `${run.floor}층 전투 승리 · 10층 전진 가능`
            });
            app.ui.setStartButton({ hidden: true, disabled: true, text: "" });
            savePlayerProfile(app.playerProfile);
        } else {
            this._run = defeatHuntingRun(run);
            const name = playerBall?.name ?? run.characterId;
            const securedShards = this._run.securedLoot?.shards ?? 0;
            const lostShards = this._run.defeatLosses?.shards ?? 0;
            const defeatLossText = formatDefeatLossText(this._run.defeatLosses);

            this._mergeIntoSecured(app);
            app._refreshCollectionHub();
            app.refreshPlayerSetup();

            const lossDisplay = defeatLossText || `파편 ${lostShards} 손실`;
            app.ui.showOverlay("사냥터 패배", `${name} 쓰러짐`, `획득 ${securedShards} 파편 · ${lossDisplay}`);
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

    async advance() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active" || this._moving) return;

        // 포탈에서 귀환하지 않고 전진을 선택한 경우, 거부 상태 설정
        if (run.lastEvent?.type === HUNTING_EVENT_TYPES.PORTAL) {
            this._run = {
                ...this._run,
                portalDeclineFloors: HUNTING_PORTAL_DECLINE.INITIAL_FLOORS
            };
        }

        this._moving = true;
        app.ui.setHuntingOverlayState({ huntingChoiceVisible: false });

        try {
            const routeStartFloor = this._run.floor;
            const routeEndFloor = Math.min(this._run.maxFloor, routeStartFloor + HUNTING_ADVANCE_STEPS);
            const routeMaxSteps = Math.max(1, routeEndFloor - routeStartFloor);
            const FLOOR_STEP_MS = 350;

            for (let step = 0; step < routeMaxSteps; step++) {
                const fromFloor = this._run.floor;
                const targetFloor = Math.min(this._run.maxFloor, fromFloor + 1);
                this._setHuntingMoveState({
                    moving: true,
                    step: step + 1,
                    maxSteps: routeMaxSteps,
                    routeStartFloor,
                    routeEndFloor,
                    message: `${targetFloor}층으로 이동 중…`
                });

                await new Promise((resolve) => setTimeout(resolve, FLOOR_STEP_MS));

                this._run = advanceHuntingRun(this._run);
                if (this._run.status !== "active") {
                    app.ui.setHuntingOverlayState({ huntingMoving: false });
                    this._moving = false;
                    this.retreat();
                    return;
                }

                const encounter = this._run.lastEncounter;
                const currentFloor = this._run.floor;
                const event = this._run.lastEvent;

                if (encounter.type === HUNTING_FLOOR_OUTCOME_TYPES.EMPTY) {
                    app.ui.addLog(`[사냥터] ${currentFloor}층 — 빈 통로`);
                    app.ui.setHuntingOverlayState({
                        huntingMoveMessage: `${currentFloor}층 — 빈 통로`
                    });
                    continue;
                }

                if (encounter.type === HUNTING_FLOOR_OUTCOME_TYPES.COMBAT) {
                    const mobCount = getHuntingMobCount(currentFloor);
                    app.ui.addLog(`[사냥터] ${currentFloor}층 — 전투 발생 · 적 ${mobCount}명`);
                    this._stopHuntingMoveForBattle(app, `${currentFloor}층 — 전투 발생 · 적 ${mobCount}명`);
                    return;
                }

                if (encounter.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS) {
                    app.ui.addLog(`[사냥터] ${currentFloor}층 — 최종 보스 등장!`);
                    this._stopHuntingMoveForBattle(app, `${currentFloor}층 — 최종 보스!`);
                    return;
                }

                if (encounter.type === HUNTING_FLOOR_OUTCOME_TYPES.EVENT && event) {
                    this._handleAdvanceEvent(event, app);

                    if (event.type === HUNTING_EVENT_TYPES.PORTAL) {
                        app.ui.addLog(`[사냥터] ${currentFloor}층 — 포탈 발견, 귀환하거나 계속 전진할 수 있습니다.`);
                        this._stopHuntingMoveForChoice(app, {
                            message: `${currentFloor}층 — 포탈 발견!`,
                            canRetreat: true,
                            floor: currentFloor,
                            summary: `포탈 발견 · 현재 ${currentFloor}층 · 귀환 또는 10층 전진`
                        });
                        return;
                    }

                    if (event.type === HUNTING_EVENT_TYPES.WANDERING_MERCHANT) {
                        app.ui.addLog(`[사냥터] ${currentFloor}층 — 떠돌이 상인 발견`);
                        const offers = createMerchantOffers(this._run, event, app.playerProfile);
                        this._run = { ...this._run, merchantOffers: offers };
                        const pendingText = formatPendingLootSummary(this._run.pendingLoot);
                        this._stopHuntingMoveForMerchant(app, {
                            message: `${currentFloor}층 — 떠돌이 상인`,
                            floor: currentFloor,
                            offers,
                            summary: pendingText
                        });
                        return;
                    }

                    if (event.type === HUNTING_EVENT_TYPES.CHAMPION_INTRUSION) {
                        this._stopHuntingMoveForBattle(app, `${currentFloor}층 — 챔피언 난입!`);
                        return;
                    }

                    // boon / mishap / rest_site / chest_room / cursed_altar: auto-continue
                    continue;
                }
            }

            // 모든 이동 단계 소진 — 정지 없이 최대 10층 전진 완료
            this._stopHuntingMoveForChoice(app, {
                message: `${routeMaxSteps}층 전진 완료 — ${this._run.floor}층`,
                canRetreat: false,
                floor: this._run.floor,
                summary: `현재 ${this._run.floor}층 · 포탈 없이는 귀환 불가`
            });
        } catch (error) {
            console.error("[Hunting] advance loop error:", error);
            app.ui.setHuntingOverlayState({
                huntingMoving: false,
                huntingMoveMessage: "이동 중 오류 발생 — 새로고침 후 다시 시도해주세요"
            });
            this._moving = false;
        }
    }

    _setHuntingMoveState({ moving, step, maxSteps, routeStartFloor, routeEndFloor, message }) {
        this.app.ui.setHuntingOverlayState({
            huntingMoving: moving,
            huntingMoveFrom: routeStartFloor,
            huntingMoveTo: routeEndFloor,
            huntingMoveStep: step,
            huntingMoveMax: maxSteps,
            huntingMoveMessage: message
        });
    }

    _stopHuntingMoveForBattle(app, message) {
        app.ui.setHuntingOverlayState({
            huntingMoving: false,
            huntingMoveMessage: message
        });
        this._moving = false;
        this._startFloorBattle();
    }

    _stopHuntingMoveForChoice(app, { message, canRetreat, floor, summary = "" }) {
        const pendingText = this._run ? formatPendingLootSummary(this._run.pendingLoot) : "";
        const baseSummary = summary || `현재 ${floor}층 · 10층 전진 가능`;
        const displaySummary = pendingText ? `${baseSummary} · ${pendingText}` : baseSummary;
        app.ui.setHuntingOverlayState({
            huntingMoving: false,
            huntingChoiceVisible: true,
            huntingCanRetreat: canRetreat,
            huntingFloor: floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: message,
            huntingLootSummary: displaySummary
        });
        this._moving = false;
    }

    _stopHuntingMoveForMerchant(app, { message, floor, offers, summary }) {
        app.ui.setHuntingOverlayState({
            huntingMoving: false,
            huntingChoiceVisible: false,
            huntingCanRetreat: false,
            huntingFloor: floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: message,
            huntingLootSummary: summary || "",
            huntingMerchantActive: true,
            huntingMerchantOffers: offers
        });
        this._moving = false;
    }

    merchantChoose(offerIndex) {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        const offers = run.merchantOffers;
        if (!offers || offerIndex < 0 || offerIndex >= offers.length) return;
        const offer = offers[offerIndex];
        if (offer.purchased || offer.disabled) return;

        const result = applyMerchantOffer(run, app.playerProfile, offer);
        if (!result) {
            app.ui.showToast("파편이 부족합니다.");
            return;
        }

        this._run = result.run;
        offer.purchased = true;
        savePlayerProfile(app.playerProfile);

        const toastMsg = formatOfferResultToast(result.result);
        if (toastMsg) app.ui.showToast(`[상인] ${toastMsg}`);

        // Refresh merchant overlay with updated state
        const pendingText = formatPendingLootSummary(this._run.pendingLoot);
        app.ui.setHuntingOverlayState({
            huntingMerchantOffers: [...offers],
            huntingLootSummary: pendingText
        });
    }

    merchantPass() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        app.ui.setHuntingOverlayState({
            huntingMerchantActive: false,
            huntingMerchantOffers: null
        });
        this._run = { ...this._run, merchantOffers: null };
        this.advance();
    }

    _handleAdvanceEvent(event, app) {
        const run = this._run;
        if (event.type === HUNTING_EVENT_TYPES.BOON) {
            this._run = recordHuntingFloorResult(this._run, {
                hpRemain: run.carriedHp,
                maxHp: run.carriedMaxHp,
                loot: { shards: event.shards ?? 8, chests: [], xp: 0 },
                consumeStatModifiers: false
            });
            app.ui.addLog(`[사냥터] 축복: 파편 +${event.shards ?? 8}`);
            app.ui.showToast(`축복: 파편 +${event.shards ?? 8}`);
            return;
        }

        if (event.type === HUNTING_EVENT_TYPES.MISHAP) {
            const damageRatio = event.damageRatio ?? 0.1;
            const currentHp = this._run.carriedHp ?? this._run.carriedMaxHp ?? 100;
            const damage = Math.max(1, Math.floor(currentHp * damageRatio));
            const newHp = Math.max(1, currentHp - damage);
            this._run = recordHuntingFloorResult(this._run, {
                hpRemain: newHp,
                maxHp: run.carriedMaxHp,
                loot: { shards: 0, chests: [], xp: 0 },
                consumeStatModifiers: false
            });
            app.ui.addLog(`[사냥터] 함정: HP -${damage}`);
            app.ui.showToast(`함정: HP -${damage}`);
            return;
        }

        if (event.type === HUNTING_EVENT_TYPES.REST_SITE) {
            const healAmount = Math.floor(
                (this._run.carriedMaxHp ?? this._run.carriedHp ?? 100) * (event.recoveryRatio ?? 0.25)
            );
            this._run = applyHuntingEventRecovery(this._run, { amount: healAmount });
            const name = app.roster.find((f) => f.id === run.characterId)?.name ?? run.characterId;
            app.ui.addLog(`[사냥터] 휴식: ${name} HP +${healAmount}`);
            app.ui.showToast(`휴식: HP +${healAmount}`);
            return;
        }

        if (event.type === HUNTING_EVENT_TYPES.CHEST_ROOM) {
            const chest = createHuntingChest({ rarity: event.chestRarity ?? "common" });
            this._run = recordHuntingFloorResult(this._run, {
                hpRemain: run.carriedHp,
                maxHp: run.carriedMaxHp,
                loot: { shards: 0, chests: [chest], xp: 0 },
                consumeStatModifiers: false
            });
            app.ui.addLog(`[사냥터] 상자방: ${chest.rarity} 상자 획득`);
            app.ui.showToast(`상자방: ${chest.rarity} 상자`);
            return;
        }

        if (event.type === HUNTING_EVENT_TYPES.CURSED_ALTAR) {
            this._run = applyHuntingCursedAltar(this._run, { trade: event.trade });
            app.ui.addLog(
                `[사냥터] 저주받은 제단: ${event.trade?.gainStat} x${event.trade?.gainMultiplier} / ${event.trade?.loseStat} x${event.trade?.loseMultiplier}`
            );
            app.ui.showToast("저주받은 제단: 스탯 교환");
            return;
        }
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
