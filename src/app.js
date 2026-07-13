import { AudioEngine } from "./audio.js";
import { BattleSimulation } from "./simulation/battleSimulation.js";
import { ArenaRenderer } from "./ui.js";
import { Matchmaker, TournamentManager } from "./tournament.js";
import { createRoster } from "./roster.js";
import {
    ALLOCATABLE_STATS,
    PLAYER_STAT_POINTS,
    createEmptyStatAllocation,
    createRandomStatAllocation,
    createTournamentRoster,
    getRemainingStatPoints,
    adjustStatAllocation,
    formatStatAllocation,
    calculateStatMultiplier
} from "./statAllocation.js";
import { ActionPickerService } from "./actionPicker.js";
import { CollectionHubService } from "./collectionHubService.js";
import { pickRandomActions, findActionById, showActionFailure } from "./clickActions.js";
import { BattleBall } from "./entities/index.js";
import { PreviewReselectSimulation } from "./preview/previewReselectSimulation.js";
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
    collectActiveExperienceProgression,
    applyExperienceProgressionToBall,
    applyExperienceProgressionToBaseSpec
} from "./experience/experienceService.js";
import {
    collectActiveEffects,
    applyMasteryEffectsToFighterSpec,
    MASTERY_EFFECT_DEFS,
    advanceCharacterMastery,
    getCharacterChallengeLevel
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
    evaluateAchievements,
    grantAchievementReward,
    formatAchievementReward
} from "./collection/index.js";
import { getEligibleHuntingCharacters } from "./hunting/huntingState.js";
import { HuntingManager } from "./hunting/huntingManager.js";
import {
    applyEquipmentStats,
    canCharacterEquipItem,
    getCharacterEquipmentLevel,
    getEquipmentRequiredLevel,
    getEquippedStatBonuses,
    getInventorySlots,
    getInventoryUsed
} from "./hunting/equipmentConfig.js";
import { FIGHTER_IDS, Vector2 } from "./core.js";
import { formatHeroStatLine, formatHeroStatParts, mergeOrbBonuses } from "./entities/heroOrb.js";
import { Ability } from "./abilities/index.js";
import { AppLifecycle } from "./appLifecycle.js";
import { ScreenWakeLock } from "./screenWakeLock.js";

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
        this._onSimulationResult = null;
        this.lifecycle = new AppLifecycle();
        this.hunting = new HuntingManager(this);
        this.renderer = new ArenaRenderer(this.elements.canvas);
        const self = this;
        this._bracket = Alpine.store("uiManager").requireComponent("tournamentBracket");
        this._overlay = Alpine.store("uiManager").requireComponent("gameOverlay");
        this._panel = Alpine.store("uiManager").requireComponent("playerPanel");
        this._startBtn = Alpine.store("uiManager").requireComponent("startButton");
        this._log = Alpine.store("uiManager").requireComponent("battleLog");
        this._strip = Alpine.store("uiManager").requireComponent("fighterStrip");
        this._root = Alpine.store("uiManager").requireComponent("appRoot");
        this._toast = Alpine.store("uiManager").requireComponent("toastNotification");
        this._modeSegment = Alpine.store("uiManager").requireComponent("modeSegment");
        this._gameMode = "tournament";
        this.ui = {
            get logItems() {
                return self._log.items;
            },
            get state() {
                return new Proxy(self._panel, {
                    get(target, prop) {
                        if (prop === "playerExperience") return target.experience;
                        return target[prop];
                    }
                });
            },
            lastOverlayState: null
        };
        {
            const origSetHunting = this._overlay.setHuntingState;
            this._overlay.setHuntingState = (data) => {
                if (data) self.ui.lastOverlayState = { ...self.ui.lastOverlayState, ...data };
                if (origSetHunting) origSetHunting.call(self._overlay, data);
            };
        }
        this._bracket.render(null);
        this.matchmaker = new Matchmaker(this.roster);
        this.audio = new AudioEngine();
        this._screenWakeLock = new ScreenWakeLock();
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
        this._lastMasteryResult = null;
        this._lastXpResult = null;
        this._lastMatchXpResult = null;
        this._selectionAnimTime = 999;
        this._previewSim = null;
        this._queuedPreviewReselect = false;

        /** @type {{ selectedId: string|null, current: object|null, pickEveryMatch: boolean, ctx: object|null }} */
        this._action = { selectedId: null, current: null, pickEveryMatch: false, ctx: null };

        /** @type {{ level: number, indicatorTimer: number, indicatorText: string }} */
        this._speed = { level: 1, indicatorTimer: 0, indicatorText: "" };

        this._syncPlayerStatAllocationFromUi();
        this.refreshPlayerSetup();
        this._refreshCollectionHub();
        this._root.statusText = "내 캐릭터 스탯을 배분하세요";
        this._root.statusBadge = "Setup";
        this.resetHuntingUiState();
        this.startPlayerPreviewLoop();
        this._bindPreviewReselectInput();
    }

    // ── HuntingManager backward-compat ──
    setHuntingActive(active) {
        // huntingButton 제거됨 — 게임 모드 선택 카드로 통합
    }
    setHuntingOverlayState(data) {
        this._overlay.setHuntingState(data);
    }
    resetHuntingUiState() {
        this._overlay.reset();
    }
    resetGameplayUiState() {
        this._root.reset();
        this._panel.reset();
        this._modeSegment.reset();
        this._startBtn.reset();
        this._log.reset();
        this._strip.reset();
        this._bracket.reset();
        this.resetHuntingUiState();
        this._toast.reset();
    }
    beginGameSession() {
        this.lifecycle.beginGameplay();
        this._screenWakeLock.activate();
    }
    beginResultConfirmation() {
        this.lifecycle.awaitResultConfirmation();
        this._screenWakeLock.deactivate();
    }
    returnToInitialState() {
        cancelAnimationFrame(this.rafId);
        this.lifecycle.returnToSetup();
        this._screenWakeLock.deactivate();
        this._onSimulationResult = null;
        this.matchFinalized = false;
        this.simulation = null;
        this.tournament = null;
        this.currentTournamentMatch = null;
        this._currentMatchReport = null;
        this._currentTournamentReport = null;
        this._matchReports = [];
        this.playerResult = null;
        this._lastMasteryResult = null;
        this._lastXpResult = null;
        this._lastMatchXpResult = null;
        this._action = { selectedId: null, current: null, pickEveryMatch: false, ctx: null };
        this._speed = { level: 1, indicatorTimer: 0, indicatorText: "" };
        this.ui.lastOverlayState = null;
        this.resetGameplayUiState();
        this.refreshPlayerSetup();
        this.startPlayerPreviewLoop();
    }
    addLog(message) {
        this._log.add(message);
    }
    showOverlay(label, text, subtext) {
        this._overlay.show({ label, text, subtext });
    }
    setStartButton(opts) {
        this._startBtn.setState(opts);
    }
    showToast(message) {
        this._toast.show(message);
    }

    setGameMode(mode) {
        if (mode !== "tournament" && mode !== "hunting") return;
        if (!this.lifecycle.isSetup) return;
        this._gameMode = mode;
        this._modeSegment.mode = mode;
        // 모드 전환 시 새 캐릭터로 랜덤 변경
        if (mode === "hunting") {
            const eligible = getEligibleHuntingCharacters(this.playerProfile, this.roster);
            if (eligible.length > 0) {
                this.playerFighterId = eligible[Math.floor(Math.random() * eligible.length)].id;
            }
        } else {
            const others = this.roster.filter((f) => f.id !== this.playerFighterId);
            if (others.length > 0) {
                this.playerFighterId = others[Math.floor(Math.random() * others.length)].id;
            } else {
                this.playerFighterId = this.roster[Math.floor(Math.random() * this.roster.length)].id;
            }
        }
        this.playerStatAllocation = createEmptyStatAllocation();
        this._previewBall = null;
        this._selectionAnimTime = 0;
        this.refreshPlayerSetup();
    }

    pickPlayerFighterId() {
        if (this.debug.startCharacter) return this.debug.startCharacter;
        return this.roster[Math.floor(Math.random() * this.roster.length)].id;
    }

    canReselectPreviewCharacter() {
        if (!this.lifecycle.isSetup) return false;
        if (this._previewSim) return false;
        if (this.tournament !== null) return false;
        if (this.simulation && !this.simulation.finished) return false;
        if (this.hunting?._run) return false;
        if (this.hunting?._moving) return false;
        if (this._panel.locked) return false;
        return true;
    }

    _pickDifferentPlayerFighterId() {
        if (this._gameMode === "hunting") {
            // 사냥터 모드: 우승 캐릭터만 순환 (로테이션)
            const eligible = getEligibleHuntingCharacters(this.playerProfile, this.roster);
            if (eligible.length === 0) return this.playerFighterId;
            const currentIdx = eligible.findIndex((c) => c.id === this.playerFighterId);
            const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % eligible.length;
            return eligible[nextIdx].id;
        }
        const others = this.roster.filter((f) => f.id !== this.playerFighterId);
        if (others.length === 0) return this.playerFighterId;
        return others[Math.floor(Math.random() * others.length)].id;
    }

    reselectPreviewCharacterFromPreview() {
        if (this._previewSim) {
            this._queuedPreviewReselect = true;
            return true;
        }
        if (!this.canReselectPreviewCharacter()) return false;

        // 사냥터 모드: eligible 체크
        if (this._gameMode === "hunting") {
            const eligible = getEligibleHuntingCharacters(this.playerProfile, this.roster);
            if (eligible.length === 0) return false;
        }

        const newId = this._pickDifferentPlayerFighterId();
        if (newId === this.playerFighterId) return false;

        const oldFighter = this.roster.find((f) => f.id === this.playerFighterId);
        const newFighter = this.roster.find((f) => f.id === newId);
        if (!oldFighter || !newFighter) return false;

        const canvas = this.renderer.canvas;
        const center = new Vector2(canvas.width / 2, canvas.height / 2 - 28);

        this._previewBall = this._previewBall || this._ensurePreviewBall(oldFighter);
        this._previewSim = new PreviewReselectSimulation({
            oldFighter,
            newFighter,
            center,
            canvasWidth: canvas.width
        });

        return true;
    }

    _bindPreviewReselectInput() {
        const canvas = this.elements?.canvas;
        if (!canvas) return;

        const handler = (event) => {
            if (this._previewSim) {
                this._queuedPreviewReselect = true;
                return;
            }
            if (!this.canReselectPreviewCharacter()) return;

            const rect = canvas.getBoundingClientRect?.();
            if (!rect) return;
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;

            const ball = this._previewBall;
            if (!ball) return;

            const dx = x - ball.position.x;
            const dy = y - ball.position.y;
            const dist = Math.hypot(dx, dy);
            const hitRadius = ball.radius * 2.5;
            if (dist <= hitRadius) {
                this.reselectPreviewCharacterFromPreview();
            }
        };

        canvas.addEventListener("pointerdown", handler);
    }

    _updatePreviewSwap(dt) {
        const sim = this._previewSim;
        if (!sim) return;

        sim.update(dt);

        if (sim.finished) {
            this.playerFighterId = sim.pendingId;
            this.playerStatAllocation = createEmptyStatAllocation();
            migrateLegacyExperienceToCharacter(this.playerProfile, this.playerFighterId);

            this._previewBall = sim.incoming;
            // PreviewReselectSimulation에서 ability 바인딩 누락 보정
            if (!this._previewBall.ability) {
                const incomingAbilityClass = Ability.MAP[sim.pendingFighter.ability];
                if (incomingAbilityClass) {
                    this._previewBall.bindAbility(new incomingAbilityClass(this._previewBall, {}));
                }
            }
            this._selectionAnimTime = 0;
            this._previewSim = null;

            this._refreshCollectionHub();
            this.refreshPlayerSetup();

            if (this._queuedPreviewReselect) {
                this._queuedPreviewReselect = false;
                if (this.canReselectPreviewCharacter()) {
                    this.reselectPreviewCharacterFromPreview();
                }
            }
        }
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

    _getPlayerEquipmentSummary(characterId = this.playerFighterId) {
        const equipment = this.playerProfile?.equipment ?? {};
        const inventory = equipment.inventory ?? [];
        const equipped = equipment.equipped ?? {};
        const slotLabels = {
            weapon: "무기",
            armor: "방어구",
            accessory1: "장신구1",
            accessory2: "장신구2"
        };
        const slots = Object.entries(slotLabels).map(([slotId, label]) => {
            const item = inventory.find((candidate) => candidate.instanceId === equipped[slotId]) ?? null;
            if (!item) {
                return {
                    id: slotId,
                    label,
                    empty: true,
                    name: "비어 있음",
                    rarity: "",
                    locked: false,
                    requiredLevel: 1
                };
            }
            const requiredLevel = getEquipmentRequiredLevel(item);
            const locked = !canCharacterEquipItem(this.playerProfile, item, characterId);
            return {
                id: slotId,
                label,
                empty: false,
                name: item.name,
                rarity: item.rarity,
                locked,
                requiredLevel
            };
        });
        const activeBonuses = getEquippedStatBonuses(this.playerProfile, characterId);
        const statParts = [
            ["hp", "HP"],
            ["damage", "공격"],
            ["defense", "방어"],
            ["speed", "속도"]
        ]
            .filter(([key]) => activeBonuses[key] > 0)
            .map(([key, label]) => `${label} +${activeBonuses[key]}`);

        return {
            characterLevel: getCharacterEquipmentLevel(this.playerProfile, characterId),
            inventoryUsed: getInventoryUsed(this.playerProfile),
            inventorySlots: getInventorySlots(this.playerProfile),
            equippedCount: slots.filter((slot) => !slot.empty).length,
            activeCount: slots.filter((slot) => !slot.empty && !slot.locked).length,
            slots,
            statLine: statParts.length > 0 ? statParts.join(" · ") : "적용 중인 장비 스탯 없음"
        };
    }

    _syncPlayerStatAllocationFromUi() {
        const alloc = this._panel.allocation;
        if (alloc === null || typeof alloc !== "object" || Array.isArray(alloc)) {
            throw new Error(
                `[BattleApp] playerPanel.allocation(${typeof alloc})이(가) 유효하지 않습니다. playerPanel 컴포넌트는 반드시 객체 형태의 allocation을 초기 상태로 제공해야 합니다.`
            );
        }
        this.playerStatAllocation = {
            ...createEmptyStatAllocation(),
            ...alloc
        };
    }

    _updatePlayerPanelSummary() {
        const m = formatStatAllocation(this._panel.allocation);
        const vals = [
            this._panel.allocation.hp ?? 0,
            this._panel.allocation.damage ?? 0,
            this._panel.allocation.speed ?? 0,
            this._panel.allocation.skill ?? 0,
            this._panel.allocation.defense ?? 0
        ];
        const mult = calculateStatMultiplier(vals).multiplier;
        this._panel.allocationSummary = m + "  \u00D7" + mult.toFixed(3);
    }

    _syncStartButton() {
        if (!this.lifecycle.isSetup) return;
        const remaining = this._panel.remainingPoints ?? 0;
        this._startBtn.remainingPoints = remaining;
        this._startBtn.setState({
            disabled: remaining > 0,
            text: undefined,
            hidden: false
        });
        this._startBtn.gameMode = this._gameMode;
    }

    adjustStat(key, delta) {
        if (this._panel.locked) return;
        this._panel.allocation = {
            ...adjustStatAllocation(this._panel.allocation, key, delta, this._panel.totalPoints)
        };
        this._panel.remainingPoints = getRemainingStatPoints(this._panel.allocation, this._panel.totalPoints);
        this._updatePlayerPanelSummary();
        this._syncStartButton();
        this._syncPlayerStatAllocationFromUi();
    }

    randomAllocation() {
        if (this._panel.locked) return;
        this._panel.allocation = { ...createRandomStatAllocation(undefined, this._panel.totalPoints) };
        this._panel.remainingPoints = getRemainingStatPoints(this._panel.allocation, this._panel.totalPoints);
        this._updatePlayerPanelSummary();
        this._syncStartButton();
        this._syncPlayerStatAllocationFromUi();
    }

    resetAllocation() {
        if (this._panel.locked) return;
        this._panel.allocation = { ...createEmptyStatAllocation() };
        this._panel.remainingPoints = getRemainingStatPoints(this._panel.allocation, this._panel.totalPoints);
        this._updatePlayerPanelSummary();
        this._syncStartButton();
        this._syncPlayerStatAllocationFromUi();
    }

    refreshPlayerSetup() {
        const remaining = getRemainingStatPoints(this.playerStatAllocation);
        const player = this.roster.find((fighter) => fighter.id === this.playerFighterId);
        const experienceSummary = getCharacterExperienceSummary(this.playerProfile, this.playerFighterId);
        const equipmentSummary = this._getPlayerEquipmentSummary(this.playerFighterId);
        this._panel.fighter = player ? { name: player.name, title: player.title, color: player.color } : null;
        this._panel.allocation = { ...this.playerStatAllocation };
        this._panel.totalPoints = PLAYER_STAT_POINTS;
        this._panel.remainingPoints = remaining;
        const setupLocked = this.lifecycle.isSetupInteractionLocked;
        this._panel.locked = setupLocked;
        this._panel.statDefs = ALLOCATABLE_STATS.map((s) => ({
            key: s.key,
            label: s.label,
            description: s.description
        }));
        this._panel.experience = { ...experienceSummary };
        this._panel.equipmentSummary = { ...equipmentSummary };
        this._updatePlayerPanelSummary();
        this._drawPlayerFace(player);

        // 모드 세그먼트 동기화
        const canHunt = getEligibleHuntingCharacters(this.playerProfile, this.roster).length > 0;
        this._modeSegment.visible = !setupLocked;
        this._modeSegment.mode = this._gameMode;
        this._modeSegment.canHunt = canHunt;
        this._modeSegment.locked = setupLocked;
        this._startBtn.setState({ hidden: this.lifecycle.isGameplayActive });

        if (this.lifecycle.isSetup) {
            this._syncStartButton();
            this.startPlayerPreviewLoop();
        }
    }

    _drawPlayerFace(fighter) {
        if (!fighter) return;
        const canvas = document.getElementById("playerFaceCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const size = 50;
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = fighter.color;
        ctx.fillRect(0, 0, size, size);
        const fakeBall = { radius: size / 2 - 2, position: { x: size / 2, y: size / 2 } };
        const AbilityClass = Ability.MAP[fighter.ability];
        if (AbilityClass) {
            const fakeOwner = {
                color: fighter.color,
                position: { x: size / 2, y: size / 2 },
                radius: size / 2 - 2,
                velocity: { x: 0, y: 0 }
            };
            const ability = new AbilityClass(fakeOwner, {});
            ctx.save();
            ctx.strokeStyle = "#202020";
            ctx.fillStyle = "#202020";
            ctx.lineWidth = Math.max(3, fakeBall.radius * 0.075);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.translate(size / 2, size / 2);
            ability.drawFace(ctx, 0, fakeBall);
            ctx.restore();
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 2;
        ctx.stroke();
        canvas.classList.remove("face-pop");
        void canvas.offsetWidth;
        canvas.classList.add("face-pop");
    }

    _updateStatus(text, badge) {
        this._root.statusText = text;
        this._root.statusBadge = badge;
    }

    _renderRoster(activeIds = [], activeSpecs = []) {
        const activeSpecById = new Map(activeSpecs.map((f) => [f.id, f]));
        const visibleRoster = activeIds.length
            ? activeIds
                  .map((id) => activeSpecById.get(id) ?? this.tournamentRoster.find((f) => f.id === id))
                  .filter(Boolean)
                  .filter((f) => !f.hunting?.isMob)
            : [];
        this._strip.fighters = visibleRoster.map((fighter) => {
            const isHero = fighter.id === FIGHTER_IDS.HERO;
            const maxHp = fighter.maxHp ?? fighter.stats?.hp ?? 0;
            const hp = fighter.hp ?? maxHp;
            return {
                id: fighter.id,
                name: fighter.name,
                title: fighter.title,
                color: fighter.color,
                isPlayer: fighter.isPlayer,
                defeated: false,
                hp: Math.ceil(hp),
                maxHp: Math.ceil(maxHp),
                hpPct: 100,
                statLine: isHero
                    ? formatHeroStatLine(fighter.stats.allocation ?? {})
                    : formatStatAllocation(fighter.stats.allocation ?? {}),
                heroStatParts: isHero ? formatHeroStatParts(fighter.stats.allocation ?? {}) : [],
                isHero,
                balanceMult: 1,
                skillLabel: "Skill",
                skillPct: 1,
                skillText: "Ready",
                actionName: null
            };
        });
    }

    _updateLiveCards(fighters) {
        this._strip.fighters = (this._strip.fighters || []).map((card) => {
            const fighter = fighters.find((f) => f.id === card.id || f.name === card.name);
            if (!fighter) return card;
            const alloc = fighter.stats.allocation ?? {};
            const isHero = fighter.id === FIGHTER_IDS.HERO;
            const pts = [alloc.hp ?? 0, alloc.damage ?? 0, alloc.speed ?? 0, alloc.skill ?? 0, alloc.defense ?? 0];
            const mult = calculateStatMultiplier(pts).multiplier;
            const bonuses = mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {});
            const uiState = fighter.getAbilityUiState();
            return {
                ...card,
                hp: Math.ceil(fighter.hp),
                maxHp: Math.ceil(fighter.maxHp),
                hpPct: Math.max(0, (fighter.hp / fighter.maxHp) * 100),
                defeated: fighter.flags.defeated,
                balanceMult: mult,
                mergedBonuses: bonuses,
                statLine: isHero
                    ? formatHeroStatLine(fighter.stats.allocation ?? {}, bonuses)
                    : formatStatAllocation(fighter.stats.allocation ?? {}),
                heroStatParts: isHero ? formatHeroStatParts(fighter.stats.allocation ?? {}, bonuses) : [],
                skillLabel: uiState.label,
                skillPct: Math.max(0, Math.min(1, uiState.progress)),
                skillText: uiState.progress >= 0.995 ? "Ready" : `${Math.round(uiState.progress * 100)}%`,
                actionName: fighter.clickActionName ?? null
            };
        });
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
        const AbilityClass = Ability.MAP[fighter.ability];
        if (AbilityClass) ball.bindAbility(new AbilityClass(ball, {}));
        this._previewBall = ball;
        this._selectionAnimTime = 0;
        return ball;
    }

    renderPlayerPreview() {
        if (this.tournament && !this.tournament.champion) {
            return;
        }

        if (this._previewSim) {
            this.renderer.renderPlayerPreviewSwap(this._previewSim, this._previewSim.pendingFighter);
            return;
        }

        // 사냥터 모드: 우승 캐릭터만 표시
        if (this._gameMode === "hunting") {
            const eligible = getEligibleHuntingCharacters(this.playerProfile, this.roster);
            if (eligible.length === 0) {
                this.renderer.clear();
                return;
            }
            // 현재 선택된 캐릭터가 eligible 목록에 없으면 첫 번째로 변경
            const inEligible = eligible.find((c) => c.id === this.playerFighterId);
            if (!inEligible) {
                this.playerFighterId = eligible[0].id;
                this.playerStatAllocation = createEmptyStatAllocation();
                this._previewBall = null;
                this.refreshPlayerSetup();
                return;
            }
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

            this._updatePreviewSwap(dt);
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
        if (this.lifecycle.isAwaitingResultConfirmation) {
            this.returnToInitialState();
            return;
        }
        if (!this.lifecycle.isSetup) return;
        // Sync allocation from Alpine (user may have clicked +/- buttons there)
        this._syncPlayerStatAllocationFromUi();

        const baseRemaining = getRemainingStatPoints(this.playerStatAllocation);
        if (baseRemaining > 0) {
            this._overlay.show({ label: "스탯 배분 필요", text: `${baseRemaining} 포인트 남음` });
            this._log.add(`토너먼트 시작 전 스탯 ${baseRemaining} 포인트를 더 배분해야 합니다.`);
            this.refreshPlayerSetup();
            return;
        }

        this.audio.unlock();
        this.beginGameSession();
        cancelAnimationFrame(this.rafId);
        this.stopPlayerPreviewLoop();
        this._log.reset();
        this._startBtn.setState({ disabled: true, hidden: true, text: "다시 시작" });
        // 연계 효과 계산: 해금된 ID 중 현재 캐릭터가 아닌 효과만 적용
        const masteryCtx = collectActiveEffects(this.playerProfile, this.playerFighterId);
        const adjustedAllocation = { ...this.playerStatAllocation };
        this._experienceProgressionByFighter = new Map([
            [this.playerFighterId, collectActiveExperienceProgression(this.playerProfile, this.playerFighterId)]
        ]);
        const rosterWithExperienceProgression = this.roster.map((fighter) =>
            applyExperienceProgressionToBaseSpec(fighter, this._experienceProgressionByFighter.get(fighter.id))
        );

        this.tournamentRoster = createTournamentRoster(
            rosterWithExperienceProgression,
            this.playerFighterId,
            adjustedAllocation,
            undefined,
            undefined
        );
        // 장비 고정 수치를 더한 뒤 숙련도 퍼센트 보정을 마지막으로 적용한다.
        const playerSpec = this.tournamentRoster.find((f) => f.id === this.playerFighterId);
        if (playerSpec) {
            const equippedSpec = applyEquipmentStats(playerSpec, this.playerProfile);
            const masteredSpec = applyMasteryEffectsToFighterSpec(equippedSpec, masteryCtx);
            Object.assign(playerSpec, masteredSpec);
        }
        this.matchmaker = new Matchmaker(this.tournamentRoster);
        this.playerResult = null;
        this.tournament = new TournamentManager(this.tournamentRoster, this.playerFighterId);
        this._root.tournamentActive = true;
        this.currentTournamentMatch = null;
        this._action.selectedId = null;
        this.refreshPlayerSetup();
        this._bracket.render(this.tournament);
        const player = this.tournamentRoster.find((fighter) => fighter.id === this.playerFighterId);
        this._log.add(`내 캐릭터는 ${player.name}. 배분한 스탯으로 토너먼트에 참가합니다.`);
        this._log.add("다른 캐릭터들도 같은 포인트를 랜덤으로 받은 뒤 대진표가 확정되었습니다.");
        await this.runNextTournamentMatch();
    }

    async runNextTournamentMatch() {
        if (!this.lifecycle.isGameplayActive || !this.tournament) {
            return;
        }

        const nextMatch = this.tournament.nextMatch();
        if (!nextMatch) {
            this.showTournamentChampion();
            return;
        }

        this.currentTournamentMatch = nextMatch;
        this.tournament.markActive(nextMatch);
        this._bracket.render(this.tournament);
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
            this._log.add(`[액션] ${this._action.current.name} 준비 완료.`);
            playerBall.clickActionName = this._action.current.name;
        }
        return this._action.current;
    }

    async startMatch(customMatch = null, options = {}) {
        const lifecycleRevision = this.lifecycle.revision;
        this.audio.unlock();
        this._startBtn.setState({ disabled: true, hidden: true });
        this._speed.level = 1;
        this._speed.indicatorTimer = 0;
        this._speed.indicatorText = "";
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        this._lastMatchXpResult = null;
        this._action.skipPick = options.skipActionPick ?? false;
        if (!options.keepLog) {
            this._log.reset();
        }

        const match = customMatch ?? this.matchmaker.pick();
        const label = `${match[0].name} vs ${match[1].name}`;
        this._renderRoster(
            match.map((fighter) => fighter.id),
            match
        );
        this._updateStatus(label, "Drawing");
        this._overlay.show({ label: "Matchup", text: label });
        this._log.add(`대진 확정: ${label}`);
        this._log.add(`아레나가 ${match[0].title}와 ${match[1].title}의 능력을 감지했습니다.`);

        // 시뮬레이션 생성 (playerBall은 아직 null)
        this._currentMatchReport = createMatchReport();
        const experienceProgressionByFighter =
            options.experienceProgressionByFighter ??
            this._experienceProgressionByFighter ??
            new Map([
                [this.playerFighterId, collectActiveExperienceProgression(this.playerProfile, this.playerFighterId)]
            ]);
        this.simulation = new BattleSimulation(
            match,
            {
                assignActions:
                    this.debug.aiEnabled || getCharacterChallengeLevel(this.playerProfile, this.playerFighterId) > 0,
                onLog: (message) => this._log.add(message),
                onOvertime: () => {
                    this._updateStatus(label, "Overtime");
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
                },
                onBattleBallReady: (ball) => {
                    applyExperienceProgressionToBall(ball, experienceProgressionByFighter.get(ball.id));
                }
            },
            null,
            {
                arenaWidth: options.arenaWidth,
                arenaHeight: options.arenaHeight,
                cameraZoom: options.cameraZoom,
                arenaTheme: options.arenaTheme ?? null,
                terrain: options.terrain ?? []
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
                if (!this.lifecycle.isCurrentRevision(lifecycleRevision)) return;
            }
        }

        if (this._currentMatchReport) {
            this._currentMatchReport.playerFighterId = this.playerFighterId;
            this._currentMatchReport.tournamentRoundIndex = this.currentTournamentMatch?.roundIndex ?? -1;
        }

        // 클릭 액션 — 내 캐릭터가 있으면 카드 선택
        this._action.current = null;
        if (playerBall) {
            await this._resolveAction(playerBall);
            if (!this.lifecycle.isCurrentRevision(lifecycleRevision)) return;
        }

        // 클릭 핸들러 바인딩
        this._bindClickHandler();

        this.renderer.render(this.simulation);
        await this.wait(1350);
        if (!this.lifecycle.isCurrentRevision(lifecycleRevision)) return;

        this._overlay.hide();
        this._updateStatus(label, "Fight");
        this.audio.play("start");
        this._log.add("전투가 자동으로 시작됩니다.");
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
        const effectivePct = Math.max(0, action.hpCostPercent - reduction * 100);
        const cost = Math.ceil((player.maxHp * effectivePct) / 100);
        const paidCost = player.actionContext.spendHpForAction(player, cost);
        if (cost > 0 && paidCost <= 0) {
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
            previousLevelLabel: result.previousLevelLabel ?? `Lv.${result.previousLevel ?? 1}`,
            level: result.level,
            levelLabel: result.levelLabel ?? `Lv.${result.level}`,
            levelUp: result.levelUp,
            progressBeforePct: result.progressBeforePct ?? 0,
            progressAfterPct: result.progressAfterPct ?? 0,
            previousProgressText: result.previousProgressText ?? "",
            previousNextText: result.previousNextText ?? "",
            previousNextRewardText: result.previousNextRewardText ?? "",
            progressText: result.progressText ?? "",
            nextText: result.nextText ?? "",
            earnedRewardText: (result.earnedRewards ?? []).map((reward) => reward.text).join(" · "),
            nextRewardText: result.nextRewardText ?? ""
        };
    }

    _grantExperienceFromMatchReport(report) {
        const result = grantExperienceFromMatchReport(this.playerProfile, report);
        this._lastXpResult = result;
        this._lastMatchXpResult = result;

        if (result.xpGained > 0) {
            this._log.add(`[경험치] ${this._formatXpResult(result)}`);
            if (result.levelUp) {
                this._toast.show(`레벨업! Lv.${result.level}`);
            }
            savePlayerProfile(this.playerProfile);
            this._refreshCollectionHub();
            this.refreshPlayerSetup();
        }

        return result;
    }

    showTransientOverlay(label, text, duration = 1200) {
        const token = String(++this.transientOverlayToken);
        this._overlay.showTransient(label, text);
        window.setTimeout(() => {
            if (!this.simulation?.finished) {
                this._overlay.hide();
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
        this._updateLiveCards(this.simulation.fighters);

        if (this.simulation.finished) {
            if (!this.resultSequenceAnnounced) {
                this.resultSequenceAnnounced = true;
                const loser = this.simulation.loser;
                this._updateStatus(loser ? `${loser.name} is down` : "Final impact", "KO");
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

            // Hero Ball 승리 시 carryover — BattleBall 인스턴스 메서드로 위임
            if (winnerSpec.ability === "hero" && this.simulation.winner) {
                this.simulation.winner.mergeHeroOrbCarryoverInto(winnerSpec);
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
            this._bracket.render(this.tournament);
            this._overlay.show({
                label: playerLost ? "아쉽네요" : this.tournament.champion ? "Champion" : "Advances",
                text: playerLost ? `${this.playerResult.fighterName} ${this.playerResult.rankLabel}` : winner.name,
                subtext: xpReward ? "" : xpSubtext,
                xpReward
            });
            this._updateStatus(
                playerLost
                    ? `내 캐릭터는 ${this.playerResult.rankLabel}로 탈락`
                    : this.tournament.champion
                      ? `${winner.name} is champion`
                      : `${winner.name} advances`,
                "Result"
            );
            this._log.add(`${winner.name} defeats ${loser.name}.`);
            if (playerLost) {
                this._log.add(
                    `아쉽네요. 내 캐릭터 ${this.playerResult.fighterName}는 ${this.playerResult.rankLabel}입니다.`
                );
            }
            this.currentTournamentMatch = null;

            if (playerLost) {
                this.showTournamentElimination();
                return;
            }

            if (this.tournament.champion) {
                this.showTournamentChampion();
                return;
            }

            window.setTimeout(() => this.runNextTournamentMatch(), 1450);
            return;
        }

        this._overlay.show({ label: "Winner", text: winner.name, subtext: xpReward ? "" : xpSubtext, xpReward });
        this._updateStatus(`${winner.name} wins`, "Result");
        this._log.add(`${winner.name} defeats ${loser.name}.`);
        this._log.add("Press the button again for another random matchup.");
        this.refreshPlayerSetup();
        this._startBtn.setState({ text: "다시 시작", hidden: false, disabled: false });
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

    showTournamentChampion() {
        const champion = this.tournament?.champion;
        if (!champion) return;
        const playerWon = champion.id === this.playerFighterId;
        this._finalizeTournamentResult({ playerWon, champion });
    }

    showTournamentElimination() {
        this._finalizeTournamentResult({ playerWon: false });
    }

    _finalizeTournamentResult({ playerWon, champion = null }) {
        const player = this.tournamentRoster.find((fighter) => fighter.id === this.playerFighterId);
        if (playerWon && champion) this.playerResult = { rankLabel: "1위", fighterName: champion.name };

        this._settleTournamentProgression(playerWon);
        this._matchReports = [];
        this._currentTournamentReport = null;
        this._root.tournamentActive = false;
        this.beginResultConfirmation();
        this._refreshCollectionHub();
        this._presentTournamentResult({ playerWon, champion, player });
    }

    _settleTournamentProgression(playerWon) {
        if (!this._currentTournamentReport) return;

        this._currentTournamentReport.playerWon = playerWon;
        this._currentTournamentReport.placement = playerWon ? 1 : this.playerResultToPlacement();
        applyTournamentReport(this.playerProfile, this._currentTournamentReport);

        this._settleAchievements({
            profile: this.playerProfile,
            report: this._currentTournamentReport,
            roster: this.roster,
            playerFighterId: this.playerFighterId
        });

        const masteryResult = advanceCharacterMastery(this.playerProfile, {
            characterId: this.playerFighterId,
            challengeLevel: getCharacterChallengeLevel(this.playerProfile, this.playerFighterId),
            playerWon
        });
        if (masteryResult.changed) {
            const sourceName =
                this.roster.find((fighter) => fighter.id === this.playerFighterId)?.name ?? this.playerFighterId;
            this._toast.show(`[숙련도 승급] ${sourceName} ${masteryResult.previousTier} → ${masteryResult.newTier}`);
            this._log.add(`[숙련도 승급] ${sourceName} ${masteryResult.previousTier} → ${masteryResult.newTier}`);
        }
        savePlayerProfile(this.playerProfile);
        this._lastMasteryResult = masteryResult;
    }

    _settleHuntingAchievements(huntingRun) {
        return this._settleAchievements({
            profile: this.playerProfile,
            roster: this.roster,
            playerFighterId: this.playerFighterId,
            huntingRun
        });
    }

    _settleAchievements(context) {
        const achievementResults = evaluateAchievements(this.playerProfile, ACHIEVEMENT_DEFINITIONS, context);
        for (const result of achievementResults) {
            const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === result.id);
            if (!def) continue;

            grantAchievementReward(this.playerProfile, def);
            const rewardDesc = formatAchievementReward(def.reward);
            let msg = `[업적 해금] ${def.name} (${def.tier})`;
            if (rewardDesc) msg += ` — ${rewardDesc}`;
            this._log.add(msg);
            this._toast.show(msg);
        }
        return achievementResults;
    }

    _presentTournamentResult({ playerWon, champion, player }) {
        let masteryMsg = "";
        if (this._lastMasteryResult?.changed) {
            masteryMsg = ` ${this._lastMasteryResult.previousTier} → ${this._lastMasteryResult.newTier}`;
        }
        const xpMsg = this._formatXpResult(this._lastMatchXpResult);
        const xpReward = this._createXpRewardView(this._lastMatchXpResult);
        const playerResultText = `${player.name} ${this.playerResult?.rankLabel ?? "결과 확정"}`;

        this._bracket.render(this.tournament);
        this.refreshPlayerSetup();
        this._overlay.show({
            label: playerWon ? "축하합니다!" : champion ? "토너먼트 종료" : "아쉽네요",
            text: playerWon ? `${champion.name} 우승${masteryMsg}` : playerResultText,
            subtext: xpReward ? "" : xpMsg,
            xpReward
        });
        this._root.statusText = playerWon
            ? `내 캐릭터 ${champion.name} 우승${masteryMsg}`
            : `내 캐릭터 ${playerResultText}`;
        this._root.statusBadge = "Result";
        if (champion) this._log.add(`${champion.name} takes the whole bracket.`);
        this._log.add(
            playerWon
                ? `축하합니다! 내 캐릭터 ${champion.name}가 토너먼트에서 우승했습니다.${masteryMsg}`
                : `아쉽네요. 내 캐릭터 ${player.name}의 최종 성적은 ${this.playerResult?.rankLabel ?? "기록 없음"}입니다.`
        );
        this._startBtn.setState({ text: "확인", hidden: false, disabled: false });
    }

    wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    waitForHuntingMoveUiPaint() {
        const nextFrame = window.requestAnimationFrame ?? ((callback) => window.setTimeout(callback, 0));
        return new Promise((resolve) => nextFrame(() => nextFrame(resolve)));
    }
}
