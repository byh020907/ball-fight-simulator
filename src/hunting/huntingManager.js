import {
    createHuntingRun,
    recordHuntingFloorResult,
    retreatHuntingRun,
    defeatHuntingRun,
    canRetreatFromHuntingRun,
    canEnterHunting,
    getSelectedHuntingStageId,
    getUnlockedHuntingStageIds,
    applyHuntingStatModifiersToSpec,
    setHuntingRunPhase,
    HUNTING_RUN_PHASES
} from "./huntingState.js";
import { rollShardReward, createHuntingChest } from "./huntingRewards.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { HUNTING_ADVANCE_STEPS, HUNTING_ENEMY_TYPES, HUNTING_FLOOR_OUTCOME_TYPES } from "./huntingConfig.js";
import { getHuntingStage, getHuntingStageArena, getNextHuntingStageId } from "./huntingEncounters.js";
import { applyEquipmentStats } from "./equipmentConfig.js";
import { collectActiveEffects, applyMasteryEffectsToFighterSpec } from "../character-mastery/index.js";
import { createHuntingTerrain } from "../terrain/index.js";
import {
    HUNTING_TEAMS,
    createHuntingMinibossSpec,
    createHuntingMobEncounter,
    shouldUseRosterMiniboss,
    getHuntingMobCount
} from "./huntingMonsters.js";
import { applyMerchantOffer, formatOfferResultToast } from "./huntingMerchant.js";
import { formatPendingLootSummary, formatDefeatLossText } from "./huntingFormat.js";
import { createMatchReport, recordLowestHp } from "../collection/index.js";
import {
    applyExperienceProgressionToBaseSpec,
    collectActiveExperienceProgression,
    grantExperienceFromMatchReport
} from "../experience/experienceService.js";
import { applyStatAllocation } from "../statAllocation.js";
import { savePlayerProfile } from "../playerProfile.js";
import { PopupService } from "../popup.js";
import { advanceHuntingRun, completeHuntingStage } from "./huntingRunProgression.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvents.js";

const CHEST_RARITY_LABELS = Object.freeze({
    common: "일반",
    uncommon: "고급",
    rare: "희귀",
    epic: "영웅",
    legendary: "전설"
});

const HUNTING_ROUTE_ACTIONS = Object.freeze({
    CONTINUE: "continue",
    STOP: "stop"
});

const HUNTING_FLOOR_OUTCOME_HANDLERS = Object.freeze({
    [HUNTING_FLOOR_OUTCOME_TYPES.EMPTY]: "_handleEmptyFloor",
    [HUNTING_FLOOR_OUTCOME_TYPES.COMBAT]: "_handleCombatFloor",
    [HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS]: "_handleFinalBossFloor",
    [HUNTING_FLOOR_OUTCOME_TYPES.EVENT]: "_handleEventFloor"
});

const HUNTING_CHEST_CONTINUE_HANDLERS = Object.freeze({
    [HUNTING_RUN_PHASES.AWAITING_CHEST]: "_continueChestRoom",
    [HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST]: "_continueCombatRewardChest"
});

const HUNTING_EVENT_PRESENTATION_HANDLERS = Object.freeze({
    [HUNTING_EVENT_TRANSITIONS.CONTINUE]: "_presentContinueEvent",
    [HUNTING_EVENT_TRANSITIONS.CHOICE]: "_presentChoiceEvent",
    [HUNTING_EVENT_TRANSITIONS.MERCHANT]: "_presentMerchantEvent",
    [HUNTING_EVENT_TRANSITIONS.CHEST]: "_presentChestEvent",
    [HUNTING_EVENT_TRANSITIONS.BATTLE]: "_presentBattleEvent"
});

export class HuntingManager {
    constructor(app) {
        this.app = app;
        this._run = null;
        this._moving = false;
    }

    get isActive() {
        return this._run?.status === "active";
    }

    showStageSelect() {
        const app = this.app;
        // 사냥터 진입 시 기존 캐릭터 프리뷰 중지 및 캔버스 초기화
        app.stopPlayerPreviewLoop();
        app.renderer.clear();

        const characterId = app.playerFighterId;
        if (!canEnterHunting(app.playerProfile, characterId)) {
            PopupService.show({
                title: "사냥터",
                bodyHtml:
                    '<p style="padding:12px 0">사냥터에 입장하려면 먼저 토너먼트에서 우승한 캐릭터가 필요합니다.</p>'
            });
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
        `;

        PopupService.show({
            title: "사냥터 — 맵 선택",
            bodyHtml,
            buttons: []
        });

        setTimeout(() => {
            document.querySelectorAll(".hunting-stage-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const stageId = btn.dataset.stage;
                    app.playerProfile.hunting.selectedStageId = stageId;
                    savePlayerProfile(app.playerProfile);
                    return this.startRun(characterId);
                });
            });
        }, 50);
    }

    async startRun(characterId) {
        PopupService.close();
        if (!canEnterHunting(this.app.playerProfile, characterId)) return;
        const stageId = getSelectedHuntingStageId(this.app.playerProfile);
        this._run = createHuntingRun({ characterId, stageId });
        this.app.playerFighterId = characterId;
        this.app.beginGameSession();
        // UI에서 할당한 스탯을 게임 상태로 동기화 (토너먼트와 동일한 흐름)
        this.app._syncPlayerStatAllocationFromUi();
        this.app.refreshPlayerSetup();
        this.app.setHuntingActive(true);
        const stage = getHuntingStage(stageId);
        this.app.addLog(`[Hunting] ${stage.name} 원정 시작`);
        this._showStartingMove(stage);
        await this.advance({ waitForFirstMoveUi: true });
    }

    _showStartingMove(stage) {
        const app = this.app;
        const floor = this._run?.floor ?? 1;
        app.showOverlay("사냥터", `${stage.name} · ${floor}층`, "원정 시작");
        app.setHuntingOverlayState({
            huntingChoiceVisible: false,
            huntingMerchantActive: false,
            huntingMerchantOffers: null,
            huntingChestEventActive: false,
            huntingChestRarity: "common",
            huntingChestTitle: "",
            huntingChestSubtext: "",
            huntingChestConfirmLabel: "",
            huntingMoving: false,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingFloor: floor
        });
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
            isFinalBoss || run.lastEvent?.enemyType === HUNTING_ENEMY_TYPES.CHAMPION
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
        const playerProgression = collectActiveExperienceProgression(app.playerProfile, run.characterId);

        const masteryCtx = collectActiveEffects(app.playerProfile, run.characterId);
        const baseSpec = applyExperienceProgressionToBaseSpec(playerSpec, playerProgression);
        const allocatedSpec = applyStatAllocation(baseSpec, app.playerStatAllocation, true);
        const equippedSpec = applyEquipmentStats({ ...allocatedSpec, teamId: HUNTING_TEAMS.PLAYER }, app.playerProfile);
        const huntingSpec = applyHuntingStatModifiersToSpec(equippedSpec, run.statModifiers);
        const appliedSpec = applyMasteryEffectsToFighterSpec(huntingSpec, masteryCtx);
        if (playerSpec.ability === "hero" && run.hero?.carryover) {
            appliedSpec.hero = {
                ...(appliedSpec.hero || {}),
                carryover: { ...run.hero.carryover }
            };
        }
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
            terrain,
            experienceProgressionByFighter: new Map([[run.characterId, playerProgression]])
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
                app.addLog(`[사냥터 XP] ${xpResult.xpGained}XP (Lv.${xpResult.level})`);
            }
            app._currentMatchReport = null;
        }

        if (playerWon) {
            const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
            const rewardMultiplier = isFinalBoss
                ? REWARD_BALANCE.hunting.shards.combatMultipliers.finalBoss
                : run.lastEvent?.enemyType === HUNTING_ENEMY_TYPES.CHAMPION
                  ? (run.lastEvent.rewardMultiplier ??
                    REWARD_BALANCE.hunting.shards.combatMultipliers.championIntrusion)
                  : run.floor % 3 === 0
                    ? REWARD_BALANCE.hunting.shards.combatMultipliers.eliteFloor
                    : 1;
            const rewardEnemyType =
                isFinalBoss || run.lastEvent?.enemyType === HUNTING_ENEMY_TYPES.CHAMPION
                    ? HUNTING_ENEMY_TYPES.CHAMPION
                    : run.floor % 3 === 0
                      ? HUNTING_ENEMY_TYPES.ELITE
                      : HUNTING_ENEMY_TYPES.NORMAL;
            const floorLoot = {
                shards: Math.round(
                    rollShardReward({ floor: run.floor, enemyType: rewardEnemyType }) * rewardMultiplier
                ),
                chests:
                    Math.random() < REWARD_BALANCE.hunting.shards.combatChestDropChance
                        ? [createHuntingChest({ rarity: "common" })]
                        : [],
                xp: 0
            };

            // Hero Orb carryover — Hero Ball만 전투 중 획득한 bonuses를 run에 반영
            const playerSpec = app.roster.find((f) => f.id === run.characterId);
            if (playerSpec?.ability === "hero" && playerBall?.hero?.bonuses) {
                playerBall.mergeHeroOrbCarryoverInto(run);
            }

            this._run = recordHuntingFloorResult(run, {
                hpRemain: Math.ceil(playerBall?.hp ?? run.carriedHp ?? 0),
                maxHp: playerBall?.maxHp ?? run.carriedMaxHp,
                loot: floorLoot,
                combatCleared: true
            });

            // 전투 승리로 상자가 드롭되면 상자 UI를 먼저 표시
            if (floorLoot.chests.length > 0) {
                this._presentCombatRewardChest(app, floorLoot.chests[0]);
                savePlayerProfile(app.playerProfile);
                return;
            }

            if (isFinalBoss) {
                this._presentFinalBossClear(app);
                return;
            }

            this._presentNormalCombatWin(app, playerBall?.name ?? run.characterId);
            savePlayerProfile(app.playerProfile);
        } else {
            this._run = defeatHuntingRun(run);
            const name = playerBall?.name ?? run.characterId;
            const securedShards = this._run.securedLoot?.shards ?? 0;
            const lostShards = this._run.defeatLosses?.shards ?? 0;
            const defeatLossText = formatDefeatLossText(this._run.defeatLosses);

            this._mergeIntoSecured(app);
            app._refreshCollectionHub();
            app.beginResultConfirmation();
            app.refreshPlayerSetup();

            const lossDisplay = defeatLossText || `파편 ${lostShards} 손실`;
            app.showOverlay("사냥터 패배", `${name} 쓰러짐`, `획득 ${securedShards} 파편 · ${lossDisplay}`);
            app.setHuntingActive(false);
            app.setHuntingOverlayState({
                huntingChoiceVisible: false,
                huntingLootHudVisible: false,
                huntingLootHudShards: 0,
                huntingLootHudChests: 0
            });
            app.setStartButton({ text: "확인", hidden: false, disabled: false });
            this._run = null;
        }
    }

    retreat() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        if (!canRetreatFromHuntingRun(run)) {
            app.showToast("포탈을 발견해야 귀환할 수 있습니다.");
            return;
        }

        this._run = retreatHuntingRun(run);
        const securedShards = this._run.securedLoot?.shards ?? 0;

        this._mergeIntoSecured(app);
        app._refreshCollectionHub();
        app.beginResultConfirmation();
        app.refreshPlayerSetup();

        app.setHuntingActive(false);
        app.setHuntingOverlayState({
            huntingChoiceVisible: false,
            huntingLootHudVisible: false,
            huntingLootHudShards: 0,
            huntingLootHudChests: 0
        });

        app.showOverlay("사냥터 종료", "귀환 완료", `파편 ${securedShards} 확보 · 최고 층 ${run.floor}`);
        app.setStartButton({ text: "확인", hidden: false, disabled: false });
        this._run = null;
    }

    async advance({ waitForFirstMoveUi = false } = {}) {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active" || this._moving) return;

        this._prepareAdvanceFromPreviousEvent(run);
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.MOVING);
        this._moving = true;
        app.setHuntingOverlayState({ huntingChoiceVisible: false });

        try {
            const route = this._createAdvanceRoute();
            for (let step = 0; step < route.maxSteps; step++) {
                const action = await this._advanceOneFloor({ route, step, waitForFirstMoveUi });
                if (action === HUNTING_ROUTE_ACTIONS.STOP) return;
            }
            this._finishAdvanceRoute(route);
        } catch (error) {
            this._handleAdvanceError(error);
        }
    }

    _prepareAdvanceFromPreviousEvent(run) {
        this._run = HuntingEvent.prepareNextAdvance(run);
    }

    _createAdvanceRoute() {
        const startFloor = this._run.floor;
        const endFloor = Math.min(this._run.maxFloor, startFloor + HUNTING_ADVANCE_STEPS);
        return {
            startFloor,
            endFloor,
            maxSteps: Math.max(1, endFloor - startFloor)
        };
    }

    async _advanceOneFloor({ route, step, waitForFirstMoveUi }) {
        const app = this.app;
        const targetFloor = Math.min(this._run.maxFloor, this._run.floor + 1);
        this._setHuntingMoveState({
            moving: true,
            step: step + 1,
            maxSteps: route.maxSteps,
            routeStartFloor: route.startFloor,
            routeEndFloor: route.endFloor,
            message: `${targetFloor}층으로 이동 중…`
        });

        if (waitForFirstMoveUi && step === 0) {
            await app.waitForHuntingMoveUiPaint();
            if (!this._run || this._run.status !== "active" || !this._moving) {
                this._moving = false;
                return HUNTING_ROUTE_ACTIONS.STOP;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 350));
        if (!this._advanceRunOneFloor()) return HUNTING_ROUTE_ACTIONS.STOP;
        return this._handleCurrentFloor(app);
    }

    _advanceRunOneFloor() {
        this._run = advanceHuntingRun(this._run);
        if (this._run.status === "active") return true;

        this.app.setHuntingOverlayState({ huntingMoving: false });
        this._moving = false;
        this.retreat();
        return false;
    }

    _handleCurrentFloor(app) {
        const encounter = this._run.lastEncounter;
        const handlerName = HUNTING_FLOOR_OUTCOME_HANDLERS[encounter?.type];
        if (!handlerName || typeof this[handlerName] !== "function") {
            throw new Error(`Unsupported hunting floor outcome: ${encounter?.type ?? "missing"}`);
        }
        return this[handlerName]({ app, event: this._run.lastEvent, floor: this._run.floor });
    }

    _handleEmptyFloor({ app, floor }) {
        app.addLog(`[사냥터] ${floor}층 — 빈 통로`);
        app.setHuntingOverlayState({ huntingMoveMessage: `${floor}층 — 빈 통로` });
        return HUNTING_ROUTE_ACTIONS.CONTINUE;
    }

    _handleCombatFloor({ app, floor }) {
        const mobCount = getHuntingMobCount(floor);
        const message = `${floor}층 — 전투 발생 · 적 ${mobCount}명`;
        app.addLog(`[사냥터] ${message}`);
        this._stopHuntingMoveForBattle(app, message);
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _handleFinalBossFloor({ app, floor }) {
        const message = `${floor}층 — 최종 보스!`;
        app.addLog(`[사냥터] ${floor}층 — 최종 보스 등장!`);
        this._stopHuntingMoveForBattle(app, message);
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _handleEventFloor({ app, event }) {
        if (!event) return HUNTING_ROUTE_ACTIONS.CONTINUE;
        const resolution = this._resolveHuntingEvent(event, app);
        this._run = resolution.run;
        return this._presentEventResolution(app, resolution);
    }

    _finishAdvanceRoute(route) {
        this._stopHuntingMoveForChoice(this.app, {
            message: `${route.maxSteps}층 전진 완료 · ${this._run.floor}층`,
            canRetreat: false,
            floor: this._run.floor,
            summary: `현재 ${this._run.floor}층 · 포탈 없이 귀환 불가`
        });
    }

    _handleAdvanceError(error) {
        console.error("[Hunting] advance loop error:", error);
        this.app.setHuntingOverlayState({
            huntingMoving: false,
            huntingMoveMessage: "이동 중 오류 발생 · 로그를 확인 후 다시 시도해주세요"
        });
        this._moving = false;
    }

    _setHuntingMoveState({ moving, step, maxSteps, routeStartFloor, routeEndFloor, message }) {
        const hud = this._getLootHudState();
        this.app.setHuntingOverlayState({
            huntingMoving: moving,
            huntingMoveFrom: routeStartFloor,
            huntingMoveTo: routeEndFloor,
            huntingMoveStep: step,
            huntingMoveMax: maxSteps,
            huntingMoveMessage: message,
            ...hud
        });
    }

    _getLootHudState() {
        const run = this._run;
        if (!run) {
            return { huntingLootHudVisible: false, huntingLootHudShards: 0, huntingLootHudChests: 0 };
        }
        const pending = run.pendingLoot;
        const shards = pending?.shards ?? 0;
        const chests = pending?.chests ?? [];
        const visible = shards > 0 || chests.length > 0;
        return {
            huntingLootHudVisible: visible,
            huntingLootHudShards: shards,
            huntingLootHudChests: chests.length
        };
    }

    _stopHuntingMoveForBattle(app, message) {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.COMBAT);
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
            huntingMoving: false,
            huntingMoveMessage: message,
            ...hud
        });
        this._moving = false;
        this._startFloorBattle();
    }

    _stopHuntingMoveForChoice(app, { message, canRetreat, floor, summary = "" }) {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.AWAITING_CHOICE);
        const pendingText = this._run ? formatPendingLootSummary(this._run.pendingLoot) : "";
        const baseSummary = summary || `현재 ${floor}층 · 10층 전진 가능`;
        const displaySummary = pendingText ? `${baseSummary} · ${pendingText}` : baseSummary;
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
            huntingMoving: false,
            huntingChoiceVisible: true,
            huntingCanRetreat: canRetreat,
            huntingFloor: floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: message,
            huntingLootSummary: displaySummary,
            ...hud
        });
        this._moving = false;
    }

    _stopHuntingMoveForMerchant(app, { message, floor, offers, summary }) {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.AWAITING_MERCHANT);
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
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
            huntingMerchantOffers: offers,
            huntingChestEventActive: false,
            ...hud
        });
        this._moving = false;
    }

    _stopHuntingMoveForChest(app, { chest, floor, confirmLabel = "계속 전진" }) {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.AWAITING_CHEST);
        const pendingText = formatPendingLootSummary(this._run?.pendingLoot);
        const rarityLabel = CHEST_RARITY_LABELS[chest.rarity] ?? chest.rarity;
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
            huntingMoving: false,
            huntingChoiceVisible: false,
            huntingCanRetreat: false,
            huntingFloor: floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: `${floor}층 — ${rarityLabel} 상자 확보`,
            huntingLootSummary: pendingText,
            huntingMerchantActive: false,
            huntingMerchantOffers: null,
            huntingChestEventActive: true,
            huntingChestRarity: chest.rarity,
            huntingChestTitle: `${rarityLabel} 상자 확보`,
            huntingChestSubtext: "미확보 전리품에 보관됩니다",
            huntingChestConfirmLabel: confirmLabel,
            ...hud
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
            app.showToast("파편이 부족합니다.");
            return;
        }

        const refreshedOffers = offers.map((currentOffer, index) =>
            index === offerIndex ? { ...currentOffer, purchased: true } : currentOffer
        );
        this._run = { ...result.run, merchantOffers: refreshedOffers };
        savePlayerProfile(app.playerProfile);

        const toastMsg = formatOfferResultToast(result.result);
        if (toastMsg) app.showToast(`[상인] ${toastMsg}`);

        // Refresh merchant overlay with updated state
        const pendingText = formatPendingLootSummary(this._run.pendingLoot);
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
            huntingMerchantOffers: refreshedOffers,
            huntingLootSummary: pendingText,
            ...hud
        });
    }

    merchantPass() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        app.setHuntingOverlayState({
            huntingMerchantActive: false,
            huntingMerchantOffers: null
        });
        this._run = { ...setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.READY), merchantOffers: null };
        this.advance();
    }

    chestContinue() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        const handlerName = HUNTING_CHEST_CONTINUE_HANDLERS[run.phase];
        if (!handlerName || typeof this[handlerName] !== "function") {
            throw new Error(`Unsupported hunting chest continue phase: ${run.phase}`);
        }
        app.setHuntingOverlayState({
            huntingChestEventActive: false,
            huntingChestRarity: "common",
            huntingChestTitle: "",
            huntingChestSubtext: "",
            huntingChestConfirmLabel: ""
        });
        return this[handlerName]();
    }

    _continueChestRoom() {
        this.advance();
    }

    _continueCombatRewardChest() {
        const app = this.app;
        const run = this._run;
        const playerSpec = app.roster.find((f) => f.id === run.characterId);
        const name = playerSpec?.name ?? run.characterId;
        const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
        if (isFinalBoss) {
            this._presentFinalBossClear(app);
        } else {
            this._presentNormalCombatWin(app, name);
        }
    }

    _resolveHuntingEvent(event, app) {
        return HuntingEvent.resolve(event, {
            run: this._run,
            playerProfile: app.playerProfile,
            roster: app.roster
        });
    }

    _presentEventResolution(app, resolution) {
        const handlerName = HUNTING_EVENT_PRESENTATION_HANDLERS[resolution.transition];
        if (!handlerName || typeof this[handlerName] !== "function") {
            throw new Error(`Unsupported hunting event transition: ${resolution.transition ?? "missing"}`);
        }
        return this[handlerName](app, resolution);
    }

    _presentContinueEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        if (resolution.toastMessage) app.showToast(resolution.toastMessage);
        return HUNTING_ROUTE_ACTIONS.CONTINUE;
    }

    _presentChoiceEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        this._stopHuntingMoveForChoice(app, {
            message: resolution.message,
            canRetreat: resolution.canRetreat,
            floor: this._run.floor,
            summary: resolution.summary
        });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentMerchantEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        this._stopHuntingMoveForMerchant(app, {
            message: resolution.message,
            floor: this._run.floor,
            offers: resolution.offers,
            summary: formatPendingLootSummary(this._run.pendingLoot)
        });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentChestEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        app.showOverlay("사냥터", `${this._run.floor}층 — 상자방`, "전리품을 확인하세요");
        this._stopHuntingMoveForChest(app, { chest: resolution.chest, floor: this._run.floor });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentBattleEvent(app, resolution) {
        this._stopHuntingMoveForBattle(app, resolution.message);
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentCombatRewardChest(app, chest) {
        const run = this._run;
        this._run = setHuntingRunPhase(run, HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST);
        const rarityLabel = CHEST_RARITY_LABELS[chest.rarity] ?? chest.rarity;
        const pendingText = formatPendingLootSummary(run.pendingLoot);
        const hud = this._getLootHudState();
        app.showOverlay("사냥터", `${rarityLabel} 상자 확보`, "전투 보상 상자입니다");
        app.setHuntingOverlayState({
            huntingChoiceVisible: false,
            huntingCanRetreat: false,
            huntingMoving: false,
            huntingFloor: run.floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: `${run.floor}층 — ${rarityLabel} 상자 확보`,
            huntingLootSummary: pendingText,
            huntingMerchantActive: false,
            huntingMerchantOffers: null,
            huntingChestEventActive: true,
            huntingChestRarity: chest.rarity,
            huntingChestTitle: `${rarityLabel} 상자 확보`,
            huntingChestSubtext: "전투 보상 · 미확보 전리품에 보관됩니다",
            huntingChestConfirmLabel: "확인",
            ...hud
        });
    }

    _presentNormalCombatWin(app, name) {
        const run = this._run;
        const pendingText = formatPendingLootSummary(run.pendingLoot);
        const hud = this._getLootHudState();
        this._run = setHuntingRunPhase(run, HUNTING_RUN_PHASES.AWAITING_CHOICE);
        app.refreshPlayerSetup();
        app.showOverlay("사냥터", `${name} 승리!`, `층 ${run.floor} 완료`);
        app.setHuntingOverlayState({
            huntingChoiceVisible: true,
            huntingCanRetreat: false,
            huntingMoving: false,
            huntingFloor: run.floor,
            huntingCharacterName: name,
            huntingLootSummary: pendingText,
            huntingMoveMessage: `${run.floor}층 전투 승리 · 10층 전진 가능`,
            ...hud
        });
        app.setStartButton({ hidden: true, disabled: true, text: "" });
    }

    _presentFinalBossClear(app) {
        const run = this._run;
        const stage = getHuntingStage(run.stageId);
        const nextStageId = getNextHuntingStageId(run.stageId);
        const stageResult = completeHuntingStage(app.playerProfile, run.stageId);
        this._run = retreatHuntingRun(run, { reason: "stage_clear" });
        const securedShards = this._run.securedLoot?.shards ?? 0;
        this._mergeIntoSecured(app);
        app._refreshCollectionHub();
        app.beginResultConfirmation();
        app.refreshPlayerSetup();
        app.setHuntingActive(false);
        app.setHuntingOverlayState({
            huntingChoiceVisible: false,
            huntingCanRetreat: false,
            huntingMoving: false,
            huntingLootHudVisible: false,
            huntingLootHudShards: 0,
            huntingLootHudChests: 0
        });
        app.showOverlay(
            "스테이지 클리어",
            `${stage.name} 보스 격파`,
            stageResult.unlockedStageId
                ? `${getHuntingStage(nextStageId).name} 해금 · 파편 ${securedShards} 확보`
                : `파편 ${securedShards} 확보`
        );
        app.setStartButton({ text: "확인", hidden: false, disabled: false });
        this._run = null;
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
