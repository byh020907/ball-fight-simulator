import { AudioEngine } from "./audio.js";
import { BattleSimulation } from "./simulation/BattleSimulation.js";
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
} from "./stat-allocation.js";

export class BattleApp {
    constructor() {
        /**
         * 시작 캐릭터 ID. 비워두면(null) 랜덤, ID를 지정하면 해당 캐릭터가
         * 플레이어로 고정되고 토너먼트 첫 엔트리에 배치됩니다.
         * @type {string|null}
         */
        this.startCharacter = null;
        // this.startCharacter = 'bat_ball';

        this.elements = {
            canvas: document.getElementById("arenaCanvas"),
            overlay: document.getElementById("overlay")
        };

        this.roster = createRoster();
        this.tournamentRoster = this.roster;
        this.playerFighterId = this.pickPlayerFighterId();
        this.playerStatAllocation = createEmptyStatAllocation();
        this.playerResult = null;
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
        this.ui.updateStatus("내 캐릭터 스탯을 배분하세요", "Setup");
        this.ui.hideOverlay();
        this.startPlayerPreviewLoop();
    }

    pickPlayerFighterId() {
        if (this.startCharacter) return this.startCharacter;
        return this.roster[Math.floor(Math.random() * this.roster.length)].id;
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

    renderPlayerPreview() {
        if (this.tournament && !this.tournament.champion) {
            return;
        }

        const player = this.roster.find((fighter) => fighter.id === this.playerFighterId);
        this.renderer.renderPlayerPreview(player);
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
        this.ui.resetLog();
        this.tournamentRoster = createTournamentRoster(this.roster, this.playerFighterId, this.playerStatAllocation);
        this.ui.roster = this.tournamentRoster;
        this.matchmaker = new Matchmaker(this.tournamentRoster);
        this.playerResult = null;
        this.tournament = new TournamentManager(this.tournamentRoster, this.startCharacter);
        this.currentTournamentMatch = null;
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

    async startMatch(customMatch = null, options = {}) {
        this.audio.unlock();
        this.ui.setStartButton({ disabled: true, hidden: true });
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

        this.simulation = new BattleSimulation(match, {
            onLog: (message) => this.ui.addLog(message),
            onOvertime: () => {
                this.ui.updateStatus(label, "Overtime");
                this.showTransientOverlay("Overtime", "", 1250);
                this.audio.play("overtime");
            },
            onSound: (type, intensity) => this.audio.play(type, intensity)
        });

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

    loop(timestamp) {
        const delta = Math.min(0.032, (timestamp - this.lastTime) / 1000 || 0.016);
        this.lastTime = timestamp;
        this.simulation.update(delta);
        this.renderer.render(this.simulation);
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

        this.matchFinalized = true;
        const winner = this.simulation.winner;
        const loser = this.simulation.loser ?? this.simulation.fighters.find((fighter) => fighter !== winner);
        if (this.tournament && this.currentTournamentMatch) {
            const winnerSpec =
                [this.currentTournamentMatch.a, this.currentTournamentMatch.b].find(
                    (fighter) => fighter?.id === winner.id
                ) ?? this.tournamentRoster.find((fighter) => fighter.id === winner.id);
            const playerWasInMatch = [this.currentTournamentMatch.a, this.currentTournamentMatch.b].some(
                (fighter) => fighter?.id === this.playerFighterId
            );
            const playerLost = playerWasInMatch && winnerSpec.id !== this.playerFighterId;
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

        this.ui.renderTournament(this.tournament);
        this.ui.showOverlay(
            playerWon ? "축하합니다!" : "토너먼트 종료",
            playerWon ? `${champion.name} 우승` : `${player.name} ${this.playerResult?.rankLabel ?? "결과 확정"}`
        );
        this.ui.updateStatus(
            playerWon
                ? `내 캐릭터 ${champion.name} 우승`
                : `내 캐릭터 ${player.name} ${this.playerResult?.rankLabel ?? ""}`,
            "Result"
        );
        this.ui.addLog(`${champion.name} takes the whole bracket.`);
        this.ui.addLog(
            playerWon
                ? `축하합니다! 내 캐릭터 ${champion.name}가 토너먼트에서 우승했습니다.`
                : `아쉽네요. 내 캐릭터 ${player.name}의 최종 성적은 ${this.playerResult?.rankLabel ?? "기록 없음"}입니다.`
        );
        this.ui.setStartButton({ text: "다시 시작", hidden: false, disabled: false });
        this.refreshPlayerSetup();
    }

    wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
}
