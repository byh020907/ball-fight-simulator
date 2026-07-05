import { AudioEngine } from "./audio.js";
import { BattleSimulation } from "./simulation/battleSimulation.js";
import { ArenaRenderer, UIController } from "./ui.js";
import { Matchmaker, TournamentManager } from "./tournament.js";
import { createRoster } from "./roster.js";
import {
    ALLOCATABLE_STATS,
    PLAYER_STAT_POINTS,
    createEmptyStatAllocation,
    createRandomStatAllocation,
    createTournamentRoster,
    getRemainingStatPoints,
    updateEffectiveStatCap
} from "./statAllocation.js";
import { STAT_BALANCER_CONFIG as _STAT_BALANCER_CONFIG } from "./statAllocation.js";

// 동적 import 헬퍼 (순환 참조 방지)
function requireStatAllocation() {
    return { STAT_BALANCER_CONFIG: _STAT_BALANCER_CONFIG };
}
import { ActionPickerService } from "./actionPicker.js";
import { CollectionHubService } from "./collectionHubService.js";
import { pickRandomActions, findActionById, showActionFailure } from "./clickActions.js";
import { BattleBall, mergeHeroOrbCarryover, applyHeroOrbCarryoverToBattleBall } from "./entities/index.js";
import {
    loadPlayerProfile,
    savePlayerProfile,
    ensureCharacterRecords,
    unlockCharacterMastery,
    migrateLegacyExperienceToCharacter
} from "./playerProfile.js";
import {
    grantExperienceFromMatchReport,
    getCharacterExperienceSummary,
    collectActiveExperienceEffects,
    applyExperienceEffectsToSpec
} from "./experience/experienceService.js";
import { collectActiveEffects, MASTERY_EFFECT_DEFS, advanceCharacterMastery } from "./character-mastery/index.js";
import { createCollectionHubViewModel } from "./collection/collectionViewModel.js";
import {
    createMatchReport,
    createTournamentReport,
    addMatchReport,
    applyTournamentReport,
    recordDamageTaken,
    recordDamageDealt,
    recordLowestHp,
    recordActionUsed,
    recordActionHpCost,
    recordActionSuccess,
    ACHIEVEMENT_DEFINITIONS,
    evaluateAchievements
} from "./collection/index.js";
import {
    computeEffectiveBonuses,
    formatRewardDescription,
    completeChallengeTournament,
    formatBonusSummary
} from "./progression/progressionState.js";
import { getEligibleHuntingCharacters } from "./hunting/huntingState.js";
import { HuntingManager } from "./hunting/huntingManager.js";
import { FIGHTER_IDS, Vector2 } from "./core.js";
import {
    ArcherAbility,
    OrbitAbility,
    TricksterAbility,
    GrenadeAbility,
    DashAbility,
    RageAbility,
    EaterAbility,
    BatBallAbility,
    HeroAbility,
    VampireAbility,
    GunnerAbility,
    PhantomAbility
} from "./abilities/index.js";

const ABILITY_MAP = {
    archer: ArcherAbility,
    orbit: OrbitAbility,
    trickster: TricksterAbility,
    grenade: GrenadeAbility,
    dash: DashAbility,
    rage: RageAbility,
    eater: EaterAbility,
    bat_ball: BatBallAbility,
    hero: HeroAbility,
    vampire: VampireAbility,
    gunner: GunnerAbility,
    phantom: PhantomAbility
};

export class BattleApp {
    constructor() {
        // ── 디버그 변수 (테스트 편의용) ──
        /** @type {{ startCharacter: string|null, aiEnabled: boolean }} */
        this.debug = {
            startCharacter: null,
            // startCharacter: FIGHTER_IDS.GRENADE,
            aiEnabled: false
        };

        this.elements = {
            canvas: document.getElementById("arenaCanvas"),
            overlay: document.getElementById("overlay")
        };

        this.roster = createRoster();
        this.tournamentRoster = this.roster;
        this.playerProfile = loadPlayerProfile();
        this.playerFighterId = this.pickPlayerFighterId();
        migrateLegacyExperienceToCharacter(this.playerProfile, this.playerFighterId);
        this.playerStatAllocation = createEmptyStatAllocation();
        this.playerResult = null;
        this._matchReports = [];
        this._currentTournamentReport = null;
        this._pickPending = false;
        this._onSimulationResult = null;
        this._huntingDone = false;
        this.hunting = new HuntingManager(this);
        this.renderer = new ArenaRenderer(this.elements.canvas);
        this.ui = new UIController(this.roster);
        this.ui.renderTournament();
        this.matchmaker = new Matchmaker(this.roster);
        this.audio = new AudioEngine();
        this.tournament = null;
        this.currentTournamentMatch = null;
        this.simulation = null;
        this.lastTime = 0;
        this.rafId = 0;
        this.previewRafId = 0;
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        this.transientOverlayToken = 0;
        this._previewBall = null;
        this._currentChallengeLevel = 0;
        this._lastMasteryResult = null;
        this._lastXpResult = null;
        this._lastMatchXpResult = null;
        this._selectionAnimTime = 999;

        /** @type {{ selectedId: string|null, current: object|null, pickEveryMatch: boolean, ctx: object|null }} */
        this._action = { selectedId: null, current: null, pickEveryMatch: false, ctx: null };

        /** @type {{ level: number, indicatorTimer: number, indicatorText: string }} */
        this._speed = { level: 1, indicatorTimer: 0, indicatorText: "" };

        // Listen for Alpine.js start-tournament event
        try {
            document.addEventListener("start-tournament", () => this.startTournament());
            document.addEventListener("allocation-changed", () => this._syncPlayerStatAllocationFromUi());
        } catch {
            // no-op in non-browser environments
        }

        this._syncPlayerStatAllocationFromUi();
        this.refreshPlayerSetup();
        this._refreshCollectionHub();
        this.ui.updateStatus("내 캐릭터 스탯을 배분하세요", "Setup");
        this.ui.hideOverlay();
        this.startPlayerPreviewLoop();
    }

    pickPlayerFighterId() {
        if (this.debug.startCharacter) return this.debug.startCharacter;
        return this.roster[Math.floor(Math.random() * this.roster.length)].id;
    }

    _refreshCollectionHub() {
        const vm = createCollectionHubViewModel({
            profile: this.playerProfile,
            roster: this.roster,
            masteryDefinitions: MASTERY_EFFECT_DEFS,
            achievementDefinitions: ACHIEVEMENT_DEFINITIONS,
            currentPlayerFighterId: this.playerFighterId
        });
        CollectionHubService.render(vm);
    }

    /** 스탯 배분 UI용 MAX_POINTS_PER_STAT 업데이트 및 유효 총 포인트 계산 */
    _getStatBonusContext() {
        const masteryCtx = this.playerProfile?.characterMastery?.levels
            ? collectActiveEffects(this.playerProfile, this.playerFighterId)
            : {
                  allocationModifiers: { perStatCapBonus: 0, extraStatPoints: 0, balanceTolerance: 0 }
              };
        const computed = computeEffectiveBonuses(this.playerProfile, ACHIEVEMENT_DEFINITIONS);
        const masteryPerStatCap = masteryCtx.allocationModifiers?.perStatCapBonus ?? 0;
        const masteryExtra = masteryCtx.allocationModifiers?.extraStatPoints ?? 0;
        return {
            progressionPerStatCapBonus: computed.perStatCapBonus,
            masteryPerStatCapBonus: masteryPerStatCap,
            perStatCapBonus: computed.perStatCapBonus + masteryPerStatCap,
            progressionExtraStatPoints: computed.extraStatPoints,
            masteryExtraStatPoints: masteryExtra,
            extraStatPoints: computed.extraStatPoints + masteryExtra
        };
    }

    _updateStatCapForUI() {
        const ctx = this._getStatBonusContext();
        updateEffectiveStatCap(ctx.progressionPerStatCapBonus, ctx.masteryPerStatCapBonus);
    }

    _syncPlayerStatAllocationFromUi() {
        const allocation = this.ui.state?.allocation;
        if (!allocation) return;
        this.playerStatAllocation = {
            ...createEmptyStatAllocation(),
            ...allocation
        };
    }

    refreshPlayerSetup() {
        this._updateStatCapForUI();
        const bonusCtx = this._getStatBonusContext();
        const effectiveTotal = PLAYER_STAT_POINTS + bonusCtx.extraStatPoints;
        const remaining = getRemainingStatPoints(this.playerStatAllocation, effectiveTotal);
        const player = this.roster.find((fighter) => fighter.id === this.playerFighterId);
        const cl = this.playerProfile?.progression?.challenge;
        const balanceTol = computeEffectiveBonuses(this.playerProfile, ACHIEVEMENT_DEFINITIONS).balanceTolerance;
        const bonusSummary = formatBonusSummary({
            extraStatPoints: bonusCtx.extraStatPoints,
            balanceTolerance: balanceTol,
            perStatCapBonus: bonusCtx.perStatCapBonus
        });
        const experienceSummary = getCharacterExperienceSummary(this.playerProfile, this.playerFighterId);
        const huntingAvailable = getEligibleHuntingCharacters(this.playerProfile, this.roster).length > 0;
        this.ui.renderPlayerSetup({
            fighter: player,
            stats: ALLOCATABLE_STATS,
            allocation: this.playerStatAllocation,
            totalPoints: effectiveTotal,
            bonusPoints: bonusCtx.extraStatPoints,
            remainingPoints: remaining,
            locked: Boolean(this.tournament && !this.tournament.champion),
            challengeLevel: cl?.selectedLevel ?? 0,
            highestUnlockedLevel: cl?.highestUnlockedLevel ?? 0,
            progressionBonusSummary: bonusSummary,
            experience: experienceSummary,
            huntingAvailable
        });

        if (!this.tournament || this.tournament.champion) {
            this.ui.setStartButton({
                disabled: remaining > 0,
                text: this.tournament?.champion
                    ? "다시 시작"
                    : remaining > 0
                      ? `스탯 ${remaining} 남음`
                      : "토너먼트 시작",
                hidden: false
            });
            this.startPlayerPreviewLoop();
        }
    }

    _ensurePreviewBall(fighter) {
        if (!fighter) {
            this._previewBall = null;
            return null;
        }
        if (this._previewBall && this._previewBall.id === fighter.id) {
            return this._previewBall;
        }
        const ball = new BattleBall(
            fighter,
            new Vector2(this.renderer.canvas.width / 2, this.renderer.canvas.height / 2 - 28)
        );
        ball.applyImpulse(ball.velocity.clone().scale(-1));
        ball.radius = Math.round(ball.stats.baseRadius * 1.35);
        const AbilityClass = ABILITY_MAP[fighter.ability];
        if (AbilityClass) ball.bindAbility(new AbilityClass(ball, {}));
        this._previewBall = ball;
        this._selectionAnimTime = 0;
        return ball;
    }

    renderPlayerPreview() {
        if (this.tournament && !this.tournament.champion) {
            return;
        }

        const player = this.roster.find((fighter) => fighter.id === this.playerFighterId);
        const ball = this._ensurePreviewBall(player);
        this.renderer.renderPlayerPreview(ball, player, this._selectionAnimTime);
    }

    startPlayerPreviewLoop() {
        if (this.previewRafId || (this.tournament && !this.tournament.champion)) {
            return;
        }

        let lastTime = performance.now();
        const tick = (now) => {
            if (this.tournament && !this.tournament.champion) {
                this.previewRafId = 0;
                return;
            }

            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;
            if (this._selectionAnimTime < 0.6) {
                this._selectionAnimTime += dt;
            }

            this.renderPlayerPreview();
            this.previewRafId = requestAnimationFrame(tick);
        };
        tick(performance.now());
    }

    stopPlayerPreviewLoop() {
        if (!this.previewRafId) {
            return;
        }

        cancelAnimationFrame(this.previewRafId);
        this.previewRafId = 0;
    }

    async startTournament() {
        if (this._huntingDone) {
            this._huntingDone = false;
            this.ui.hideOverlay();
            this.refreshPlayerSetup();
            return;
        }
        // MAX_POINTS_PER_STAT 초기화 (이전 토너먼트에서 변경된 값 복원)
        updateEffectiveStatCap(0, 0);

        // 재선정 대기 상태면 먼저 새 캐릭터 선정
        if (this._pickPending) {
            this.prepareNewTournament();
            return;
        }

        // Sync allocation from Alpine (user may have clicked +/- buttons there)
        const alpineData = this.ui.state;
        if (alpineData) {
            this.playerStatAllocation = { ...alpineData.allocation };
        }

        const bonusCtx = this._getStatBonusContext();
        const effectiveTotal = PLAYER_STAT_POINTS + bonusCtx.extraStatPoints;
        // 플레이어는 기본 100 포인트 이상을 반드시 배분해야 함 (보너스는 선택)
        const baseRemaining = getRemainingStatPoints(this.playerStatAllocation);
        if (baseRemaining > 0) {
            this.ui.showOverlay("스탯 배분 필요", `${baseRemaining} 포인트 남음`);
            this.ui.addLog(`토너먼트 시작 전 스탯 ${baseRemaining} 포인트를 더 배분해야 합니다.`);
            this.refreshPlayerSetup();
            return;
        }

        this.audio.unlock();
        cancelAnimationFrame(this.rafId);
        this.stopPlayerPreviewLoop();
        this.ui.resetLog();
        this.ui.setStartButton({ disabled: true, hidden: true, text: "다시 시작" });
        this._pickPending = false;

        // 연계 효과 계산: 해금된 ID 중 현재 캐릭터가 아닌 효과만 적용
        const masteryCtx = collectActiveEffects(this.playerProfile, this.playerFighterId);
        // Alpine 상태에서 사용자 선택 반영 (프로필보다 우선)
        const alpineChallengeLevel = this.ui.state?.challengeLevel;
        this._currentChallengeLevel =
            alpineChallengeLevel ?? this.playerProfile?.progression?.challenge?.selectedLevel ?? 0;
        // 프로필도 동기화
        if (this.playerProfile?.progression?.challenge && alpineChallengeLevel !== undefined) {
            this.playerProfile.progression.challenge.selectedLevel = alpineChallengeLevel;
        }

        // 숙련도 + 업적 보너스의 balanceTolerance를 SENSITIVITY에 반영 (동적 계산)
        const computedBonuses = computeEffectiveBonuses(this.playerProfile, ACHIEVEMENT_DEFINITIONS);
        const totalBalanceTol = masteryCtx.allocationModifiers.balanceTolerance + computedBonuses.balanceTolerance;
        _STAT_BALANCER_CONFIG.SENSITIVITY = 20 + totalBalanceTol;

        // 집중 투자 한도 업데이트 (업적 보너스 + 숙련도, 동적 계산)
        const perStatCapBonus = computedBonuses.perStatCapBonus + masteryCtx.allocationModifiers.perStatCapBonus;
        if (perStatCapBonus > 0) {
            updateEffectiveStatCap(computedBonuses.perStatCapBonus, masteryCtx.allocationModifiers.perStatCapBonus);
        }

        // adjustedAllocation: 사용자가 UI에서 직접 배분한 값 그대로 사용
        // (extraStatPoints는 이미 UI의 totalPoints에 포함되어 있으므로 별도 분배 불필요)
        const adjustedAllocation = { ...this.playerStatAllocation };

        this.tournamentRoster = createTournamentRoster(
            this.roster,
            this.playerFighterId,
            adjustedAllocation,
            undefined,
            undefined,
            this._currentChallengeLevel
        );
        this.ui.roster = this.tournamentRoster;

        // 플레이어 fighter spec에 숙련도 스탯 보정 적용
        const playerSpec = this.tournamentRoster.find((f) => f.id === this.playerFighterId);
        if (playerSpec) {
            if (masteryCtx.statModifiers.hp > 0) {
                const hpBonus = 1 + masteryCtx.statModifiers.hp;
                playerSpec.stats.hp = Math.round(playerSpec.stats.hp * hpBonus);
            }
            if (masteryCtx.statModifiers.damage > 0) {
                playerSpec.stats.damage = Math.round(playerSpec.stats.damage * (1 + masteryCtx.statModifiers.damage));
            }
            if (masteryCtx.statModifiers.defense > 0) {
                playerSpec.stats.defense = Number(
                    (playerSpec.stats.defense * (1 + masteryCtx.statModifiers.defense)).toFixed(3)
                );
            }
            // 전투 시 physics/action modifier 전달
            playerSpec.mastery = {};
            playerSpec.mastery.physics = { ...masteryCtx.physicsModifiers };
            playerSpec.mastery.action = { ...masteryCtx.actionModifiers };
            playerSpec.mastery.passives = [...masteryCtx.combatPassives];
        }

        // XP 레벨 보상 적용 (숙련도 효과 이후)
        if (playerSpec) {
            const xpEffects = collectActiveExperienceEffects(this.playerProfile, this.playerFighterId);
            applyExperienceEffectsToSpec(playerSpec, xpEffects);
        }
        this.matchmaker = new Matchmaker(this.tournamentRoster);
        this.playerResult = null;
        this.tournament = new TournamentManager(this.tournamentRoster, this.playerFighterId);
        this.currentTournamentMatch = null;
        this._action.selectedId = null;
        this.refreshPlayerSetup();
        this.ui.renderTournament(this.tournament);
        const player = this.tournamentRoster.find((fighter) => fighter.id === this.playerFighterId);
        this.ui.addLog(`내 캐릭터는 ${player.name}. 배분한 스탯으로 토너먼트에 참가합니다.`);
        this.ui.addLog("다른 캐릭터들도 같은 포인트를 랜덤으로 받은 뒤 대진표가 확정되었습니다.");
        await this.runNextTournamentMatch();
    }

    async runNextTournamentMatch() {
        if (!this.tournament) {
            return;
        }

        const nextMatch = this.tournament.nextMatch();
        if (!nextMatch) {
            this.showTournamentChampion();
            return;
        }

        this.currentTournamentMatch = nextMatch;
        this.tournament.markActive(nextMatch);
        this.ui.renderTournament(this.tournament);
        await this.startMatch([nextMatch.a, nextMatch.b], { keepLog: true });
    }

    // ── 액션 선택 정책 ──
    // true면 매 매치마다 선택, false면 토너먼트 첫 판만 선택
    _pickActionEveryMatch = false;

    async _resolveAction(playerBall) {
        if (!playerBall) return null;

        // 사냥터에서는 액션 선택 스킵
        if (this._action.skipPick) return null;

        // 첫 선택이거나 매판 선택 모드면 카드 띄움
        if (!this._action.selectedId || this._action.pickEveryMatch) {
            const cards = pickRandomActions(3);
            const pickedId = await ActionPickerService.show(cards);
            this._action.selectedId = pickedId;
        }

        this._action.current = findActionById(this._action.selectedId);
        if (this._action.current) {
            this.ui.addLog(`[액션] ${this._action.current.name} 준비 완료.`);
            playerBall.clickActionName = this._action.current.name;
        }
        return this._action.current;
    }

    async startMatch(customMatch = null, options = {}) {
        this.audio.unlock();
        this.ui.setStartButton({ disabled: true, hidden: true });
        this._speed.level = 1;
        this._speed.indicatorTimer = 0;
        this._speed.indicatorText = "";
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        this._lastMatchXpResult = null;
        this._action.skipPick = options.skipActionPick ?? false;
        if (!options.keepLog) {
            this.ui.resetLog();
        }

        const match = customMatch ?? this.matchmaker.pick();
        const label = `${match[0].name} vs ${match[1].name}`;
        this.ui.renderRoster(
            match.map((fighter) => fighter.id),
            match
        );
        this.ui.updateStatus(label, "Drawing");
        this.ui.showOverlay("Matchup", label);
        this.ui.addLog(`대진 확정: ${label}`);
        this.ui.addLog(`아레나가 ${match[0].title}와 ${match[1].title}의 능력을 감지했습니다.`);

        // 시뮬레이션 생성 (playerBall은 아직 null)
        this._currentMatchReport = createMatchReport();
        this.simulation = new BattleSimulation(
            match,
            {
                assignActions: this.debug.aiEnabled || this._currentChallengeLevel > 0,
                onLog: (message) => this.ui.addLog(message),
                onOvertime: () => {
                    this.ui.updateStatus(label, "Overtime");
                    this.showTransientOverlay("Overtime", "", 1250);
                    this.audio.play("overtime");
                },
                onSound: (type, intensity) => this.audio.play(type, intensity),
                onDamageTaken: (fighterId, actualDamage) => {
                    if (fighterId === this.playerFighterId && this._currentMatchReport) {
                        recordDamageTaken(this._currentMatchReport, actualDamage);
                    }
                },
                onDamageDealt: (fighterId, actualDamage) => {
                    if (fighterId === this.playerFighterId && this._currentMatchReport) {
                        recordDamageDealt(this._currentMatchReport, actualDamage);
                    }
                },
                onHpChanged: (fighterId, hp, maxHp) => {
                    if (fighterId === this.playerFighterId && this._currentMatchReport) {
                        recordLowestHp(this._currentMatchReport, hp, maxHp);
                    }
                },
                onActionSuccess: (actionId) => {
                    if (this._currentMatchReport) {
                        recordActionSuccess(this._currentMatchReport, actionId);
                    }
                }
            },
            null,
            {
                arenaWidth: options.arenaWidth,
                arenaHeight: options.arenaHeight,
                cameraZoom: options.cameraZoom
            }
        );

        // 내 캐릭터 식별
        const playerBall = this.simulation.fighters.find((f) => f.id === this.playerFighterId) ?? null;
        this.simulation.playerBall = playerBall;

        // ── AI 캐릭터 RL 모델 로드 ──
        for (const fighter of this.simulation.fighters) {
            if (fighter === playerBall) continue;
            const ctrl = fighter.aiController;
            if (ctrl?._chosenAction) {
                await ctrl.loadRlPolicy(fighter.id);
            }
        }

        if (this._currentMatchReport) {
            this._currentMatchReport.playerFighterId = this.playerFighterId;
            this._currentMatchReport.tournamentRoundIndex = this.currentTournamentMatch?.roundIndex ?? -1;
        }

        // Hero Orb carryover 적용 — entities/ helper로 위임
        for (const fighter of this.simulation.fighters) {
            const spec = match.find((s) => s.id === fighter.id);
            if (spec?.hero?.carryover) {
                applyHeroOrbCarryoverToBattleBall(fighter, spec.hero.carryover);
            }
        }

        // 클릭 액션 — 내 캐릭터가 있으면 카드 선택
        this._action.current = null;
        if (playerBall) {
            await this._resolveAction(playerBall);
        }

        // 클릭 핸들러 바인딩
        this._bindClickHandler();

        this.renderer.render(this.simulation);
        await this.wait(1350);

        this.ui.hideOverlay();
        this.ui.updateStatus(label, "Fight");
        this.audio.play("start");
        this.ui.addLog("전투가 자동으로 시작됩니다.");
        this.lastTime = performance.now();
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame((time) => this.loop(time));
    }

    // ── 클릭 액션 핸들러 ──

    _bindClickHandler() {
        // 기존 핸들러 제거
        this._unbindClickHandler();

        const canvas = this.elements?.canvas;
        if (!canvas) return;

        // ctx — TriggerStrategy에 전달
        this._action.ctx = {
            action: null,
            sim: null,
            player: null,
            _holding: false,
            _consumed: false,
            _holdStarted: false,
            fireAction: () => this._tryFireAction()
        };

        this._pointerHandler = () => {
            if (this.simulation?.finished) return;
            this._action.ctx.action = this._action.current;
            this._action.ctx.sim = this.simulation;
            this._action.ctx.player = this.simulation?.playerBall ?? null;
            if (!this._action.ctx.action) return;
            this._action.ctx.trigger = this._action.ctx.action.trigger;
            this._action.ctx.trigger.onPointerDown(this._action.ctx);
        };

        this._pointerUpHandler = () => {
            this._action.ctx.trigger?.onPointerUp(this._action.ctx);
        };

        canvas.addEventListener("pointerdown", this._pointerHandler);
        canvas.addEventListener("pointerup", this._pointerUpHandler);
        canvas.addEventListener("pointerleave", this._pointerUpHandler);
        // 배속 토글 (관전 중에만 동작, 전투 영역 전체)
        this._speedToggleHandler = () => {
            if (this.simulation?.finished) return;
            if (this.simulation?.playerBall) return;
            this._cycleBattleSpeed();
        };
        canvas.addEventListener("pointerdown", this._speedToggleHandler);
    }

    _unbindClickHandler() {
        try {
            const canvas = this.elements?.canvas;
            if (!canvas || typeof canvas.removeEventListener !== "function") return;
            if (this._pointerHandler) {
                canvas.removeEventListener("pointerdown", this._pointerHandler);
                canvas.removeEventListener("pointerup", this._pointerUpHandler);
                canvas.removeEventListener("pointerleave", this._pointerUpHandler);
            }
            if (this._speedToggleHandler) {
                canvas.removeEventListener("pointerdown", this._speedToggleHandler);
                this._speedToggleHandler = null;
            }
        } catch {
            // no-op in non-browser environments
        }
        this._action.ctx = null;
    }

    /** TriggerStrategy.fireAction()에서 호출 — HP 소모 + 지연 예약 */
    _tryFireAction() {
        const { action, sim, player } = this._action.ctx ?? {};
        if (!action || !sim || !player) {
            return false;
        }
        if (player.flags.defeated) {
            return false;
        }
        if (player.hp / player.maxHp < 0.05) {
            return false;
        }

        // 조건 불충족 시 피드백 문구 표시 (HP 소모 없이 리턴)
        if (action.getFailureReason(sim, player)) {
            showActionFailure(action, sim, player);
            return false;
        }

        const reduction = player.mastery.action?.hpCostPercentReduction ?? 0;
        const minPct = (player.mastery.action?.minHpCostPercent ?? 0) * 100;
        const effectivePct = Math.max(minPct, action.hpCostPercent - reduction * 100);
        const cost = Math.ceil((player.maxHp * effectivePct) / 100);
        const paidCost = player.actionContext.spendHpForAction(player, cost);
        if (paidCost <= 0) {
            return false;
        }

        // 액션 사용 기록
        if (this._currentMatchReport) {
            recordActionUsed(this._currentMatchReport, action.id);
            recordActionHpCost(this._currentMatchReport, paidCost);
        }

        sim.scheduleAction(action, player, paidCost);
        return true;
    }

    // Match end cleanup
    _cleanupMatch() {
        this._unbindClickHandler();
        this._action.current = null;
    }

    _formatXpResult(result) {
        if (!result || result.xpGained <= 0) {
            return "";
        }

        return `+${result.xpGained}XP (Lv.${result.level})${result.levelUp ? " 레벨업!" : ""}`;
    }

    _createXpRewardView(result) {
        if (!result || result.xpGained <= 0) {
            return null;
        }

        const fighter = this.roster.find((item) => item.id === result.characterId);
        return {
            characterName: fighter?.name ?? result.characterId,
            xpGained: result.xpGained,
            previousLevel: result.previousLevel,
            level: result.level,
            levelLabel: result.levelLabel ?? `Lv.${result.level}`,
            levelUp: result.levelUp,
            progressBeforePct: result.progressBeforePct ?? 0,
            progressAfterPct: result.progressAfterPct ?? 0,
            progressText: result.progressText ?? "",
            nextText: result.nextText ?? "",
            nextRewardText: result.nextRewardText ?? ""
        };
    }

    _grantExperienceFromMatchReport(report) {
        const result = grantExperienceFromMatchReport(this.playerProfile, report);
        this._lastXpResult = result;
        this._lastMatchXpResult = result;

        if (result.xpGained > 0) {
            this.ui.addLog(`[경험치] ${this._formatXpResult(result)}`);
            if (result.levelUp) {
                this.ui.showToast(`레벨업! Lv.${result.level}`);
            }
            savePlayerProfile(this.playerProfile);
            this._refreshCollectionHub();
            this.refreshPlayerSetup();
        }

        return result;
    }

    showTransientOverlay(label, text, duration = 1200) {
        const token = String(++this.transientOverlayToken);
        this.ui.showTransientOverlay(label, text, token);
        window.setTimeout(() => {
            if (this.ui.overlayTransient && this.ui.transientToken === token && !this.simulation?.finished) {
                this.ui.hideOverlay();
            }
        }, duration);
    }

    /** 사용 가능한 최대 배속 (speed_2x/speed_4x 업적 해금 기반) */
    _getMaxBattleSpeed() {
        const achievements = this.playerProfile?.collection?.achievements ?? {};
        if (achievements.speed_4x?.unlockedAt) return 4;
        if (achievements.speed_2x?.unlockedAt) return 2;
        return 1;
    }

    /** 배속 순환 */
    _cycleBattleSpeed() {
        const maxSpeed = this._getMaxBattleSpeed();
        const speeds = [1];
        if (maxSpeed >= 2) speeds.push(2);
        if (maxSpeed >= 4) speeds.push(4);
        const idx = speeds.indexOf(this._speed.level);
        this._speed.level = speeds[(idx + 1) % speeds.length];
        this._speed.indicatorText = `x${this._speed.level}`;
        this._speed.indicatorTimer = 1.2;
        this.showTransientOverlay(`x${this._speed.level}`, "", 900);
    }

    /** 배속 표시 렌더링 */
    _renderSpeedIndicator() {
        if (this._speed.indicatorTimer <= 0 && this._speed.level === 1) return;
        const ctx = this.renderer.ctx;
        const alpha = this._speed.indicatorTimer > 0 ? Math.min(1, this._speed.indicatorTimer / 0.3) : 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 28px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const text = this._speed.indicatorTimer > 0 ? this._speed.indicatorText : `x${this._speed.level}`;
        ctx.fillText(text, 16, 16);
        ctx.restore();
    }

    loop(timestamp) {
        const delta = Math.min(0.032, (timestamp - this.lastTime) / 1000 || 0.016);
        this.lastTime = timestamp;
        const speedDelta = delta * this._speed.level;
        if (this._speed.indicatorTimer > 0) this._speed.indicatorTimer -= delta;

        // HoldTrigger tick

        // HoldTrigger tick — 매 프레임 pointer down 상태 확인
        if (this._action.ctx?.trigger?.type === "hold") {
            this._action.ctx.trigger.onTick(this._action.ctx);
        }

        this.simulation.update(speedDelta, delta);
        this.renderer.render(this.simulation);
        this._renderSpeedIndicator();
        this.ui.updateLiveCards(this.simulation.fighters);

        if (this.simulation.finished) {
            if (!this.resultSequenceAnnounced) {
                this.resultSequenceAnnounced = true;
                const loser = this.simulation.loser;
                this.ui.updateStatus(loser ? `${loser.name} is down` : "Final impact", "KO");
            }

            if (this.simulation.resultReady) {
                if (this._onSimulationResult) {
                    this._onSimulationResult(this);
                    return;
                }
                this.finishMatch();
                return;
            }

            this.rafId = requestAnimationFrame((time) => this.loop(time));
            return;
        }

        this.rafId = requestAnimationFrame((time) => this.loop(time));
    }

    finishMatch() {
        if (this.matchFinalized) {
            return;
        }

        this._cleanupMatch();
        this.matchFinalized = true;
        const winner = this.simulation.winner;
        const loser = this.simulation.loser ?? this.simulation.fighters.find((fighter) => fighter !== winner);
        let xpSubtext = "";
        let xpReward = null;

        // 매치 리포트 마무리
        if (this._currentMatchReport) {
            const playerBall = this.simulation.fighters.find((f) => f.id === this.playerFighterId);
            const enemies =
                playerBall && typeof this.simulation.getEnemiesOf === "function"
                    ? this.simulation.getEnemiesOf(playerBall)
                    : this.simulation.fighters.filter((f) => f.id !== this.playerFighterId);
            this._currentMatchReport.playerWon =
                Boolean(playerBall && winner) &&
                (winner === playerBall ||
                    (typeof this.simulation.isHostile === "function" &&
                        !this.simulation.isHostile(winner, playerBall)));
            if (playerBall) {
                recordLowestHp(this._currentMatchReport, playerBall.hp, playerBall.maxHp);
                this._currentMatchReport.hpRemain = playerBall.hp;
                this._currentMatchReport.myMaxHp = playerBall.maxHp;
                this._currentMatchReport.opponentMaxHp = enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0);

                if (this.tournament && this.currentTournamentMatch) {
                    if (!this._currentTournamentReport) {
                        this._currentTournamentReport = createTournamentReport();
                        this._currentTournamentReport.playerFighterId = this.playerFighterId;
                    }
                    addMatchReport(this._currentTournamentReport, this._currentMatchReport);
                }

                const xpResult = this._grantExperienceFromMatchReport(this._currentMatchReport);
                xpSubtext = this._formatXpResult(xpResult);
                xpReward = this._createXpRewardView(xpResult);
            }
            this._currentMatchReport = null;
        }

        if (this.tournament && this.currentTournamentMatch) {
            const winnerSpec =
                [this.currentTournamentMatch.a, this.currentTournamentMatch.b].find(
                    (fighter) => fighter?.id === winner.id
                ) ?? this.tournamentRoster.find((fighter) => fighter.id === winner.id);
            const playerWasInMatch = [this.currentTournamentMatch.a, this.currentTournamentMatch.b].some(
                (fighter) => fighter?.id === this.playerFighterId
            );
            const playerLost = playerWasInMatch && winnerSpec.id !== this.playerFighterId;

            // Hero Ball 승리 시 carryover — HeroAbility/entities/ helper로 위임
            if (winnerSpec.ability === "hero") {
                mergeHeroOrbCarryover(winnerSpec, this.simulation.winner?.hero.bonuses);
            }
            if (playerLost && !this.playerResult) {
                this.playerResult = {
                    rankLabel: this.getPlayerRankLabel(this.currentTournamentMatch.roundIndex),
                    fighterName: [this.currentTournamentMatch.a, this.currentTournamentMatch.b].find(
                        (fighter) => fighter?.id === this.playerFighterId
                    )?.name
                };
            }
            this.tournament.complete(this.currentTournamentMatch, winnerSpec);
            this.ui.renderTournament(this.tournament);
            this.ui.showOverlay(
                playerLost ? "아쉽네요" : this.tournament.champion ? "Champion" : "Advances",
                playerLost ? `${this.playerResult.fighterName} ${this.playerResult.rankLabel}` : winner.name,
                xpSubtext,
                xpReward
            );
            this.ui.updateStatus(
                playerLost
                    ? `내 캐릭터는 ${this.playerResult.rankLabel}로 탈락`
                    : this.tournament.champion
                      ? `${winner.name} is champion`
                      : `${winner.name} advances`,
                "Result"
            );
            this.ui.addLog(`${winner.name} defeats ${loser.name}.`);
            if (playerLost) {
                this.ui.addLog(
                    `아쉽네요. 내 캐릭터 ${this.playerResult.fighterName}는 ${this.playerResult.rankLabel}입니다.`
                );
            }
            this.currentTournamentMatch = null;

            if (this.tournament.champion) {
                this.showTournamentChampion();
                return;
            }

            window.setTimeout(() => this.runNextTournamentMatch(), 1450);
            return;
        }

        this.ui.showOverlay("Winner", winner.name, xpSubtext, xpReward);
        this.ui.updateStatus(`${winner.name} wins`, "Result");
        this.ui.addLog(`${winner.name} defeats ${loser.name}.`);
        this.ui.addLog("Press the button again for another random matchup.");
        this.refreshPlayerSetup();
        this.ui.setStartButton({ text: "다시 시작", hidden: false, disabled: false });
    }

    getPlayerRankLabel(roundIndex) {
        if (roundIndex === 2) {
            return "2위";
        }

        if (roundIndex === 1) {
            return "공동 3위";
        }

        return "공동 5위";
    }

    playerResultToPlacement() {
        if (!this.playerResult) return 5;
        if (this.playerResult.rankLabel === "1위") return 1;
        if (this.playerResult.rankLabel === "2위") return 2;
        if (this.playerResult.rankLabel === "공동 3위") return 3;
        return 5;
    }

    /** 새 토너먼트 준비: 대표 캐릭터 재선정 */
    prepareNewTournament() {
        if (!this._pickPending) return;
        this._pickPending = false;

        // 직전 캐릭터 제외하고 랜덤 선정
        const others = this.roster.filter((f) => f.id !== this.playerFighterId);
        if (others.length > 0) {
            const picked = others[Math.floor(Math.random() * others.length)];
            this.playerFighterId = picked.id;
        } else {
            this.playerFighterId = this.roster[Math.floor(Math.random() * this.roster.length)].id;
        }

        // 스탯 배분 초기화
        this.playerStatAllocation = createEmptyStatAllocation();
        this.playerResult = null;
        this.tournament = null;
        this.currentTournamentMatch = null;

        this._refreshCollectionHub();
        this.refreshPlayerSetup();
        this.ui.hideOverlay();
        this.startPlayerPreviewLoop();
        this.ui.addLog(`새 대표 캐릭터: ${picked?.name ?? "무작위"}. 스탯을 배분하세요.`);
    }

    showTournamentChampion() {
        if (!this.tournament?.champion) {
            return;
        }

        const champion = this.tournament.champion;
        const player = this.tournamentRoster.find((fighter) => fighter.id === this.playerFighterId);
        const playerWon = champion.id === this.playerFighterId;
        if (playerWon) {
            this.playerResult = { rankLabel: "1위", fighterName: champion.name };
        }

        // 토너먼트 리포트 생성 및 프로필 저장
        if (this._currentTournamentReport) {
            this._currentTournamentReport.playerWon = playerWon;
            this._currentTournamentReport.placement = playerWon ? 1 : this.playerResultToPlacement();
            applyTournamentReport(this.playerProfile, this._currentTournamentReport);

            // 업적 판정 (applyTournamentReport 후, 프로필에 최신 데이터 반영됨)
            const achievementResults = evaluateAchievements(this.playerProfile, ACHIEVEMENT_DEFINITIONS, {
                profile: this.playerProfile,
                report: this._currentTournamentReport,
                roster: this.roster,
                playerFighterId: this.playerFighterId
            });
            if (achievementResults.length > 0) {
                for (const result of achievementResults) {
                    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === result.id);
                    if (!def) continue;

                    const rewardDesc = formatRewardDescription(def.reward);
                    let msg = `[업적 해금] ${def.name} (${def.tier})`;
                    if (rewardDesc) msg += ` — ${rewardDesc}`;
                    this.ui.addLog(msg);
                    this.ui.showToast(msg);
                }
            }

            // 숙련도 승급 처리 (등급 기반)
            const masteryResult = advanceCharacterMastery(this.playerProfile, {
                characterId: this.playerFighterId,
                challengeLevel: this._currentChallengeLevel ?? 0,
                playerWon
            });
            if (masteryResult.changed) {
                const sourceName = this.roster.find((f) => f.id === this.playerFighterId)?.name ?? this.playerFighterId;
                this.ui.showToast(
                    `[숙련도 승급] ${sourceName} ${masteryResult.previousTier} → ${masteryResult.newTier}`
                );
                this.ui.addLog(`[숙련도 승급] ${sourceName} ${masteryResult.previousTier} → ${masteryResult.newTier}`);
            }
            savePlayerProfile(this.playerProfile);
            this._lastMasteryResult = masteryResult;
        }

        // 도전 단계 해금 처리 (리포트 블록 밖에서도 접근 가능)
        const challengeResult = this._currentTournamentReport
            ? completeChallengeTournament(this.playerProfile, {
                  selectedLevel: this._currentChallengeLevel,
                  playerWon
              })
            : null;

        this._matchReports = [];
        this._currentTournamentReport = null;
        this._refreshCollectionHub();

        // 승급 안내 메시지
        let masteryMsg = "";
        if (this._lastMasteryResult?.changed) {
            masteryMsg = ` ${this._lastMasteryResult.previousTier} → ${this._lastMasteryResult.newTier}`;
        }

        // 경험치 요약
        const xpMsg = this._formatXpResult(this._lastMatchXpResult);

        // 도전 단계 해금 메시지
        let challengeMsg = "";
        if (playerWon) {
            const cl = this._currentChallengeLevel;
            if (cl > 0) {
                challengeMsg = `도전 단계 ${cl} 클리어`;
            }
            if (challengeResult?.unlocked) {
                challengeMsg += `\n새로운 도전 단계 ${challengeResult.unlockedLevel} 해금!`;
            } else if (cl > 0) {
                challengeMsg += `\n최고 해금 단계 ${this.playerProfile?.progression?.challenge?.highestUnlockedLevel ?? cl}`;
            }
        } else {
            challengeMsg = `도전 단계 ${this._currentChallengeLevel} 도전 실패\n해금 단계는 유지됩니다`;
        }

        this.ui.renderTournament(this.tournament);
        this.ui.showOverlay(
            playerWon ? "축하합니다!" : "토너먼트 종료",
            playerWon
                ? `${champion.name} 우승${masteryMsg}`
                : `${player.name} ${this.playerResult?.rankLabel ?? "결과 확정"}`,
            [xpMsg, challengeMsg.replace(/\n/g, " | ")].filter(Boolean).join(" | "),
            this._createXpRewardView(this._lastMatchXpResult)
        );
        this.ui.updateStatus(
            playerWon
                ? `내 캐릭터 ${champion.name} 우승${masteryMsg}`
                : `내 캐릭터 ${player.name} ${this.playerResult?.rankLabel ?? ""}`,
            "Result"
        );
        this.ui.addLog(`${champion.name} takes the whole bracket.`);
        this.ui.addLog(
            playerWon
                ? `축하합니다! 내 캐릭터 ${champion.name}가 토너먼트에서 우승했습니다.${masteryMsg}`
                : `아쉽네요. 내 캐릭터 ${player.name}의 최종 성적은 ${this.playerResult?.rankLabel ?? "기록 없음"}입니다.`
        );
        if (challengeMsg) {
            this.ui.addLog(challengeMsg.replace(/\n/g, " — "));
        }
        this.ui.setStartButton({ text: "새 토너먼트 준비", hidden: false, disabled: false });
        // 재선정 대기 상태
        this._pickPending = true;
    }

    wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
}
