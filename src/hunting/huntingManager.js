import {
    createHuntingRun,
    recordHuntingFloorResult,
    advanceHuntingRun,
    retreatHuntingRun,
    defeatHuntingRun,
    getEligibleHuntingCharacters,
    canEnterHunting,
    applyHuntingEventRecovery
} from "./huntingState.js";
import { scaleEnemySpecForHunting } from "./huntingEncounters.js";
import { rollKeyShardReward, createHuntingChest, createEmptyHuntingLoot } from "./huntingRewards.js";
import { createMatchReport, recordLowestHp } from "../collection/index.js";
import { grantExperienceFromMatchReport } from "../experience/experienceService.js";
import { applyStatAllocation } from "../statAllocation.js";
import { savePlayerProfile } from "../playerProfile.js";

export class HuntingManager {
    constructor(app) {
        this.app = app;
        this._run = null;
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
        this._run = createHuntingRun({ characterId });
        this.app.playerFighterId = characterId;
        const s = this.app.ui.state;
        if (s) {
            s.huntingActive = true;
            s.huntingChoiceVisible = false;
        }
        this._startFloorBattle();
    }

    _startFloorBattle() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;

        const playerSpec = app.roster.find((f) => f.id === run.characterId);
        if (!playerSpec) return;

        const enemies = app.roster.filter((f) => f.id !== run.characterId);
        if (enemies.length === 0) return;

        const enemySpec = scaleEnemySpecForHunting(
            { ...enemies[Math.floor(Math.random() * enemies.length)] },
            run.floor
        );

        const appliedSpec = applyStatAllocation(playerSpec, app.playerStatAllocation, true);
        const matchSpecs = [appliedSpec, enemySpec];
        app._currentMatchReport = createMatchReport();
        app._currentMatchReport.playerFighterId = run.characterId;

        app._onSimulationResult = (a) => this._handleFinish(a);

        const prevId = app.playerFighterId;
        app.playerFighterId = run.characterId;

        app.startMatch(matchSpecs, { keepLog: false, skipActionPick: true });

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
            const floorLoot = {
                keyShards: rollKeyShardReward({ floor: run.floor }),
                chests: Math.random() < 0.15 ? [createHuntingChest({ rarity: "common" })] : [],
                xp: 0
            };

            this._run = recordHuntingFloorResult(run, {
                hpRemain: Math.ceil(playerBall?.hp ?? run.carriedHp ?? 0),
                maxHp: playerBall?.maxHp ?? run.carriedMaxHp,
                loot: floorLoot
            });

            const name = playerBall?.name ?? run.characterId;
            const shardsText = `해조각 +${floorLoot.keyShards}`;
            const pendingText = `보유 해조각 ${this._run.pendingLoot.keyShards}`;
            const subtext = `층 ${run.floor} 완료 · ${shardsText}`;

            app.ui.showOverlay("사냥터", `${name} 승리!`, subtext);
            const s = app.ui.state;
            if (s) {
                s.huntingChoiceVisible = true;
                s.huntingFloor = run.floor;
                s.huntingCharacterName = name;
                s.huntingLootSummary = pendingText;
            }
            app.ui.setStartButton({ hidden: true, disabled: true, text: "" });
            savePlayerProfile(app.playerProfile);
        } else {
            this._run = defeatHuntingRun(run);
            const name = playerBall?.name ?? run.characterId;
            const securedShards = this._run.securedLoot?.keyShards ?? 0;
            const lostShards = this._run.defeatLosses?.keyShards ?? 0;

            this._mergeIntoSecured(app);
            app._refreshCollectionHub();
            app.refreshPlayerSetup();

            app.ui.showOverlay(
                "사냥터 패배",
                `${name} 쓰러짐`,
                `획득 ${securedShards} 해조각 · 손실 ${lostShards} 해조각`
            );
            const s = app.ui.state;
            if (s) {
                s.huntingActive = false;
                s.huntingChoiceVisible = false;
            }
            app._huntingDone = true;
            app.ui.setStartButton({ text: "확인", hidden: false, disabled: false });
            this._run = null;
        }
    }

    retreat() {
        const app = this.app;
        const run = this._run;
        if (!run || run.status !== "active") return;

        this._run = retreatHuntingRun(run);
        const securedShards = this._run.securedLoot?.keyShards ?? 0;

        this._mergeIntoSecured(app);
        app._refreshCollectionHub();
        app.refreshPlayerSetup();

        const s = app.ui.state;
        if (s) {
            s.huntingActive = false;
            s.huntingChoiceVisible = false;
        }

        app._huntingDone = true;
        app.ui.showOverlay("사냥터 종료", "귀환 완료", `해조각 ${securedShards} 확보 · 최고 층 ${run.floor}`);
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

        const s = app.ui.state;
        if (s) s.huntingChoiceVisible = false;

        const event = this._run.lastEvent;
        if (event) {
            if (event.type === "rest_site") {
                const healAmount = Math.floor((this._run.carriedMaxHp ?? this._run.carriedHp ?? 100) * 0.25);
                this._run = applyHuntingEventRecovery(this._run, { amount: healAmount });
                const name = app.roster.find((f) => f.id === run.characterId)?.name ?? run.characterId;
                app.ui.addLog(`[Hunting] Rest site: ${name} recovered ${healAmount} HP`);
                app.ui.showToast(`Rest site: HP +${healAmount}`);
            } else if (event.type === "chest_room") {
                const chest = createHuntingChest({ rarity: Math.random() < 0.3 ? "uncommon" : "common" });
                this._run = recordHuntingFloorResult(this._run, {
                    hpRemain: run.carriedHp,
                    maxHp: run.carriedMaxHp,
                    loot: { keyShards: 0, chests: [chest], xp: 0 }
                });
                app.ui.addLog(`[Hunting] Chest room: gained ${chest.rarity} chest`);
                app.ui.showToast(`Chest room: ${chest.rarity} chest`);
            }
        }

        this._startFloorBattle();
    }

    _mergeIntoSecured(app) {
        const run = this._run;
        if (!run) return;
        const profile = app.playerProfile;
        if (profile.hunting) {
            profile.hunting.keyShards = (profile.hunting.keyShards ?? 0) + (run.securedLoot?.keyShards ?? 0);
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
