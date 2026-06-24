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
    getRemainingStatPoints
} from "./statAllocation.js";
import { STAT_BALANCER_CONFIG as _STAT_BALANCER_CONFIG } from "./statAllocation.js";

// 동적 import 헬퍼 (순환 참조 방지)
function requireStatAllocation() {
    return { STAT_BALANCER_CONFIG: _STAT_BALANCER_CONFIG };
}
import { pickRandomActions, findActionById, showActionFailure } from "./clickActions.js";
import { BattleBall, mergeHeroOrbCarryover, applyHeroOrbCarryoverToBattleBall } from "./entities/index.js";
import {
    loadPlayerProfile,
    savePlayerProfile,
    ensureCharacterRecords,
    unlockCharacterMastery
} from "./playerProfile.js";
import {
    collectActiveEffects,
    MASTERY_EFFECT_DEFS,
    getCharacterChallengeLevel,
    advanceCharacterMastery
} from "./character-mastery/index.js";
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
import { applyAchievementRewards, formatRewardDescription } from "./progression/progressionState.js";
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
    HeroAbility
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
    hero: HeroAbility
};

export class BattleApp {
    constructor() {
        /**
         * 시작 캐릭터 ID. 비워두면(null) 랜덤, ID를 지정하면 해당 캐릭터가
         * 플레이어로 고정되고 토너먼트 첫 엔트리에 배치됩니다.
         * @type {string|null}
         */
        this.startCharacter = null;

        this.elements = {
            canvas: document.getElementById("arenaCanvas"),
            overlay: document.getElementById("overlay")
        };

        this.roster = createRoster();
        this.tournamentRoster = this.roster;
        this.playerProfile = loadPlayerProfile();
        this.playerFighterId = this.pickPlayerFighterId();
        this.playerStatAllocation = createEmptyStatAllocation();
        this.playerResult = null;
        this._matchReports = [];
        this._currentTournamentReport = null;
        this._pickPending = false;
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
        this.selectedActionId = null;
        this._currentChallengeLevel = 0;
        this._lastMasteryResult = null;
        this._battleSpeed = 1;
        this._speedIndicatorTimer = 0;
        this._speedIndicatorText = "";

        // Listen for Alpine.js start-tournament event
        try {
            document.addEventListener("start-tournament", () => this.startTournament());
            document.addEventListener("allocation-changed", () => {
                const s = this.ui.state;
                if (s) this.playerStatAllocation = { ...s.allocation };
            });
        } catch {
            // no-op in non-browser environments
        }

        this.refreshPlayerSetup();
        this._refreshCollectionHub();
        this.ui.updateStatus("내 캐릭터 스탯을 배분하세요", "Setup");
        this.ui.hideOverlay();
        this.startPlayerPreviewLoop();
    }

    pickPlayerFighterId() {
        if (this.startCharacter) return this.startCharacter;
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
        this.ui.renderCollectionHub(vm);
    }

    refreshPlayerSetup() {
        const remaining = getRemainingStatPoints(this.playerStatAllocation);
        const player = this.roster.find((fighter) => fighter.id === this.playerFighterId);
        this.ui.renderPlayerSetup({
            fighter: player,
            stats: ALLOCATABLE_STATS,
            allocation: this.playerStatAllocation,
            totalPoints: PLAYER_STAT_POINTS,
            remainingPoints: remaining,
            locked: Boolean(this.tournament && !this.tournament.champion)
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
        ball.radius = Math.round(ball.baseRadius * 1.35);
        const AbilityClass = ABILITY_MAP[fighter.ability];
        if (AbilityClass) ball.bindAbility(new AbilityClass(ball, {}));
        this._previewBall = ball;
        return ball;
    }

    renderPlayerPreview() {
        if (this.tournament && !this.tournament.champion) {
            return;
        }

        const player = this.roster.find((fighter) => fighter.id === this.playerFighterId);
        const ball = this._ensurePreviewBall(player);
        this.renderer.renderPlayerPreview(ball, player);
    }

    startPlayerPreviewLoop() {
        if (this.previewRafId || (this.tournament && !this.tournament.champion)) {
            return;
        }

        const tick = () => {
            if (this.tournament && !this.tournament.champion) {
                this.previewRafId = 0;
                return;
            }

            this.renderPlayerPreview();
            this.previewRafId = requestAnimationFrame(tick);
        };
        tick();
    }

    stopPlayerPreviewLoop() {
        if (!this.previewRafId) {
            return;
        }

        cancelAnimationFrame(this.previewRafId);
        this.previewRafId = 0;
    }

    async startTournament() {
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

        const remaining = getRemainingStatPoints(this.playerStatAllocation);
        if (remaining > 0) {
            this.ui.showOverlay("스탯 배분 필요", `${remaining} 포인트 남음`);
            this.ui.addLog(`토너먼트 시작 전 스탯 ${remaining} 포인트를 더 배분해야 합니다.`);
            this.refreshPlayerSetup();
            return;
        }

        this.audio.unlock();
        cancelAnimationFrame(this.rafId);
        this.stopPlayerPreviewLoop();
        this.ui.setStartButton({ disabled: true, hidden: true, text: "다시 시작" });
        this._pickPending = false;

        // 연계 효과 계산: 해금된 ID 중 현재 캐릭터가 아닌 효과만 적용
        const masteryCtx = collectActiveEffects(this.playerProfile, this.playerFighterId);
        this._currentChallengeLevel = getCharacterChallengeLevel(this.playerProfile, this.playerFighterId);

        // 숙련도의 balanceTolerance를 SENSITIVITY에 반영
        if (masteryCtx.allocationModifiers.balanceTolerance > 0) {
            _STAT_BALANCER_CONFIG.SENSITIVITY = 20 + masteryCtx.allocationModifiers.balanceTolerance;
        }

        // 숙련도 효과 + 성장 보너스를 반영한 statAllocation 생성
        const adjustedAllocation = { ...this.playerStatAllocation };
        const masteryExtra = masteryCtx.allocationModifiers.extraStatPoints;
        const progressionExtra = this.playerProfile?.progression?.bonuses?.extraStatPoints ?? 0;
        const extraPoints = masteryExtra + progressionExtra;
        if (extraPoints > 0) {
            // extraStatPoints를 비례 배분 (hp 우선, 나머지는 고르게)
            const half = Math.ceil(extraPoints / 2);
            adjustedAllocation.hp = (adjustedAllocation.hp ?? 0) + half;
            const rest = extraPoints - half;
            const spreadStats = ["damage", "speed", "skill", "defense"];
            for (let i = 0; i < rest; i++) {
                const key = spreadStats[i % spreadStats.length];
                adjustedAllocation[key] = (adjustedAllocation[key] ?? 0) + 1;
            }
        }

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
                playerSpec.stats.damage = Math.round(playerSpec.stats.damage * (1 + masteryCtx.statModifiers.damage));
            }
            // 전투 시 physics/action modifier 전달
            playerSpec.masteryPhysicsModifiers = { ...masteryCtx.physicsModifiers };
            playerSpec.masteryActionModifiers = { ...masteryCtx.actionModifiers };
            playerSpec.masteryCombatPassives = [...masteryCtx.combatPassives];
        }
        this.matchmaker = new Matchmaker(this.tournamentRoster);
        this.playerResult = null;
        this.tournament = new TournamentManager(this.tournamentRoster, this.playerFighterId);
        this.currentTournamentMatch = null;
        this.selectedActionId = null;
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

        // 첫 선택이거나 매판 선택 모드면 카드 띄움
        if (!this.selectedActionId || this._pickActionEveryMatch) {
            const cards = pickRandomActions(3);
            const pickedId = await this.ui.waitForActionPick(cards);
            this.selectedActionId = pickedId;
        }

        this.currentMatchAction = findActionById(this.selectedActionId);
        if (this.currentMatchAction) {
            this.ui.addLog(`[액션] ${this.currentMatchAction.name} 준비 완료.`);
        }
        return this.currentMatchAction;
    }

    async startMatch(customMatch = null, options = {}) {
        this.audio.unlock();
        this.ui.setStartButton({ disabled: true, hidden: true });
        this._battleSpeed = 1;
        this._speedIndicatorTimer = 0;
        this._speedIndicatorText = "";
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        if (!options.keepLog) {
            this.ui.resetLog();
        }

        const match = customMatch ?? this.matchmaker.pick();
        const label = `${match[0].name} vs ${match[1].name}`;
        this.ui.renderRoster(match.map((fighter) => fighter.id));
        this.ui.updateStatus(label, "Drawing");
        this.ui.showOverlay("Matchup", label);
        this.ui.addLog(`대진 확정: ${label}`);
        this.ui.addLog(`아레나가 ${match[0].title}와 ${match[1].title}의 능력을 감지했습니다.`);

        // 시뮬레이션 생성 (playerBall은 아직 null)
        this._currentMatchReport = createMatchReport();
        this.simulation = new BattleSimulation(match, {
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
        });

        // 내 캐릭터 식별
        const playerBall = this.simulation.fighters.find((f) => f.id === this.playerFighterId) ?? null;
        this.simulation.playerBall = playerBall;

        if (this._currentMatchReport) {
            this._currentMatchReport.playerFighterId = this.playerFighterId;
            this._currentMatchReport.tournamentRoundIndex = this.currentTournamentMatch?.roundIndex ?? -1;
        }

        // Hero Orb carryover 적용 — entities/ helper로 위임
        for (const fighter of this.simulation.fighters) {
            const spec = match.find((s) => s.id === fighter.id);
            if (spec?.heroOrbCarryover) {
                applyHeroOrbCarryoverToBattleBall(fighter, spec.heroOrbCarryover);
            }
        }

        // 클릭 액션 — 내 캐릭터가 있으면 카드 선택
        this.currentMatchAction = null;
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
        this._actionCtx = {
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
            this._actionCtx.action = this.currentMatchAction;
            this._actionCtx.sim = this.simulation;
            this._actionCtx.player = this.simulation?.playerBall ?? null;
            if (!this._actionCtx.action) return;
            this._actionCtx.trigger = this._actionCtx.action.trigger;
            this._actionCtx.trigger.onPointerDown(this._actionCtx);
        };

        this._pointerUpHandler = () => {
            this._actionCtx.trigger?.onPointerUp(this._actionCtx);
        };

        canvas.addEventListener("pointerdown", this._pointerHandler);
        canvas.addEventListener("pointerup", this._pointerUpHandler);
        canvas.addEventListener("pointerleave", this._pointerUpHandler);
        // 배속 토글 (상단 60px 탭)
        this._speedToggleHandler = (e) => {
            if (this.simulation?.finished) return;
            const rect = canvas.getBoundingClientRect();
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            if (y < 60) {
                this._cycleBattleSpeed();
            }
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
        this._actionCtx = null;
    }

    /** TriggerStrategy.fireAction()에서 호출 — HP 소모 + 지연 예약 */
    _tryFireAction() {
        const { action, sim, player } = this._actionCtx ?? {};
        if (!action || !sim || !player) {
            return false;
        }
        if (player.isDefeated) {
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

        const cost = Math.ceil((player.maxHp * action.hpCostPercent) / 100);
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

        // 사용자 피드백 — 파티클 + 사운드 (액션명 텍스트는 실제 효과 시점에 표시)
        sim.spawnExplosion(player.position.clone(), "#cccccc");
        sim.spawnPulse(player.position.clone(), "#ffffff");
        this.audio.play("dash", 1.0);
        return true;
    }

    // Match end cleanup
    _cleanupMatch() {
        this._unbindClickHandler();
        this.currentMatchAction = null;
    }

    showTransientOverlay(label, text, duration = 1200) {
        const token = String(++this.transientOverlayToken);
        this.ui.showTransientOverlay(label, text, token);
        window.setTimeout(() => {
            const s = this.ui.state;
            if (s && s.overlayVisible && s.overlayTransient && !this.simulation?.finished) {
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
        const idx = speeds.indexOf(this._battleSpeed);
        this._battleSpeed = speeds[(idx + 1) % speeds.length];
        this._speedIndicatorText = `x${this._battleSpeed}`;
        this._speedIndicatorTimer = 1.2;
    }

    /** 배속 표시 렌더링 */
    _renderSpeedIndicator() {
        if (this._speedIndicatorTimer <= 0 && this._battleSpeed === 1) return;
        const ctx = this.renderer.ctx;
        const alpha = this._speedIndicatorTimer > 0 ? Math.min(1, this._speedIndicatorTimer / 0.3) : 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 28px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const text = this._speedIndicatorTimer > 0 ? this._speedIndicatorText : `x${this._battleSpeed}`;
        ctx.fillText(text, 16, 16);
        ctx.restore();
    }

    loop(timestamp) {
        const delta = Math.min(0.032, (timestamp - this.lastTime) / 1000 || 0.016);
        this.lastTime = timestamp;
        const speedDelta = delta * this._battleSpeed;
        if (this._speedIndicatorTimer > 0) this._speedIndicatorTimer -= delta;

        // HoldTrigger tick

        // HoldTrigger tick — 매 프레임 pointer down 상태 확인
        if (this._actionCtx?.trigger?.type === "hold") {
            this._actionCtx.trigger.onTick(this._actionCtx);
        }

        this.simulation.update(speedDelta);
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

        // 매치 리포트 마무리
        if (this._currentMatchReport) {
            const playerBall = this.simulation.fighters.find((f) => f.id === this.playerFighterId);
            this._currentMatchReport.playerWon = winner?.id === this.playerFighterId;
            if (playerBall) {
                recordLowestHp(this._currentMatchReport, playerBall.hp, playerBall.maxHp);
            }
            // 토너먼트 리포트에 추가
            if (!this._currentTournamentReport) {
                this._currentTournamentReport = createTournamentReport();
                this._currentTournamentReport.playerFighterId = this.playerFighterId;
            }
            addMatchReport(this._currentTournamentReport, this._currentMatchReport);
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
                mergeHeroOrbCarryover(winnerSpec, this.simulation.winner?.heroOrbBonuses);
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
                playerLost ? `${this.playerResult.fighterName} ${this.playerResult.rankLabel}` : winner.name
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

        this.ui.showOverlay("Winner", winner.name);
        this.ui.updateStatus(`${winner.name} wins`, "Result");
        this.ui.addLog(`${winner.name} defeats ${loser.name}.`);
        this.ui.addLog("Press the button again for another random matchup.");
        this.ui.setStartButton({ text: "다시 시작", hidden: false, disabled: false });
        this.refreshPlayerSetup();
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
                // 보상 적용
                const rewardOutcomes = applyAchievementRewards(this.playerProfile, achievementResults);
                for (let i = 0; i < achievementResults.length; i++) {
                    const result = achievementResults[i];
                    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === result.id);
                    if (!def) continue;

                    const rewardDesc = formatRewardDescription(def.reward);
                    const rewardOutcome = rewardOutcomes[i];
                    let msg = `[업적 해금] ${def.name} (${def.tier})`;
                    if (rewardDesc) {
                        if (rewardOutcome?.applied) {
                            msg += ` — ${rewardDesc} 적용됨`;
                        } else {
                            msg += ` — ${rewardDesc}`;
                        }
                    }
                    this.ui.addLog(msg);
                    // 토스트 알림
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
        this._matchReports = [];
        this._currentTournamentReport = null;
        this._refreshCollectionHub();

        // 승급 안내 메시지
        let masteryMsg = "";
        if (this._lastMasteryResult?.changed) {
            masteryMsg = ` ${this._lastMasteryResult.previousTier} → ${this._lastMasteryResult.newTier}`;
        }

        this.ui.renderTournament(this.tournament);
        this.ui.showOverlay(
            playerWon ? "축하합니다!" : "토너먼트 종료",
            playerWon
                ? `${champion.name} 우승${masteryMsg}`
                : `${player.name} ${this.playerResult?.rankLabel ?? "결과 확정"}`
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
        this.ui.setStartButton({ text: "새 토너먼트 준비", hidden: false, disabled: false });
        // 재선정 대기 상태
        this._pickPending = true;
    }

    wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
}
