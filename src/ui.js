import {
    ALLOCATABLE_STATS,
    PLAYER_STAT_POINTS,
    adjustStatAllocation,
    calculateStatMultiplier,
    createEmptyStatAllocation,
    createRandomStatAllocation,
    formatStatAllocation,
    getRemainingStatPoints
} from "./statAllocation.js";
import { DEFAULT_STAT_RULES, CHALLENGE_CONFIG } from "./progression/index.js";
import { formatHeroStatLine, formatHeroStatParts, mergeOrbBonuses } from "./entities/index.js";
import { FIGHTER_IDS, RENDER_LAYERS, Vector2 } from "./core.js";
import { appendCapped } from "./utils.js";

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
    PhantomAbility,
    HuntingMeleeAbility
} from "./abilities/index.js";
import { ArenaCamera } from "./camera.js";

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
    phantom: PhantomAbility,
    hunting_melee: HuntingMeleeAbility
};

function getAlpineStore(name) {
    try {
        const alpine = typeof globalThis.Alpine !== "undefined" ? globalThis.Alpine : null;
        return alpine ? alpine.store(name) : null;
    } catch {
        return null;
    }
}

function patchAlpineStore(name, patch) {
    const store = getAlpineStore(name);
    if (!store) return null;
    Object.assign(store, typeof patch === "function" ? patch(store) : patch);
    return store;
}

function setAlpineStore(name, value) {
    try {
        const alpine = typeof globalThis.Alpine !== "undefined" ? globalThis.Alpine : null;
        if (alpine) alpine.store(name, value);
    } catch {
        // no-op outside browser
    }
}

// ── Alpine.js x-data function ───────────────────────────────────────────────

export function appStore() {
    return {
        // Player setup
        playerFighter: null,
        playerExperience: {
            levelLabel: "Lv.1",
            totalXp: 0,
            progressPct: 0,
            progressText: "0/100 XP",
            nextText: "다음 레벨까지 100XP",
            nextRewardText: "HP +2"
        },
        allocation: createEmptyStatAllocation(),
        totalPoints: PLAYER_STAT_POINTS,
        bonusPoints: 0,
        remainingPoints: PLAYER_STAT_POINTS,
        locked: false,
        statDefs: ALLOCATABLE_STATS,

        // Status bar
        statusBadge: "Setup",
        statusText: "내 캐릭터 스탯을 배분하세요",
        statusSubtext: "랜덤 대진과 전투 결과가 여기에 갱신됩니다.",

        // Overlay (handled by <game-overlay> component via Alpine.store)
        xpReward: {
            visible: false,
            characterName: "",
            xpGained: 0,
            previousLevel: 1,
            level: 1,
            levelLabel: "Lv.1",
            levelUp: false,
            progressBeforePct: 0,
            progressAfterPct: 0,
            animatedProgressPct: 0,
            progressText: "",
            nextText: "",
            nextRewardText: ""
        },

        // Start button (handled by <start-button> component via Alpine.store)

        // Collection hub (thin wrapper for C button)
        openCollectionHub(tabId) {
            if (window.CollectionHubService) window.CollectionHubService.open(tabId);
        },

        // Hunting ground
        huntingActive: false,
        huntingAvailable: false,

        // Tournament
        tournamentActive: false,
        tournamentPhase: "Ready",
        tournamentRounds: [],
        showTip: false,

        allocationSummary: "체력 +0% · 공격 +0% · 속도 +0%",

        // Challenge level
        challengeLevel: 0,
        highestUnlockedLevel: 0,
        progressionBonusSummary: "",

        _syncStartButton() {
            patchAlpineStore("startButton", {
                disabledOverride: null,
                textOverride: null,
                remainingPoints: this.remainingPoints ?? 0,
                locked: Boolean(this.locked)
            });
        },

        adjustChallengeLevel(delta) {
            const next = this.challengeLevel + delta;
            if (next < 0 || next > this.highestUnlockedLevel) return;
            this.challengeLevel = next;
            this._syncStartButton();
            this._syncPlayerPanelChallenge();
        },

        _syncPlayerPanelChallenge() {
            patchAlpineStore("playerPanel", {
                challengeLevel: this.challengeLevel,
                highestUnlockedLevel: this.highestUnlockedLevel
            });
        },

        init() {
            this._syncSummary();
            this._syncStartButton();
            this._syncPlayerPanelChallenge();
        },

        // Actions
        adjustStat(key, delta) {
            if (this.locked) return;
            this.allocation = adjustStatAllocation(this.allocation, key, delta, this.totalPoints);
            this.remainingPoints = getRemainingStatPoints(this.allocation, this.totalPoints);
            this._syncStartButton();
            this._syncSummary();
            this._emitAllocationChanged();
        },

        randomAllocation() {
            if (this.locked) return;
            this.allocation = createRandomStatAllocation(undefined, this.totalPoints);
            this.remainingPoints = getRemainingStatPoints(this.allocation, this.totalPoints);
            this._syncStartButton();
            this._syncSummary();
            this._emitAllocationChanged();
        },

        resetAllocation() {
            if (this.locked) return;
            this.allocation = createEmptyStatAllocation();
            this.remainingPoints = getRemainingStatPoints(this.allocation, this.totalPoints);
            this._syncStartButton();
            this._syncSummary();
            this._emitAllocationChanged();
        },

        _syncSummary() {
            const m = formatStatAllocation(this.allocation);
            const vals = [
                this.allocation.hp ?? 0,
                this.allocation.damage ?? 0,
                this.allocation.speed ?? 0,
                this.allocation.skill ?? 0,
                this.allocation.defense ?? 0
            ];
            const mult = calculateStatMultiplier(vals).multiplier;
            this.allocationSummary = m + "  \u00D7" + mult.toFixed(3);
            patchAlpineStore("playerPanel", {
                allocation: { ...this.allocation },
                remainingPoints: this.remainingPoints,
                totalPoints: this.totalPoints,
                allocationSummary: this.allocationSummary
            });
        },

        _emitAllocationChanged() {
            try {
                document.dispatchEvent(new Event("allocation-changed"));
            } catch {
                // no-op outside browser tests
            }
        }
    };
}

// ── Canvas renderer (unchanged) ─────────────────────────────────────────────

export class ArenaRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.camera = new ArenaCamera();
    }

    renderPlayerPreview(previewBall, fighter, selectionAnimTime = 999) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!previewBall || !fighter) return;

        const cx = this.canvas.width / 2;
        const cy = previewBall.position.y;
        const progress = Math.min(selectionAnimTime / 0.5, 1);
        const scale = progress < 1 ? 1 - Math.exp(-5.5 * progress) * Math.cos(11 * progress) : 1;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // selection ring
        if (progress < 1) {
            const ringR = previewBall.radius * 1.5 + (1 - progress) * 30;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = fighter.color;
            ctx.lineWidth = 3 * (1 - progress) + 1;
            ctx.globalAlpha = 0.5 * (1 - progress);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        previewBall.draw(ctx);
        ctx.restore();

        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#202020";
        ctx.font = "900 28px Bahnschrift, Segoe UI, sans-serif";
        ctx.fillText("내 캐릭터", cx, previewBall.position.y + previewBall.radius + 48);
        ctx.font = "700 22px Bahnschrift, Segoe UI, sans-serif";
        ctx.fillStyle = fighter.color;
        ctx.fillText(fighter.name, cx, previewBall.position.y + previewBall.radius + 82);
        ctx.restore();
    }

    render(simulation) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        const shake = simulation.screenShake;
        if (shake) {
            const progress = shake.remaining / shake.duration;
            const strength = shake.strength * progress;
            ctx.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
        }

        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const view = this.camera.getViewTransform(this.canvas, simulation);
        this.camera.apply(ctx, this.canvas, simulation);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, simulation.width, simulation.height);
        ctx.strokeStyle = "#d7dce6";
        ctx.lineWidth = Math.max(2, 2 / view.scale);
        ctx.strokeRect(0, 0, simulation.width, simulation.height);

        for (const pass of ArenaRenderer.renderPasses) {
            for (const e of simulation.entities) {
                if (e.renderLayer === pass.layer) e.draw(ctx, simulation);
            }
        }

        ctx.restore();
    }

    /** Ordered render passes — add/remove/reorder entries to change draw priority. */
    static renderPasses = [
        { layer: RENDER_LAYERS.BACKGROUND },
        { layer: RENDER_LAYERS.FIGHTER },
        { layer: RENDER_LAYERS.FOREGROUND }
    ];
}

// ── UIController — updates Alpine component data ────────────────────────────

export class UIController {
    constructor(roster) {
        this.roster = roster;
        this._rootData = null;
        this.logItems = [];
        this._overlayTransient = false;
        this._transientToken = "";
    }

    get overlayTransient() {
        return this._overlayTransient;
    }

    get transientToken() {
        return this._transientToken;
    }

    get state() {
        try {
            const alpine = typeof globalThis.Alpine !== "undefined" ? globalThis.Alpine : null;
            if (!this._rootData && alpine) {
                const root = document.querySelector(".app");
                this._rootData = root ? alpine.$data(root) : null;
            }
        } catch {
            return null;
        }
        return this._rootData;
    }

    _update(fn) {
        const s = this.state;
        if (s) fn(s);
    }

    renderPlayerSetup({
        fighter,
        stats,
        allocation,
        totalPoints,
        bonusPoints = 0,
        remainingPoints,
        locked = false,
        challengeLevel = 0,
        highestUnlockedLevel = 0,
        progressionBonusSummary = "",
        experience = null,
        huntingAvailable = false
    } = {}) {
        const s = this.state;
        if (!s) return;
        s.allocation = { ...allocation };
        s.totalPoints = totalPoints;
        s.bonusPoints = bonusPoints;
        s.remainingPoints = remainingPoints;
        s.locked = locked;
        s.challengeLevel = challengeLevel;
        s.highestUnlockedLevel = highestUnlockedLevel;
        s.progressionBonusSummary = progressionBonusSummary;
        s.huntingAvailable = Boolean(huntingAvailable);
        if (experience) {
            s.playerExperience = { ...experience };
        }
        this._syncHuntingButtonStore();
        s._syncSummary?.();
        patchAlpineStore("playerPanel", {
            fighter: fighter ? { name: fighter.name, title: fighter.title, color: fighter.color } : null,
            ...(experience ? { experience: { ...experience } } : {}),
            allocation: { ...allocation },
            totalPoints,
            bonusPoints,
            remainingPoints,
            locked: Boolean(locked),
            challengeLevel,
            highestUnlockedLevel,
            progressionBonusSummary,
            ...(stats && Array.isArray(stats)
                ? { statDefs: stats.map((s) => ({ key: s.key, label: s.label, description: s.description })) }
                : {})
        });
        patchAlpineStore("startButton", {
            disabledOverride: null,
            textOverride: null,
            remainingPoints: remainingPoints ?? 0,
            locked: Boolean(locked)
        });
        this._drawPlayerFace(fighter);
    }

    /** 플레이어 패널에 캐릭터 얼굴 그리기 */
    _drawPlayerFace(fighter) {
        if (!fighter) return;
        const canvas = document.getElementById("playerFaceCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const size = 50;

        // 배경 원
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = fighter.color;
        ctx.fillRect(0, 0, size, size);

        // ability drawFace 재사용을 위한 fake ball
        const fakeBall = { radius: size / 2 - 2, position: { x: size / 2, y: size / 2 } };

        const AbilityClass = ABILITY_MAP[fighter.ability];
        if (AbilityClass) {
            const fakeOwner = {
                color: fighter.color,
                position: new Vector2(size / 2, size / 2),
                radius: size / 2 - 2,
                velocity: new Vector2()
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

        // 테두리
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 2;
        ctx.stroke();

        // face pop animation restart
        canvas.classList.remove("face-pop");
        void canvas.offsetWidth; // force reflow
        canvas.classList.add("face-pop");
    }

    renderRoster(activeIds = [], activeSpecs = []) {
        const activeSpecById = new Map(activeSpecs.map((fighter) => [fighter.id, fighter]));
        const visibleRoster = activeIds.length
            ? activeIds
                  .map((id) => activeSpecById.get(id) ?? this.roster.find((fighter) => fighter.id === id))
                  .filter(Boolean)
            : [];
        const fighters = visibleRoster.map((fighter) => {
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
        patchAlpineStore("fighterStrip", { fighters });
    }

    updateStatus() {}

    _setGameOverlay(data) {
        patchAlpineStore("gameOverlay", data);
    }

    setHuntingActive(active) {
        const s = this.state;
        if (s) s.huntingActive = Boolean(active);
        this._syncHuntingButtonStore();
    }

    setHuntingOverlayState(data) {
        patchAlpineStore("gameOverlay", data);
    }

    showOverlay(label, text, subtext = "", xpReward = null) {
        this._overlayTransient = false;
        this._setGameOverlay({
            visible: true,
            transient: false,
            label,
            text,
            subtext
        });
        this._showXpReward(xpReward);
    }

    _setXpReward(data) {
        setAlpineStore("xpReward", data);
    }

    _resetXpReward() {
        this._setXpReward({ visible: false });
    }

    _showXpReward(reward) {
        if (!reward) {
            this._resetXpReward();
            return;
        }

        const startPct = Math.max(0, Math.min(100, reward.progressBeforePct ?? 0));
        const endPct = Math.max(0, Math.min(100, reward.progressAfterPct ?? 0));

        this._setXpReward({
            visible: true,
            characterName: reward.characterName ?? "",
            xpGained: reward.xpGained ?? 0,
            levelLabel: reward.levelUp ? `Lv.${reward.previousLevel ?? reward.level ?? 1}` : (reward.levelLabel ?? ""),
            levelUp: Boolean(reward.levelUp),
            progressBeforePct: startPct,
            progressAfterPct: endPct,
            progressText: reward.progressText ?? "",
            nextText: reward.nextText ?? "",
            nextRewardText: reward.nextRewardText ?? "",
            nextLevelLabel: reward.levelLabel ?? `Lv.${reward.level ?? 1}`,
            level: reward.level ?? 1
        });
    }

    showToast(message, duration = 3500) {
        setAlpineStore("toast", { message, duration });
    }

    showTransientOverlay(label, text, token) {
        this._overlayTransient = true;
        this._transientToken = token;
        this._setGameOverlay({
            visible: true,
            transient: true,
            label,
            text,
            subtext: ""
        });
        this._resetXpReward();
    }

    hideOverlay() {
        this._overlayTransient = false;
        this._transientToken = "";
        this._setGameOverlay({
            visible: false,
            transient: false,
            label: "",
            text: "",
            subtext: "",
            huntingChoiceVisible: false
        });
        this._resetXpReward();
    }

    setStartButton({ disabled, text, hidden }) {
        patchAlpineStore("startButton", {
            ...(hidden !== undefined ? { hidden: Boolean(hidden) } : {}),
            disabledOverride: disabled !== undefined ? disabled : null,
            textOverride: text !== undefined ? text : null
        });
    }

    resetLog() {
        this.logItems = [];
        this.renderLog();
    }

    addLog(text) {
        appendCapped(this.logItems, text, 9);
        this.renderLog();
    }

    renderLog() {
        patchAlpineStore("battleLog", { items: [...this.logItems] });
    }

    _syncHuntingButtonStore() {
        const s = this.state;
        if (!s) return;
        patchAlpineStore("huntingButton", {
            available: Boolean(s.huntingAvailable),
            active: Boolean(s.huntingActive),
            tournamentActive: Boolean(s.tournamentActive)
        });
    }

    renderTournament(tournament = null) {
        const s = this.state;
        if (!s) return;

        if (!tournament) {
            s.tournamentActive = false;
            this._syncHuntingButtonStore();
            patchAlpineStore("tournamentBracket", {
                visible: false,
                phase: "Ready",
                rounds: []
            });
            return;
        }

        s.tournamentActive = true;
        this._syncHuntingButtonStore();
        const rounds = tournament.rounds.map((round, roundIndex) =>
            round.map((match) => ({
                id: match.id,
                status: match.status,
                winnerId: match.winner?.id ?? null,
                label: match.winner
                    ? "WIN"
                    : match.status === "active"
                      ? "LIVE"
                      : match.status === "bye"
                        ? "BYE"
                        : "WAIT",
                a: match.a
                    ? {
                          id: match.a.id,
                          name: match.a.name,
                          color: match.a.color,
                          isPlayer: match.a.isPlayer
                      }
                    : null,
                b: match.b
                    ? {
                          id: match.b.id,
                          name: match.b.name,
                          color: match.b.color,
                          isPlayer: match.b.isPlayer
                      }
                    : null
            }))
        );
        patchAlpineStore("tournamentBracket", {
            visible: true,
            phase: tournament.champion ? "Champion" : "Running",
            rounds
        });
    }

    updateLiveCards(fighters) {
        patchAlpineStore("fighterStrip", (store) => {
            const current = store.fighters || [];
            return {
                fighters: current.map((card) => {
                    const fighter = fighters.find((f) => f.id === card.id || f.name === card.name);
                    if (!fighter) return card;
                    const alloc = fighter.stats.allocation ?? {};
                    const isHero = fighter.id === FIGHTER_IDS.HERO;
                    const pts = [
                        alloc.hp ?? 0,
                        alloc.damage ?? 0,
                        alloc.speed ?? 0,
                        alloc.skill ?? 0,
                        alloc.defense ?? 0
                    ];
                    const mult = calculateStatMultiplier(pts).multiplier;
                    return {
                        ...card,
                        hp: Math.ceil(fighter.hp),
                        maxHp: Math.ceil(fighter.maxHp),
                        hpPct: Math.max(0, (fighter.hp / fighter.maxHp) * 100),
                        defeated: fighter.flags.defeated,
                        balanceMult: mult,
                        isHero,
                        mergedBonuses: mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {}),
                        statLine: isHero
                            ? formatHeroStatLine(
                                  fighter.stats.allocation ?? {},
                                  mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {})
                              )
                            : formatStatAllocation(fighter.stats.allocation ?? {}),
                        heroStatParts: isHero
                            ? formatHeroStatParts(
                                  fighter.stats.allocation ?? {},
                                  mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {})
                              )
                            : [],
                        skillLabel: fighter.getAbilityUiState().label,
                        skillPct: Math.max(0, Math.min(1, fighter.getAbilityUiState().progress)),
                        skillText:
                            fighter.getAbilityUiState().progress >= 0.995
                                ? "Ready"
                                : `${Math.round(fighter.getAbilityUiState().progress * 100)}%`,
                        actionName: fighter.clickActionName ?? null
                    };
                })
            };
        });
    }
}
