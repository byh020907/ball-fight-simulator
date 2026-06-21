import {
    ALLOCATABLE_STATS,
    PLAYER_STAT_POINTS,
    adjustStatAllocation,
    calculateStatMultiplier,
    createEmptyStatAllocation,
    createRandomStatAllocation,
    formatStatAllocation,
    getRemainingStatPoints
} from "./stat-allocation.js";
import { RENDER_LAYERS, Vector2 } from "./core.js";
import { BattleBall } from "./entities.js";
import { getUnseenEntries, dismissPatchNotes } from "./patch-notes.js";

// ── Alpine.js x-data function ───────────────────────────────────────────────

export function appStore() {
    return {
        // Player setup
        playerFighter: null,
        allocation: createEmptyStatAllocation(),
        totalPoints: PLAYER_STAT_POINTS,
        remainingPoints: PLAYER_STAT_POINTS,
        locked: false,
        statDefs: ALLOCATABLE_STATS,

        // Status bar
        statusBadge: "Setup",
        statusText: "내 캐릭터 스탯을 배분하세요",
        statusSubtext: "랜덤 대진과 전투 결과가 여기에 갱신됩니다.",

        // Overlay
        overlayVisible: false,
        overlayTransient: false,
        overlayLabel: "",
        overlayText: "",

        // Start button
        startHidden: true,
        get startDisabled() {
            return this.remainingPoints > 0 || this.locked;
        },
        get startText() {
            return this.remainingPoints > 0 ? `스탯 ${this.remainingPoints} 남음` : "토너먼트 시작";
        },

        // Fighter cards (roster)
        fighters: [],

        // Battle log
        logItems: [],

        // Tournament
        tournamentActive: false,
        tournamentPhase: "Ready",
        tournamentRounds: [],
        showTip: false,

        allocationSummary: "체력 +0% · 공격 +0% · 속도 +0%",

        // Patch notes
        patchEntries: [],
        patchNotesVisible: false,

        init() {
            this._syncSummary();
            this.patchEntries = getUnseenEntries();
            this.patchNotesVisible = this.patchEntries.length > 0;
        },

        closePatchNotes() {
            this.patchNotesVisible = false;
            dismissPatchNotes();
        },

        // Actions
        adjustStat(key, delta) {
            if (this.locked) return;
            this.allocation = adjustStatAllocation(this.allocation, key, delta);
            this.remainingPoints = getRemainingStatPoints(this.allocation);
            this._syncSummary();
        },

        randomAllocation() {
            if (this.locked) return;
            this.allocation = createRandomStatAllocation();
            this.remainingPoints = getRemainingStatPoints(this.allocation);
            this._syncSummary();
        },

        _syncSummary() {
            const m = formatStatAllocation(this.allocation);
            const vals = [this.allocation.hp ?? 0, this.allocation.damage ?? 0, this.allocation.speed ?? 0];
            const mult = calculateStatMultiplier(vals).multiplier;
            this.allocationSummary = m + "  \u00D7" + mult.toFixed(3);
        }
    };
}

// ── Canvas renderer (unchanged) ─────────────────────────────────────────────

export class ArenaRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }

    renderPlayerPreview(fighter) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!fighter) {
            return;
        }

        const preview = new BattleBall(fighter, new Vector2(this.canvas.width / 2, this.canvas.height / 2 - 28));
        preview.velocity = new Vector2(0, 0);
        preview.radius = Math.round(preview.baseRadius * 1.35);
        preview.draw(ctx);

        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#202020";
        ctx.font = "900 28px Bahnschrift, Segoe UI, sans-serif";
        ctx.fillText("내 캐릭터", this.canvas.width / 2, preview.position.y + preview.radius + 48);
        ctx.font = "700 22px Bahnschrift, Segoe UI, sans-serif";
        ctx.fillStyle = fighter.color;
        ctx.fillText(fighter.name, this.canvas.width / 2, preview.position.y + preview.radius + 82);
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
    }

    get state() {
        try {
            if (!this._rootData && typeof Alpine !== "undefined") {
                const root = document.querySelector(".app");
                this._rootData = root ? Alpine.$data(root) : null;
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

    renderPlayerSetup({ fighter, stats, allocation, totalPoints, remainingPoints, locked = false }) {
        const s = this.state;
        if (!s) return;
        s.playerFighter = fighter;
        s.allocation = allocation;
        s.totalPoints = totalPoints;
        s.remainingPoints = remainingPoints;
        s.locked = locked;
    }

    renderRoster(activeIds = []) {
        const s = this.state;
        if (!s) return;
        const visibleRoster = activeIds.length ? this.roster.filter((f) => activeIds.includes(f.id)) : [];
        s.fighters = visibleRoster.map((fighter) => ({
            id: fighter.id,
            name: fighter.name,
            color: fighter.color,
            isPlayer: fighter.isPlayer,
            defeated: false,
            hp: Math.ceil(fighter.stats?.hp ?? 0),
            maxHp: Math.ceil(fighter.stats?.hp ?? 0),
            hpPct: 100,
            statLine: formatStatAllocation(fighter.statAllocation ?? {}),
            balanceMult: 1,
            skillLabel: "Skill",
            skillPct: 1,
            skillText: "Ready"
        }));
    }

    updateStatus(text, badge = "Ready") {
        const s = this.state;
        if (!s) return;
        s.statusText = text;
        s.statusBadge = badge.toUpperCase();
        s.statusSubtext = "랜덤 대진과 전투 결과가 여기에 갱신됩니다.";
    }

    showOverlay(label, text) {
        const s = this.state;
        if (!s) return;
        s.overlayVisible = true;
        s.overlayTransient = false;
        s.overlayLabel = label;
        s.overlayText = text;
    }

    showTransientOverlay(label, text, token) {
        const s = this.state;
        if (!s) return;
        s.overlayVisible = true;
        s.overlayTransient = true;
        s.overlayLabel = label;
        s.overlayText = text;
    }

    hideOverlay() {
        const s = this.state;
        if (!s) return;
        s.overlayVisible = false;
        s.overlayTransient = false;
        s.overlayLabel = "";
        s.overlayText = "";
    }

    setStartButton({ disabled, text, hidden }) {
        const s = this.state;
        if (!s) return;
        if (hidden !== undefined) s.startHidden = hidden;
        // disabled/text are synced by Alpine's _syncStartButton()
    }

    resetLog() {
        this.logItems = [];
        this.renderLog();
    }

    addLog(text) {
        this.logItems.unshift(text);
        this.logItems = this.logItems.slice(0, 9);
        this.renderLog();
    }

    renderLog() {
        const s = this.state;
        if (!s) return;
        s.logItems = [...this.logItems];
    }

    renderTournament(tournament = null) {
        const s = this.state;
        if (!s) return;

        if (!tournament) {
            s.tournamentActive = false;
            s.tournamentPhase = "Ready";
            return;
        }

        s.tournamentActive = true;
        s.tournamentPhase = tournament.champion ? "Champion" : "Running";
        s.tournamentRounds = tournament.rounds.map((round, roundIndex) =>
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
    }

    updateLiveCards(fighters) {
        const s = this.state;
        if (!s) return;
        s.fighters = s.fighters.map((card) => {
            const fighter = fighters.find((f) => f.id === card.id || f.name === card.name);
            if (!fighter) return card;
            const alloc = fighter.statAllocation ?? {};
            const pts = [alloc.hp ?? 0, alloc.damage ?? 0, alloc.speed ?? 0];
            const mult = calculateStatMultiplier(pts).multiplier;
            return {
                ...card,
                hp: Math.ceil(fighter.hp),
                maxHp: Math.ceil(fighter.maxHp),
                hpPct: Math.max(0, (fighter.hp / fighter.maxHp) * 100),
                defeated: fighter.isDefeated,
                balanceMult: mult,
                skillLabel: fighter.getAbilityUiState().label,
                skillPct: Math.max(0, Math.min(1, fighter.getAbilityUiState().progress)),
                skillText:
                    fighter.getAbilityUiState().progress >= 0.995
                        ? "Ready"
                        : `${Math.round(fighter.getAbilityUiState().progress * 100)}%`
            };
        });
    }
}
