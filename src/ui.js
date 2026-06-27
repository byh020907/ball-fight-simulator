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
import { getUnseenEntries, dismissPatchNotes, appendCapped } from "./utils.js";
import { PopupService } from "./popup.js";
import { createCollectionHubViewModel, COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";
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

// ── Alpine.js x-data function ───────────────────────────────────────────────

export function appStore() {
    return {
        // Player setup
        playerFighter: null,
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

        // Overlay
        overlayVisible: false,
        overlayTransient: false,
        overlayLabel: "",
        overlayText: "",

        // Toast notification (queue-based)
        toastVisible: false,
        toastMessage: "",
        toastTimer: null,
        toastQueue: [],

        // Start button
        startHidden: true,
        _startDisabled: null,
        _startText: null,
        get startDisabled() {
            return this._startDisabled !== null ? this._startDisabled : this.remainingPoints > 0 || this.locked;
        },
        get startText() {
            return this._startText !== null
                ? this._startText
                : this.remainingPoints > 0
                  ? `스탯 ${this.remainingPoints} 남음`
                  : "토너먼트 시작";
        },

        // Fighter cards (roster)
        fighters: [],

        // Collection hub
        collectionHub: {
            visible: false,
            activeTab: "roster",
            tabs: [],
            filters: {
                roster: "all",
                mastery: "all",
                achievements: "all"
            },
            searchQueries: {
                roster: "",
                mastery: "",
                achievements: ""
            },
            sortModes: {
                roster: "roster",
                achievements: "default"
            },
            selectedCharacterId: null,
            rosterItems: [],
            masteryItems: [],
            achievementItems: [],
            summary: {}
        },

        // Collection hub actions
        openCollectionHub(tabId) {
            const validTabs =
                this.collectionHub.tabs.length > 0 ? this.collectionHub.tabs.map((t) => t.id) : ["roster"];
            if (tabId && validTabs.includes(tabId)) {
                this.collectionHub.activeTab = tabId;
            } else {
                this.collectionHub.activeTab = validTabs[0];
            }
            this.collectionHub.visible = true;
        },
        closeCollectionHub() {
            this.collectionHub.visible = false;
            this.collectionHub.selectedCharacterId = null;
        },
        setCollectionTab(tabId) {
            const validTabs =
                this.collectionHub.tabs.length > 0 ? this.collectionHub.tabs.map((t) => t.id) : ["roster"];
            if (validTabs.includes(tabId)) {
                this.collectionHub.activeTab = tabId;
            }
        },
        setCollectionFilter(filterId) {
            const tab = this.collectionHub.activeTab;
            if (tab && filterId) {
                this.collectionHub.filters[tab] = filterId;
            }
        },
        clearCollectionSearch(tabId) {
            if (tabId && this.collectionHub.searchQueries[tabId] !== undefined) {
                this.collectionHub.searchQueries[tabId] = "";
            }
        },
        selectCollectionCharacter(characterId) {
            this.collectionHub.selectedCharacterId =
                this.collectionHub.selectedCharacterId === characterId ? null : characterId;
        },
        closeCollectionCharacterDetail() {
            this.collectionHub.selectedCharacterId = null;
        },
        get filteredRosterItems() {
            const tab = this.collectionHub.activeTab;
            if (tab !== "roster") return [];
            const filter = this.collectionHub.filters.roster || "all";
            const query = (this.collectionHub.searchQueries.roster || "").toLowerCase();
            const sort = this.collectionHub.sortModes.roster || "roster";
            let items = [...(this.collectionHub.rosterItems || [])];
            if (query) {
                items = items.filter((item) => item.name.toLowerCase().includes(query));
            }
            if (filter === "unplayed") items = items.filter((i) => !i.hasRecord);
            else if (filter === "played") items = items.filter((i) => i.hasRecord);
            else if (filter === "won") items = items.filter((i) => i.tournamentWins > 0);
            else if (filter === "master") items = items.filter((i) => i.mastery >= 3);
            if (sort === "wins") items = items.sort((a, b) => b.tournamentWins - a.tournamentWins);
            else if (sort === "recent")
                items = items.sort((a, b) => (b.lastTournamentAt ?? 0) - (a.lastTournamentAt ?? 0));
            return items;
        },
        get filteredMasteryItems() {
            const tab = this.collectionHub.activeTab;
            if (tab !== "mastery") return [];
            const filter = this.collectionHub.filters.mastery || "all";
            let items = [...(this.collectionHub.masteryItems || [])];
            if (filter === "unlocked") items = items.filter((i) => i.unlocked);
            else if (filter === "locked") items = items.filter((i) => !i.unlocked);
            else if (filter === "active") items = items.filter((i) => i.active);
            return items;
        },
        get filteredAchievementItems() {
            const tab = this.collectionHub.activeTab;
            if (tab !== "achievements") return [];
            const filter = this.collectionHub.filters.achievements || "all";
            let items = [...(this.collectionHub.achievementItems || [])];
            if (filter === "unlocked") items = items.filter((i) => i.unlocked);
            else if (filter === "locked") items = items.filter((i) => !i.unlocked);
            return items;
        },

        // Battle log
        logItems: [],

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

        adjustChallengeLevel(delta) {
            const next = this.challengeLevel + delta;
            if (next < 0 || next > this.highestUnlockedLevel) return;
            this.challengeLevel = next;
            this._startDisabled = null;
            this._startText = null;
        },

        // Patch notes
        patchEntries: [],
        patchNotesVisible: false,

        // Popup (used by PopupService)
        popupVisible: false,
        popupContent: null,

        // Action picker (Alpine template)
        actionPickerCards: [],
        get actionPickerVisible() {
            return this.actionPickerCards.length > 0;
        },
        _actionPickResolve: null,

        init() {
            this._syncSummary();
            this.patchEntries = getUnseenEntries();
            this.patchNotesVisible = this.patchEntries.length > 0;
        },

        closePatchNotes() {
            this.patchNotesVisible = false;
            dismissPatchNotes();
        },

        closePopup(value) {
            this.popupVisible = false;
            // Clear content after transition completes
            setTimeout(() => {
                this.popupContent = null;
                PopupService.resolve(value ?? "close");
            }, 250);
        },

        /** 액션 카드 선택 (Alpine @click에서 호출) — 단 한 번만 실행 */
        pickAction(index) {
            const resolve = this._actionPickResolve;
            if (resolve) resolve(index);
        },

        // Actions
        adjustStat(key, delta) {
            if (this.locked) return;
            this.allocation = adjustStatAllocation(this.allocation, key, delta, this.totalPoints);
            this.remainingPoints = getRemainingStatPoints(this.allocation, this.totalPoints);
            this._startDisabled = null;
            this._startText = null;
            this._syncSummary();
        },

        randomAllocation() {
            if (this.locked) return;
            this.allocation = createRandomStatAllocation(undefined, this.totalPoints);
            this.remainingPoints = getRemainingStatPoints(this.allocation, this.totalPoints);
            this._startDisabled = null;
            this._startText = null;
            this._syncSummary();
        },

        resetAllocation() {
            if (this.locked) return;
            this.allocation = createEmptyStatAllocation();
            this.remainingPoints = getRemainingStatPoints(this.allocation, this.totalPoints);
            this._startDisabled = null;
            this._startText = null;
            this._syncSummary();
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
        }
    };
}

// ── Canvas renderer (unchanged) ─────────────────────────────────────────────

export class ArenaRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
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
        progressionBonusSummary = ""
    } = {}) {
        const s = this.state;
        if (!s) return;
        s.playerFighter = fighter;
        s.allocation = allocation;
        s.totalPoints = totalPoints;
        s.bonusPoints = bonusPoints;
        s.remainingPoints = remainingPoints;
        s.locked = locked;
        s.challengeLevel = challengeLevel;
        s.highestUnlockedLevel = highestUnlockedLevel;
        s.progressionBonusSummary = progressionBonusSummary;
        s._startDisabled = null;
        s._startText = null;
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

    renderRoster(activeIds = []) {
        const s = this.state;
        if (!s) return;
        const visibleRoster = activeIds.length ? this.roster.filter((f) => activeIds.includes(f.id)) : [];
        s.fighters = visibleRoster.map((fighter) => {
            const isHero = fighter.id === FIGHTER_IDS.HERO;
            return {
                id: fighter.id,
                name: fighter.name,
                color: fighter.color,
                isPlayer: fighter.isPlayer,
                defeated: false,
                hp: Math.ceil(fighter.stats?.hp ?? 0),
                maxHp: Math.ceil(fighter.stats?.hp ?? 0),
                hpPct: 100,
                statLine: isHero
                    ? formatHeroStatLine(fighter.statAllocation ?? {})
                    : formatStatAllocation(fighter.statAllocation ?? {}),
                heroStatParts: isHero ? formatHeroStatParts(fighter.statAllocation ?? {}) : [],
                isHero,
                balanceMult: 1,
                skillLabel: "Skill",
                skillPct: 1,
                skillText: "Ready"
            };
        });
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

    showToast(message, duration = 3500) {
        const s = this.state;
        if (!s) return;
        s.toastQueue.push({ message, duration });
        this._processToastQueue();
    }

    _processToastQueue() {
        const s = this.state;
        if (!s || s.toastTimer || s.toastQueue.length === 0) return;
        const item = s.toastQueue.shift();
        s.toastMessage = item.message;
        s.toastVisible = true;
        s.toastTimer = setTimeout(() => {
            s.toastVisible = false;
            s.toastTimer = null;
            this._processToastQueue();
        }, item.duration);
    }

    showTransientOverlay(label, text, token) {
        const s = this.state;
        if (!s) return;
        s.overlayVisible = true;
        s.overlayTransient = true;
        s._transientToken = token;
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

    renderCollectionHub(vm) {
        const s = this.state;
        if (!s) return;
        s.collectionHub.tabs = [...COLLECTION_HUB_TABS];
        s.collectionHub.summary = vm.summary;
        s.collectionHub.rosterItems = vm.rosterItems;
        s.collectionHub.masteryItems = vm.masteryItems;
        s.collectionHub.achievementItems = vm.achievementItems;
    }

    openCollectionHub(tabId) {
        const s = this.state;
        if (!s) return;
        s.openCollectionHub(tabId);
    }

    closeCollectionHub() {
        const s = this.state;
        if (!s) return;
        s.closeCollectionHub();
    }

    /** 카드 선택 UI — Alpine 템플릿 사용 (index.html의 action-picker) */
    async waitForActionPick(cards) {
        if (typeof document === "undefined" || !document.addEventListener) {
            return cards[0]?.id ?? null;
        }

        const s = this.state;
        if (!s) return cards[0]?.id ?? null;

        // 이미 선택 중이면 새 요청 거부 (단 한 번만 고를 수 있음)
        if (s._actionPickResolve) {
            return cards[0]?.id ?? null;
        }

        // Alpine 템플릿에 카드 데이터 설정
        s.actionPickerCards = cards.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            hpCost: c.hpCostPercent
        }));

        return new Promise((resolve) => {
            s._actionPickResolve = (index) => {
                s.actionPickerCards = [];
                s._actionPickResolve = null;
                const picked = cards[index];
                resolve(picked?.id ?? cards[0].id);
            };
        });
    }

    setStartButton({ disabled, text, hidden }) {
        const s = this.state;
        if (!s) return;
        if (hidden !== undefined) s.startHidden = hidden;
        s._startDisabled = disabled !== undefined ? disabled : null;
        s._startText = text !== undefined ? text : null;
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
            const isHero = fighter.id === FIGHTER_IDS.HERO;
            const pts = [alloc.hp ?? 0, alloc.damage ?? 0, alloc.speed ?? 0, alloc.skill ?? 0, alloc.defense ?? 0];
            const mult = calculateStatMultiplier(pts).multiplier;
            return {
                ...card,
                hp: Math.ceil(fighter.hp),
                maxHp: Math.ceil(fighter.maxHp),
                hpPct: Math.max(0, (fighter.hp / fighter.maxHp) * 100),
                defeated: fighter.isDefeated,
                balanceMult: mult,
                isHero,
                mergedBonuses: mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {}),
                statLine: isHero
                    ? formatHeroStatLine(
                          fighter.statAllocation ?? {},
                          mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {})
                      )
                    : formatStatAllocation(fighter.statAllocation ?? {}),
                heroStatParts: isHero
                    ? formatHeroStatParts(
                          fighter.statAllocation ?? {},
                          mergeOrbBonuses(fighter.hero.bonuses ?? {}, fighter.hero.carryover ?? {})
                      )
                    : [],
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
