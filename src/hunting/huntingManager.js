import {
    createHuntingRun,
    recordHuntingFloorResult,
    retreatHuntingRun,
    defeatHuntingRun,
    canRetreatFromHuntingRun,
    canEnterHunting,
    getHuntingAvailableStartFloors,
    getSelectedHuntingStageId,
    getUnlockedHuntingStageIds,
    applyHuntingStatModifiersToSpec,
    getHuntingRunActiveMember,
    getHuntingRunCharacterId,
    getHuntingRunHealth,
    setHuntingRunActiveHealth,
    setHuntingRunMemberHeroCarryover,
    setHuntingRunPhase,
    HUNTING_RUN_PHASES
} from "./huntingState.js";
import { createEmptyHuntingLoot } from "./huntingRewards.js";
import {
    HUNTING_ADVANCE_STEPS,
    HUNTING_DEBUG_ENCOUNTER_TYPES,
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_FLOOR_OUTCOME_TYPES,
    HUNTING_MAX_FLOOR,
    HUNTING_START_CHECKPOINTS,
    HUNTING_STAGE_IDS,
    HUNTING_STAGES
} from "./huntingConfig.js";
import { getHuntingBattleArena, getHuntingStage, getNextHuntingStageId } from "./huntingEncounters.js";
import { applyEquipmentStats } from "./equipmentConfig.js";
import { collectActiveEffects, applyMasteryEffectsToFighterSpec } from "../character-mastery/index.js";
import { createHuntingTerrain } from "../terrain/index.js";
import {
    HUNTING_TEAMS,
    createHuntingBossMobSpec,
    createHuntingMinibossSpec,
    createHuntingMobEncounter
} from "./huntingMonsters.js";
import { createHuntingFinalBossSpec } from "./huntingFinalBossRegistry.js";
import { createEliteMobEncounter } from "./eliteMobEncounter.js";
import {
    ELITE_MOB_COMBINATIONS,
    getEligibleEliteMobCombinations,
    getEliteMobCombination
} from "./eliteMobCombinations.js";
import { placeEliteMobFormation } from "./eliteMobFormation.js";
import { applyMerchantOffer, formatOfferResultToast } from "./huntingMerchant.js";
import { formatPendingLootSummary, formatDefeatLossText } from "./huntingFormat.js";
import { createMatchReport, recordLowestHp } from "../collection/index.js";
import { HERO_ORB_HP_PER_POINT } from "../entities/heroOrb.js";
import {
    applyExperienceProgressionToBaseSpec,
    collectActiveExperienceProgression,
    combineExperienceGrantResults
} from "../experience/experienceService.js";
import { applyRebirthLoadoutToBaseSpec, getRebirthLoadout } from "../rebirth/index.js";
import { applyStatAllocation } from "../statAllocation.js";
import { savePlayerProfile, unlockHiddenCharacter } from "../playerProfile.js";
import { CHARACTER_ROSTER_CONTEXTS, getEligibleRoster, getEncounterFighterIdentity } from "../characterRosterPolicy.js";
import { PopupService } from "../popup.js";
import { advanceHuntingRun, completeHuntingStage } from "./huntingRunProgression.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvents.js";
import { getHuntingDisplayHealth, getHuntingDisplayHp } from "./huntingHealth.js";
import { getHuntingPreparationConsumables, useHuntingPreparationConsumable } from "../consumables.js";
import {
    applyHuntingRunAchievementProgress,
    recordHuntingBattleStart,
    recordHuntingBattleVictory,
    recordHuntingStageVisit
} from "./huntingAchievementProgress.js";
import { HuntingBattleLootSession, HuntingLootDropController } from "./huntingLoot.js";
import { getHuntingCompletionExperience } from "./huntingExperience.js";
import { getRarityLabel } from "./rarityPresentation.js";

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

const HUNTING_EVENT_CONTINUE_HANDLERS = Object.freeze({
    [HUNTING_EVENT_TYPES.BOON]: "_continueEventAdvance",
    [HUNTING_EVENT_TYPES.MISHAP]: "_continueEventAdvance",
    [HUNTING_EVENT_TYPES.REST_SITE]: "_continueEventAdvance",
    [HUNTING_EVENT_TYPES.CURSED_ALTAR]: "_continueEventAdvance"
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
        this._battleLootSession = null;
        this._battleExperienceGrants = [];
        this._lastBattleExperienceResult = null;
        this._combatRewardChestQueue = [];
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

        PopupService.show({
            title: "사냥터 — 맵 선택",
            content: {
                type: "hunting-stage-select",
                stages: stages.map((stage) => ({
                    id: stage.id,
                    name: stage.name,
                    arenaWidth: stage.arena.WIDTH,
                    arenaHeight: stage.arena.HEIGHT,
                    active: stage.id === selectedId
                })),
                selectedStage: selectedStage
                    ? {
                          description: selectedStage.description,
                          arenaWidth: selectedStage.arena.WIDTH,
                          arenaHeight: selectedStage.arena.HEIGHT
                      }
                    : null
            },
            buttons: []
        });
    }

    selectStage(stageId) {
        const unlockedIds = getUnlockedHuntingStageIds(this.app.playerProfile);
        if (!unlockedIds.includes(stageId)) return;
        this.app.playerProfile.hunting.selectedStageId = stageId;
        savePlayerProfile(this.app.playerProfile);
        return this.showCheckpointSelect(this.app.playerFighterId, stageId);
    }

    showCheckpointSelect(characterId, stageId = getSelectedHuntingStageId(this.app.playerProfile)) {
        const stage = getHuntingStage(stageId);
        const availableCheckpoints = getHuntingAvailableStartFloors(this.app.playerProfile.hunting.stats, stageId);
        PopupService.show({
            title: `사냥터 — ${stage.name} 시작 층`,
            content: {
                type: "hunting-checkpoint-select",
                checkpoints: HUNTING_START_CHECKPOINTS.map((checkpoint) => ({
                    floor: checkpoint,
                    available: availableCheckpoints.includes(checkpoint)
                }))
            },
            buttons: []
        });
    }

    async startRun(characterId, { encounterFloor = 1 } = {}) {
        PopupService.close();
        if (!canEnterHunting(this.app.playerProfile, characterId)) return;
        const stageId = getSelectedHuntingStageId(this.app.playerProfile);
        const availableCheckpoints = getHuntingAvailableStartFloors(this.app.playerProfile.hunting.stats, stageId);
        const selectedCheckpoint = availableCheckpoints.includes(encounterFloor) ? encounterFloor : 1;
        return this._startRun(characterId, {
            stageId,
            encounterFloor: selectedCheckpoint,
            displayFloor: selectedCheckpoint,
            debug: false
        });
    }

    async startDebugRun(characterId, { stageId = HUNTING_STAGE_IDS.CAVE, encounterFloor = 1 } = {}) {
        PopupService.close();
        const validStageId = HUNTING_STAGES.some((stage) => stage.id === stageId) ? stageId : HUNTING_STAGE_IDS.CAVE;
        const validFloor = Math.max(1, Math.min(HUNTING_MAX_FLOOR, Math.floor(encounterFloor) || 1));
        return this._startRun(characterId, {
            stageId: validStageId,
            encounterFloor: validFloor,
            displayFloor: validFloor,
            debug: true
        });
    }

    async startDebugEventPreview(
        characterId,
        {
            stageId = HUNTING_STAGE_IDS.CAVE,
            encounterFloor = 1,
            eventType = HUNTING_EVENT_TYPES.PORTAL,
            eliteCombinationId = null
        } = {}
    ) {
        PopupService.close();
        const validStageId = HUNTING_STAGES.some((stage) => stage.id === stageId) ? stageId : HUNTING_STAGE_IDS.CAVE;
        const validFloor = Math.max(1, Math.min(HUNTING_MAX_FLOOR, Math.floor(encounterFloor) || 1));
        const validEventType = Object.values(HUNTING_EVENT_TYPES).includes(eventType)
            ? eventType
            : HUNTING_EVENT_TYPES.PORTAL;
        const eliteCombination =
            validEventType === HUNTING_EVENT_TYPES.ELITE_MOB
                ? (getEliteMobCombination(eliteCombinationId) ?? ELITE_MOB_COMBINATIONS[0])
                : null;
        const previewFloor = eliteCombination ? Math.max(validFloor, eliteCombination.minimumFloor) : validFloor;
        return this._startRun(characterId, {
            stageId: validStageId,
            encounterFloor: previewFloor,
            displayFloor: previewFloor,
            debug: true,
            debugEventType: validEventType,
            debugEliteCombinationId: eliteCombination?.id ?? null
        });
    }

    async startDebugCombatPreview(
        characterId,
        {
            stageId = HUNTING_STAGE_IDS.CAVE,
            encounterFloor = 1,
            encounterType = HUNTING_DEBUG_ENCOUNTER_TYPES.NORMAL,
            eliteCombinationId = null
        } = {}
    ) {
        PopupService.close();
        const validStageId = HUNTING_STAGES.some((stage) => stage.id === stageId) ? stageId : HUNTING_STAGE_IDS.CAVE;
        const validFloor = Math.max(1, Math.min(HUNTING_MAX_FLOOR, Math.floor(encounterFloor) || 1));
        const validEncounterType = Object.values(HUNTING_DEBUG_ENCOUNTER_TYPES).includes(encounterType)
            ? encounterType
            : HUNTING_DEBUG_ENCOUNTER_TYPES.NORMAL;
        const eliteCombination =
            validEncounterType === HUNTING_DEBUG_ENCOUNTER_TYPES.ELITE
                ? (getEliteMobCombination(eliteCombinationId) ?? ELITE_MOB_COMBINATIONS[0])
                : null;
        const previewFloor =
            validEncounterType === HUNTING_DEBUG_ENCOUNTER_TYPES.FINAL_BOSS
                ? HUNTING_MAX_FLOOR
                : eliteCombination
                  ? Math.max(validFloor, eliteCombination.minimumFloor)
                  : validFloor;
        return this._startRun(characterId, {
            stageId: validStageId,
            encounterFloor: previewFloor,
            displayFloor: previewFloor,
            debug: true,
            debugEncounterType: validEncounterType,
            debugEliteCombinationId: eliteCombination?.id ?? null
        });
    }

    async _startRun(
        characterId,
        {
            stageId,
            encounterFloor,
            displayFloor,
            debug,
            debugEventType = null,
            debugEncounterType = null,
            debugEliteCombinationId = null
        }
    ) {
        this.app.playerProfile.hunting.stats = recordHuntingStageVisit(this.app.playerProfile.hunting.stats, stageId);
        savePlayerProfile(this.app.playerProfile);
        this.app._refreshCollectionHub();
        this._run = {
            ...createHuntingRun({ characterId, stageId }),
            floor: Math.max(0, encounterFloor - 1)
        };
        this.app.playerFighterId = characterId;
        this.app.beginGameSession();
        // UI에서 할당한 스탯을 게임 상태로 동기화 (토너먼트와 동일한 흐름)
        this.app._syncPlayerStatAllocationFromUi();
        this.app.refreshPlayerSetup();
        this.app.setHuntingActive(true);
        const stage = getHuntingStage(stageId);
        this.app.addLog(`[Hunting] ${stage.name} ${encounterFloor}층${debug ? " 디버그" : ""} 원정 시작`);
        this._showStartingMove(stage, displayFloor);
        if (debugEventType) {
            return this._showDebugEventPreview(debugEventType, encounterFloor, debugEliteCombinationId);
        }
        if (debugEncounterType) {
            return this._showDebugCombatPreview(debugEncounterType, encounterFloor, debugEliteCombinationId);
        }
        await this.advance({ waitForFirstMoveUi: true });
    }

    _createDebugEventPayload(eventType, floor, eliteCombinationId) {
        if (eventType !== HUNTING_EVENT_TYPES.ELITE_MOB || !eliteCombinationId) {
            return HuntingEvent.createPayload(eventType, floor);
        }
        const candidates = getEligibleEliteMobCombinations(floor);
        const selectedIndex = candidates.findIndex((combination) => combination.id === eliteCombinationId);
        if (selectedIndex < 0) throw new Error(`Elite mob combination is unavailable: ${eliteCombinationId}`);
        const selectedRoll = (selectedIndex + 0.5) / candidates.length;
        return HuntingEvent.createPayload(eventType, floor, () => selectedRoll);
    }

    _showDebugEventPreview(eventType, floor, eliteCombinationId = null) {
        const event = this._createDebugEventPayload(eventType, floor, eliteCombinationId);
        this._run = {
            ...this._run,
            floor,
            lastEvent: event,
            lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.EVENT, event },
            history: [...this._run.history, { type: "debug_event_preview", floor, event }]
        };
        this.app.addLog(`[Hunting] ${floor}층 — ${event.type} 디버그 이벤트 미리보기`);
        return this._handleEventFloor({ app: this.app, event });
    }

    _showDebugCombatPreview(encounterType, floor, eliteCombinationId = null) {
        if (encounterType === HUNTING_DEBUG_ENCOUNTER_TYPES.CHAMPION) {
            return this._showDebugEventPreview(HUNTING_EVENT_TYPES.CHAMPION_INTRUSION, floor);
        }
        if (encounterType === HUNTING_DEBUG_ENCOUNTER_TYPES.ELITE) {
            return this._showDebugEventPreview(HUNTING_EVENT_TYPES.ELITE_MOB, floor, eliteCombinationId);
        }

        const isFinalBoss = encounterType === HUNTING_DEBUG_ENCOUNTER_TYPES.FINAL_BOSS;
        const encounter = {
            type: isFinalBoss ? HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS : HUNTING_FLOOR_OUTCOME_TYPES.COMBAT,
            floor,
            enemyType: isFinalBoss ? HUNTING_ENEMY_TYPES.CHAMPION : HUNTING_ENEMY_TYPES.NORMAL,
            isMiniboss: encounterType === HUNTING_DEBUG_ENCOUNTER_TYPES.MINIBOSS
        };
        this._run = {
            ...this._run,
            floor,
            lastEvent: null,
            lastEncounter: encounter,
            history: [...this._run.history, { type: "debug_combat_preview", floor, encounter }]
        };
        this.app.addLog(`[Hunting] ${floor}층 — ${encounterType} 디버그 전투 조우`);
        return isFinalBoss
            ? this._handleFinalBossFloor({ app: this.app, floor })
            : this._handleCombatFloor({ app: this.app, floor });
    }

    _showStartingMove(stage, floor = this._run?.floor ?? 1) {
        const app = this.app;
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
            huntingBattlePreparationActive: false,
            huntingBattlePreparationItems: [],
            huntingBattlePreparationHp: 0,
            huntingBattlePreparationMaxHp: 0,
            huntingBattlePreparationNotice: "",
            huntingMoving: false,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingFloor: floor
        });
    }

    _createPlayerHuntingSpec(run) {
        const app = this.app;
        const characterId = getHuntingRunCharacterId(run);
        const playerSpec = app.roster.find((fighter) => fighter.id === characterId);
        if (!playerSpec) return null;

        const playerProgression = collectActiveExperienceProgression(app.playerProfile, characterId);
        const rebirthLoadout = getRebirthLoadout(app.playerProfile, characterId);
        const masteryCtx = collectActiveEffects(app.playerProfile, characterId);
        const baseSpec = applyExperienceProgressionToBaseSpec(playerSpec, playerProgression);
        const rebornSpec = applyRebirthLoadoutToBaseSpec(baseSpec, rebirthLoadout);
        const allocatedSpec = applyStatAllocation(rebornSpec, app.playerStatAllocation ?? {}, true);
        const equippedSpec = applyEquipmentStats({ ...allocatedSpec, teamId: HUNTING_TEAMS.PLAYER }, app.playerProfile);
        const huntingSpec = applyHuntingStatModifiersToSpec(equippedSpec, run.statModifiers);
        const appliedSpec = applyMasteryEffectsToFighterSpec(huntingSpec, masteryCtx);
        const member = getHuntingRunActiveMember(run);
        if (playerSpec.ability === "hero" && member?.hero?.carryover) {
            appliedSpec.hero = {
                ...(appliedSpec.hero || {}),
                carryover: { ...member.hero.carryover }
            };
        }

        return { playerSpec, playerProgression, rebirthLoadout, appliedSpec };
    }

    _getHuntingMaxHp(spec) {
        const baseHp = spec?.stats?.hp;
        if (!Number.isFinite(baseHp) || baseHp <= 0) return null;
        const heroHp = spec.ability === "hero" ? Math.max(0, spec.hero?.carryover?.hp ?? 0) : 0;
        return baseHp + heroHp * HERO_ORB_HP_PER_POINT;
    }

    _syncRunHealth(run, spec) {
        const maxHp = this._getHuntingMaxHp(spec);
        if (maxHp === null) return run;
        const health = getHuntingRunHealth(run);
        const carriedHp = Number.isFinite(health.hp) ? health.hp : maxHp;
        return setHuntingRunActiveHealth(run, { hp: Math.min(maxHp, Math.max(1, carriedHp)), maxHp });
    }

    _startFloorBattle() {
        const app = this.app;
        let run = this._run;
        if (!run || run.status !== "active") return;

        const player = this._createPlayerHuntingSpec(run);
        if (!player) return;
        this._run = this._syncRunHealth(run, player.appliedSpec);
        run = this._run;
        const { playerProgression, rebirthLoadout, appliedSpec } = player;

        const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
        const isChampion = !isFinalBoss && run.lastEvent?.enemyType === HUNTING_ENEMY_TYPES.CHAMPION;
        const isEliteMobEvent = !isFinalBoss && run.lastEvent?.type === HUNTING_EVENT_TYPES.ELITE_MOB;
        const mobSpecs = isEliteMobEvent
            ? createEliteMobEncounter({
                  floor: run.floor,
                  stageId: run.stageId,
                  combinationId: run.lastEvent.eliteCombinationId,
                  monsterTypes: run.lastEvent.monsterTypes
              })
            : createHuntingMobEncounter({ floor: run.floor, stageId: run.stageId });
        const dedicatedFinalBoss = isFinalBoss
            ? createHuntingFinalBossSpec({ stageId: run.stageId, floor: run.floor })
            : null;
        const rosterMiniboss =
            (isFinalBoss && !dedicatedFinalBoss) || isChampion
                ? createHuntingMinibossSpec({
                      roster: getEligibleRoster(
                          app.playerProfile,
                          app.roster,
                          isChampion
                              ? CHARACTER_ROSTER_CONTEXTS.HUNTING_CHAMPION
                              : CHARACTER_ROSTER_CONTEXTS.HUNTING_FINAL_BOSS
                      ).map((fighter) =>
                          isChampion ? getEncounterFighterIdentity(app.playerProfile, fighter) : fighter
                      ),
                      characterId: getHuntingRunCharacterId(run),
                      floor: run.floor,
                      enemyType: HUNTING_ENEMY_TYPES.CHAMPION,
                      rng: app.simulationRng ?? Math.random
                  })
                : null;
        const monsterMiniboss = run.lastEncounter?.isMiniboss
            ? createHuntingBossMobSpec({ floor: run.floor, stageId: run.stageId })
            : null;
        const miniboss = dedicatedFinalBoss ?? rosterMiniboss ?? monsterMiniboss;
        const enemySpecs = dedicatedFinalBoss
            ? [dedicatedFinalBoss]
            : miniboss
              ? [miniboss, ...mobSpecs.slice(0, Math.max(1, mobSpecs.length - 1))]
              : mobSpecs;
        this._run = {
            ...recordHuntingBattleStart(run, {
                enemySpecs,
                hpRemain: getHuntingRunHealth(run).hp,
                maxHp: getHuntingRunHealth(run).maxHp,
                isChampion
            }),
            currentChampionCharacterId: isChampion ? (miniboss?.hunting?.sourceFighterId ?? null) : null,
            currentChampionHiddenIdentity: Boolean(isChampion && miniboss?.hunting?.hiddenIdentity)
        };
        run = this._run;
        const characterId = getHuntingRunCharacterId(run);
        const matchSpecs = [appliedSpec, ...enemySpecs];
        const battleLootSession = new HuntingBattleLootSession({ playerId: characterId, floor: run.floor });
        const lootDropController = new HuntingLootDropController({
            session: battleLootSession,
            onExperienceCollected: (reward) => this._awardHuntingExperience(reward)
        });
        this._battleLootSession = battleLootSession;
        this._battleExperienceGrants = [];
        this._lastBattleExperienceResult = null;
        this._combatRewardChestQueue = [];
        app._currentMatchReport = createMatchReport();
        app._currentMatchReport.playerFighterId = characterId;

        app._onSimulationResult = (a) => this._handleFinish(a);

        app.playerFighterId = characterId;

        const arena = getHuntingBattleArena(run.stageId, enemySpecs.length);
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
            hostileAbsenceGraceDuration: 1,
            hostileAbsenceGraceTeamId: HUNTING_TEAMS.PLAYER,
            arenaTheme: stageTheme,
            terrain,
            experienceProgressionByFighter: new Map([[characterId, playerProgression]]),
            rebirthLoadoutByFighter: new Map([[characterId, rebirthLoadout]]),
            playerLives: isFinalBoss ? { playerId: characterId, total: 3 } : null,
            onFighterDefeated: (fighter, context) => lootDropController.onFighterDefeated(fighter, context),
            onResultResolved: (winner, context) =>
                this._handleHuntingResultResolved(lootDropController, winner, context)
        });

        const playerBall = app.simulation?.fighters?.find((fighter) => fighter.id === characterId);
        const enemies = playerBall ? app.simulation.getEnemiesOf(playerBall) : [];
        if (isEliteMobEvent && playerBall) placeEliteMobFormation(playerBall, enemies);
        lootDropController.prepareExperienceDrops(enemies);

        const health = getHuntingRunHealth(run);
        if (Number.isFinite(health.hp)) {
            const ball = app.simulation?.fighters?.find((f) => f.id === characterId);
            if (ball) {
                ball.hp = Math.min(ball.maxHp, Math.max(1, health.hp));
            }
        }
    }

    _handleFinish(app) {
        app._cleanupMatch();
        app.matchFinalized = true;
        app._onSimulationResult = null;

        let run = this._run;
        if (!run) return;

        const battleResult = this._getHuntingBattleResult(app.simulation);
        const { playerBall, playerWon } = battleResult;
        this._updateHuntingMatchReport(app, battleResult);
        app._currentMatchReport = null;
        const xpResult = combineExperienceGrantResults(this._battleExperienceGrants);
        this._battleExperienceGrants = [];
        this._lastBattleExperienceResult = xpResult;
        if (xpResult) {
            app._lastMatchXpResult = xpResult;
            app.addLog(`[사냥터 XP] ${app._formatXpResult(xpResult)}`);
        }

        if (playerWon) {
            const unlockedCharacterId = run.currentChampionHiddenIdentity ? run.currentChampionCharacterId : null;
            const characterUnlocked = unlockedCharacterId
                ? unlockHiddenCharacter(app.playerProfile, unlockedCharacterId)
                : false;
            this._lastBattleCharacterUnlock = characterUnlocked
                ? {
                      characterId: unlockedCharacterId,
                      previousName: "???",
                      name:
                          app.roster.find((fighter) => fighter.id === unlockedCharacterId)?.name ?? unlockedCharacterId
                  }
                : null;
            if (characterUnlocked) {
                savePlayerProfile(app.playerProfile);
                app._refreshCollectionHub();
            }
            const collectedBattleLoot = this._battleLootSession?.getCollectedLoot() ?? createEmptyHuntingLoot();
            this._battleLootSession = null;
            const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
            const floorLoot = collectedBattleLoot;

            // Hero Orb carryover — Hero Ball만 전투 중 획득한 bonuses를 run에 반영
            const characterId = getHuntingRunCharacterId(run);
            const playerSpec = app.roster.find((f) => f.id === characterId);
            if (playerSpec?.ability === "hero" && playerBall?.hero?.bonuses) {
                const member = getHuntingRunActiveMember(run);
                const carryoverTarget = { hero: { carryover: { ...member.hero.carryover } } };
                playerBall.mergeHeroOrbCarryoverInto(carryoverTarget);
                run = setHuntingRunMemberHeroCarryover(run, run.party.activeRole, carryoverTarget.hero.carryover);
            }

            const runHealth = getHuntingRunHealth(run);
            this._run = recordHuntingFloorResult(recordHuntingBattleVictory(run), {
                hpRemain: playerBall?.hp ?? runHealth.hp ?? 0,
                maxHp: playerBall?.maxHp ?? runHealth.maxHp,
                loot: floorLoot,
                combatCleared: true
            });

            // 전투 승리로 상자가 드롭되면 상자 UI를 먼저 표시
            if (floorLoot.chests.length > 0) {
                this._combatRewardChestQueue = [...floorLoot.chests];
                if (this._lastBattleCharacterUnlock) {
                    this._pendingUnlockResultChest = true;
                    this._presentNormalCombatWin(app, playerBall?.name ?? characterId, xpResult);
                    savePlayerProfile(app.playerProfile);
                    return;
                }
                this._presentCombatRewardChest(app, this._combatRewardChestQueue[0]);
                savePlayerProfile(app.playerProfile);
                return;
            }

            if (isFinalBoss) {
                this._presentFinalBossClear(app, xpResult);
                return;
            }

            this._presentNormalCombatWin(app, playerBall?.name ?? characterId, xpResult);
            savePlayerProfile(app.playerProfile);
        } else {
            this._battleLootSession = null;
            this._combatRewardChestQueue = [];
            this._run = defeatHuntingRun(run);
            const name = playerBall?.name ?? getHuntingRunCharacterId(run);
            const securedShards = this._run.securedLoot?.shards ?? 0;
            const lostShards = this._run.defeatLosses?.shards ?? 0;
            const defeatLossText = formatDefeatLossText(this._run.defeatLosses);

            this._mergeIntoSecured(app);
            app._refreshCollectionHub();
            app.beginResultConfirmation();
            app.refreshPlayerSetup();

            const lossDisplay = defeatLossText || `파편 ${lostShards} 손실`;
            app.presentResultSequence([
                this._createHuntingExperienceResultStep(app, xpResult),
                {
                    id: "summary",
                    label: "사냥터 패배",
                    text: `${name} · ${run.floor}층에서 쓰러짐`,
                    subtext: `획득 ${securedShards} 파편 · ${lossDisplay}`
                }
            ]);
            app.setHuntingActive(false);
            app.setHuntingOverlayState({
                huntingChoiceVisible: false,
                huntingLootHudVisible: false,
                huntingLootHudShards: 0,
                huntingLootHudEnhancementStones: 0,
                huntingLootHudChests: 0
            });
            this._run = null;
        }
    }

    _getHuntingBattleResult(simulation) {
        const run = this._run;
        const characterId = getHuntingRunCharacterId(run);
        const playerBall = simulation?.fighters?.find((fighter) => fighter.id === characterId) ?? null;
        const winner = simulation?.winner ?? null;
        const playerWon = Boolean(
            playerBall &&
            winner &&
            (winner === playerBall ||
                (typeof simulation.isHostile === "function" && !simulation.isHostile(winner, playerBall)))
        );
        const enemies = playerBall ? simulation.getEnemiesOf(playerBall) : [];
        return { playerBall, playerWon, enemies };
    }

    _updateHuntingMatchReport(app, { playerBall, playerWon, enemies }) {
        const report = app._currentMatchReport;
        if (!report) return null;

        report.playerWon = playerWon;
        if (playerBall) {
            recordLowestHp(report, playerBall.hp, playerBall.maxHp);
            report.hpRemain = playerBall.hp;
            report.myMaxHp = playerBall.maxHp;
        }
        report.opponentMaxHp = enemies.reduce((total, fighter) => total + fighter.maxHp, 0);
        return report;
    }

    _handleHuntingResultResolved(lootDropController, winner, { simulation } = {}) {
        const battleResult = this._getHuntingBattleResult(simulation);
        if (!battleResult.playerWon) return;

        const report = this._updateHuntingMatchReport(this.app, battleResult);
        const completionExperience = getHuntingCompletionExperience(report, battleResult.enemies);
        lootDropController.onResultResolved(winner, { simulation, completionExperience });
    }

    _awardHuntingExperience(reward) {
        const characterId = getHuntingRunCharacterId(this._run);
        const amount = Math.max(0, Math.floor(reward?.amount ?? 0));
        if (!characterId || amount <= 0) return null;

        const result = this.app.awardExperience(characterId, amount, {
            persist: false,
            refresh: false,
            log: false,
            notifyLevelUp: true
        });
        if (result?.xpGained > 0) this._battleExperienceGrants.push(result);
        return result;
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
            huntingLootHudEnhancementStones: 0,
            huntingLootHudChests: 0
        });

        app.presentResultSequence([
            {
                id: "summary",
                label: "사냥터 종료",
                text: "귀환 완료",
                subtext: `파편 ${securedShards} 확보 · 최고 층 ${run.floor}`
            }
        ]);
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
        const player = this._createPlayerHuntingSpec(this._run);
        if (player) {
            this._run = this._syncRunHealth(this._run, player.appliedSpec);
        }
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
        this._currentFloorRecoveryFeedback = this._showFloorRecoveryFeedback(app);
        try {
            return this[handlerName]({ app, event: this._run.lastEvent, floor: this._run.floor });
        } finally {
            this._currentFloorRecoveryFeedback = null;
        }
    }

    _showFloorRecoveryFeedback(app) {
        const recovery = this._run.history.at(-2);
        if (recovery?.type !== "floor_recovery" || recovery.floor !== this._run.floor) return "";

        const activeRecovery = recovery.recoveries?.find((entry) => entry.role === this._run.party.activeRole);
        if (!activeRecovery) return "";
        const healed = getHuntingDisplayHp(activeRecovery.amount);
        const health = getHuntingDisplayHealth(this._run);
        const feedback = `HP +${healed} 회복 (${health.hp}/${health.maxHp})`;
        app.addLog(`[사냥터] ${this._run.floor}층 이동 · ${feedback}`);
        return feedback;
    }

    _withFloorRecoveryFeedback(message) {
        return this._currentFloorRecoveryFeedback ? `${message} · ${this._currentFloorRecoveryFeedback}` : message;
    }

    _handleEmptyFloor({ app, floor }) {
        const message = this._withFloorRecoveryFeedback(`${floor}층 — 빈 통로`);
        app.addLog(`[사냥터] ${message}`);
        app.setHuntingOverlayState({ huntingMoveMessage: message });
        return HUNTING_ROUTE_ACTIONS.CONTINUE;
    }

    _handleCombatFloor({ app, floor }) {
        const message = this._withFloorRecoveryFeedback(`${floor}층 — 전투 발생`);
        app.addLog(`[사냥터] ${message}`);
        this._stopHuntingMoveForBattle(app, message);
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _handleFinalBossFloor({ app, floor }) {
        const bossName = createHuntingFinalBossSpec({ stageId: this._run?.stageId, floor })?.name;
        const message = this._withFloorRecoveryFeedback(bossName ?? `${floor}층 — 최종 보스!`);
        app.addLog(`[사냥터] ${floor}층 · 최종보스${bossName ? ` · ${bossName}` : ""}`);
        this._stopHuntingMoveForBattle(app, message, {
            label: bossName ? `${floor}층 · 최종보스` : "전투 준비",
            subtext: "물약을 준비하거나 전투를 시작하세요."
        });
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
            return {
                huntingLootHudVisible: false,
                huntingLootHudShards: 0,
                huntingLootHudEnhancementStones: 0,
                huntingLootHudChests: 0
            };
        }
        const pending = run.pendingLoot;
        const shards = pending?.shards ?? 0;
        const enhancementStones = pending?.enhancementStones ?? 0;
        const chests = pending?.chests ?? [];
        const visible = shards > 0 || enhancementStones > 0 || chests.length > 0;
        return {
            huntingLootHudVisible: visible,
            huntingLootHudShards: shards,
            huntingLootHudEnhancementStones: enhancementStones,
            huntingLootHudChests: chests.length
        };
    }

    _stopHuntingMoveForBattle(
        app,
        message,
        { label = "전투 준비", subtext = "물약을 준비하거나 전투를 시작하세요." } = {}
    ) {
        const player = this._createPlayerHuntingSpec(this._run);
        if (player) {
            this._run = this._syncRunHealth(this._run, player.appliedSpec);
        }
        this._run = {
            ...setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.AWAITING_BATTLE_PREPARATION),
            battleConsumableUses: {}
        };
        const hud = this._getLootHudState();
        const preparation = this._getBattlePreparationState();
        app.showOverlay(label, message, subtext);
        app.setHuntingOverlayState({
            huntingMoving: false,
            huntingEventActive: false,
            huntingChoiceVisible: false,
            huntingMerchantActive: false,
            huntingChestEventActive: false,
            huntingMoveMessage: message,
            ...preparation,
            ...hud
        });
        this._moving = false;
    }

    _getBattlePreparationState(notice = "") {
        const run = this._run;
        const health = getHuntingDisplayHealth(run);
        return {
            huntingBattlePreparationActive: true,
            huntingBattlePreparationItems: getHuntingPreparationConsumables(this.app.playerProfile, run),
            huntingBattlePreparationHp: health.hp,
            huntingBattlePreparationMaxHp: health.maxHp,
            huntingBattlePreparationNotice: notice
        };
    }

    usePreparationConsumable(consumableId) {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active" || run.phase !== HUNTING_RUN_PHASES.AWAITING_BATTLE_PREPARATION)
            return null;

        const applied = useHuntingPreparationConsumable(app.playerProfile, run, consumableId);
        if (!applied) return null;

        this._run = applied.run;
        savePlayerProfile(app.playerProfile);
        const health = getHuntingDisplayHealth(this._run);
        app.setHuntingOverlayState(
            this._getBattlePreparationState(
                `${applied.result.label} +${getHuntingDisplayHp(applied.result.healed)} HP · ${health.hp}/${health.maxHp}`
            )
        );
        return applied.result;
    }

    startPreparedBattle() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active" || run.phase !== HUNTING_RUN_PHASES.AWAITING_BATTLE_PREPARATION) return;

        this._run = setHuntingRunPhase(run, HUNTING_RUN_PHASES.COMBAT);
        app.setHuntingOverlayState({
            huntingBattlePreparationActive: false,
            huntingBattlePreparationItems: [],
            huntingBattlePreparationHp: 0,
            huntingBattlePreparationMaxHp: 0,
            huntingBattlePreparationNotice: ""
        });
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
            huntingEventActive: false,
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
            huntingEventActive: false,
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
            huntingMerchantResult: "",
            huntingChestEventActive: false,
            ...hud
        });
        this._moving = false;
    }

    _stopHuntingMoveForChest(app, { chest, floor, confirmLabel = "계속 전진", message = "" }) {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.AWAITING_CHEST);
        const pendingText = formatPendingLootSummary(this._run?.pendingLoot);
        const rarityLabel = getRarityLabel(chest.rarity);
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
            huntingMoving: false,
            huntingEventActive: false,
            huntingChoiceVisible: false,
            huntingCanRetreat: false,
            huntingFloor: floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: message || `${floor}층 — ${rarityLabel} 상자 확보`,
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

    _stopHuntingMoveForEvent(app, presentation, confirmLabel = "계속 전진") {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.AWAITING_EVENT);
        const hud = this._getLootHudState();
        app.showOverlay("사냥터 이벤트", presentation.title, presentation.subtext);
        app.setHuntingOverlayState({
            huntingMoving: false,
            huntingChoiceVisible: false,
            huntingCanRetreat: false,
            huntingFloor: this._run.floor,
            huntingMoveFrom: 0,
            huntingMoveTo: 0,
            huntingMoveStep: 0,
            huntingMoveMax: HUNTING_ADVANCE_STEPS,
            huntingMoveMessage: presentation.title,
            huntingMerchantActive: false,
            huntingMerchantOffers: null,
            huntingMerchantResult: "",
            huntingChestEventActive: false,
            huntingEventActive: true,
            huntingEventDetail: presentation.detail,
            huntingEventConfirmLabel: confirmLabel,
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
            app.setHuntingOverlayState({ huntingMerchantResult: "파편이 부족합니다." });
            return;
        }

        const refreshedOffers = offers.map((currentOffer, index) =>
            index === offerIndex ? { ...currentOffer, purchased: true } : currentOffer
        );
        this._run = { ...result.run, merchantOffers: refreshedOffers };
        savePlayerProfile(app.playerProfile);

        const merchantResult = formatOfferResultToast(result.result);

        // Refresh merchant overlay with updated state
        const pendingText = formatPendingLootSummary(this._run.pendingLoot);
        const hud = this._getLootHudState();
        app.setHuntingOverlayState({
            huntingMerchantOffers: refreshedOffers,
            huntingLootSummary: pendingText,
            huntingMerchantResult: merchantResult,
            ...hud
        });
    }

    merchantPass() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;
        app.setHuntingOverlayState({
            huntingMerchantActive: false,
            huntingMerchantOffers: null,
            huntingMerchantResult: ""
        });
        this._run = { ...setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.READY), merchantOffers: null };
        this.advance({ waitForFirstMoveUi: true });
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

    eventContinue() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active" || run.phase !== HUNTING_RUN_PHASES.AWAITING_EVENT) return;
        const handlerName = HUNTING_EVENT_CONTINUE_HANDLERS[run.lastEvent?.type];
        if (!handlerName || typeof this[handlerName] !== "function") {
            throw new Error(`Unsupported hunting event continue type: ${run.lastEvent?.type ?? "missing"}`);
        }
        app.setHuntingOverlayState({
            huntingEventActive: false,
            huntingEventDetail: "",
            huntingEventConfirmLabel: ""
        });
        return this[handlerName]();
    }

    _continueEventAdvance() {
        this._run = setHuntingRunPhase(this._run, HUNTING_RUN_PHASES.READY);
        this.advance({ waitForFirstMoveUi: true });
    }

    _continueChestRoom() {
        this.advance({ waitForFirstMoveUi: true });
    }

    _continueCombatRewardChest() {
        const app = this.app;
        const run = this._run;
        this._combatRewardChestQueue.shift();
        if (this._combatRewardChestQueue.length > 0) {
            this._presentCombatRewardChest(app, this._combatRewardChestQueue[0]);
            return;
        }
        const characterId = getHuntingRunCharacterId(run);
        const playerSpec = app.roster.find((f) => f.id === characterId);
        const name = playerSpec?.name ?? characterId;
        const isFinalBoss = run.lastEncounter?.type === HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS;
        if (isFinalBoss) {
            this._presentFinalBossClear(app, this._lastBattleExperienceResult);
        } else {
            this._presentNormalCombatWin(app, name, this._lastBattleExperienceResult);
        }
    }

    continueCharacterUnlockResult() {
        if (!this._pendingUnlockResultChest || this._combatRewardChestQueue.length === 0) return false;
        this._pendingUnlockResultChest = false;
        this._lastBattleCharacterUnlock = null;
        this._presentCombatRewardChest(this.app, this._combatRewardChestQueue[0]);
        return true;
    }

    _resolveHuntingEvent(event, app) {
        const player = this._createPlayerHuntingSpec(this._run);
        if (player) {
            this._run = this._syncRunHealth(this._run, player.appliedSpec);
        }
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
        this._stopHuntingMoveForEvent(app, {
            ...resolution.presentation,
            title: this._withFloorRecoveryFeedback(resolution.presentation.title)
        });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentChoiceEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        app.showOverlay(
            "사냥터 이벤트",
            this._withFloorRecoveryFeedback(resolution.presentation.title),
            resolution.presentation.subtext
        );
        this._stopHuntingMoveForChoice(app, {
            message: this._withFloorRecoveryFeedback(resolution.message),
            canRetreat: resolution.canRetreat,
            floor: this._run.floor,
            summary: resolution.summary
        });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentMerchantEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        app.showOverlay(
            "사냥터 이벤트",
            this._withFloorRecoveryFeedback(resolution.presentation.title),
            resolution.presentation.subtext
        );
        this._stopHuntingMoveForMerchant(app, {
            message: this._withFloorRecoveryFeedback(resolution.message),
            floor: this._run.floor,
            offers: resolution.offers,
            summary: formatPendingLootSummary(this._run.pendingLoot)
        });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentChestEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        app.showOverlay(
            "사냥터 이벤트",
            this._withFloorRecoveryFeedback(resolution.presentation.title),
            resolution.presentation.subtext
        );
        this._stopHuntingMoveForChest(app, {
            chest: resolution.chest,
            floor: this._run.floor,
            message: this._withFloorRecoveryFeedback(`${this._run.floor}층 — ${resolution.presentation.title}`)
        });
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentBattleEvent(app, resolution) {
        if (resolution.logMessage) app.addLog(resolution.logMessage);
        this._stopHuntingMoveForBattle(
            app,
            this._withFloorRecoveryFeedback(resolution.message ?? resolution.presentation.title),
            {
                label: resolution.presentation.title,
                subtext: resolution.presentation.subtext
            }
        );
        return HUNTING_ROUTE_ACTIONS.STOP;
    }

    _presentCombatRewardChest(app, chest) {
        const run = this._run;
        this._run = setHuntingRunPhase(run, HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST);
        const rarityLabel = getRarityLabel(chest.rarity);
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

    _createHuntingExperienceResultStep(app, xpResult) {
        const xpReward = app._createXpRewardView(xpResult);
        return {
            id: "experience",
            label: "경험치",
            text: app._formatXpResult(xpResult) || "이번 전투에서는 회수한 XP 오브가 없습니다.",
            xpReward
        };
    }

    _presentNormalCombatWin(app, name, xpResult = this._lastBattleExperienceResult) {
        const run = this._run;
        const pendingText = formatPendingLootSummary(run.pendingLoot);
        const hud = this._getLootHudState();
        const xpReward = app._createXpRewardView(xpResult);
        this._run = setHuntingRunPhase(run, HUNTING_RUN_PHASES.AWAITING_CHOICE);
        app.refreshPlayerSetup();
        app.showOverlay("사냥터", `${name} 승리!`, `층 ${run.floor} 완료`, { xpReward });
        app.setHuntingOverlayState({
            huntingChoiceVisible: !this._pendingUnlockResultChest,
            huntingCanRetreat: false,
            huntingMoving: false,
            huntingFloor: run.floor,
            huntingCharacterName: name,
            huntingLootSummary: pendingText,
            huntingMoveMessage: `${run.floor}층 전투 승리 · 10층 전진 가능`,
            huntingCombatResultActive: true,
            huntingCombatResultStep: this._lastBattleCharacterUnlock ? "unlock" : "experience",
            huntingCombatResultTotal: this._lastBattleCharacterUnlock ? 3 : 2,
            huntingCharacterUnlock: this._lastBattleCharacterUnlock,
            huntingResultContinueVisible: Boolean(this._pendingUnlockResultChest),
            huntingCombatResultTitle: `${run.floor}층 전투 완료`,
            huntingCombatResultSummary: pendingText,
            ...hud
        });
        app.setStartButton({ hidden: true, disabled: true, text: "" });
        if (!this._pendingUnlockResultChest) this._lastBattleCharacterUnlock = null;
    }

    _presentFinalBossClear(app, xpResult = this._lastBattleExperienceResult) {
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
            huntingLootHudEnhancementStones: 0,
            huntingLootHudChests: 0
        });
        app.presentResultSequence([
            this._createHuntingExperienceResultStep(app, xpResult),
            {
                id: "summary",
                label: "스테이지 클리어",
                text: `${stage.name} 정복`,
                subtext: stageResult.unlockedStageId
                    ? `${getHuntingStage(nextStageId).name} 해금 · 파편 ${securedShards} 확보`
                    : `파편 ${securedShards} 확보`
            }
        ]);
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
            profile.equipment.enhancementStones =
                (profile.equipment.enhancementStones ?? 0) + (run.securedLoot?.enhancementStones ?? 0);
            const stats = applyHuntingRunAchievementProgress(profile.hunting.stats, run);
            const completedFloor = Math.max(1, Math.min(HUNTING_MAX_FLOOR, Math.floor(run.floor ?? 1)));
            const hasKnownStage = HUNTING_STAGES.some((stage) => stage.id === run.stageId);
            profile.hunting.stats = {
                ...stats,
                runsStarted: stats.runsStarted + 1,
                runsRetreated: stats.runsRetreated + (run.status === "retreated" ? 1 : 0),
                runsDefeated: stats.runsDefeated + (run.status === "defeated" ? 1 : 0),
                deepestFloor: Math.max(stats.deepestFloor, completedFloor),
                lastReachedFloorByStage: hasKnownStage
                    ? { ...stats.lastReachedFloorByStage, [run.stageId]: completedFloor }
                    : stats.lastReachedFloorByStage
            };
        }
        app._settleHuntingAchievements(run);
        savePlayerProfile(profile);
    }
}
