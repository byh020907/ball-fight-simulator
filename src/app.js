import { AudioEngine } from './audio.js';
import { BattleSimulation } from './simulation.js';
import { ArenaRenderer, UIController } from './ui.js';
import { Matchmaker, TournamentManager } from './tournament.js';
import { createRoster } from './roster.js';

export class BattleApp {
      constructor() {
        this.elements = {
          canvas: document.getElementById("arenaCanvas"),
          overlay: document.getElementById("overlay"),
          startButton: document.getElementById("startButton"),
          matchupLabel: document.getElementById("matchupLabel"),
          statusBadge: document.getElementById("statusBadge"),
          fighterCards: document.getElementById("fighterCards"),
          battleLog: document.getElementById("battleLog"),
          tournamentBracket: document.getElementById("tournamentBracket"),
          tournamentPhase: document.getElementById("tournamentPhase")
        };

        this.roster = createRoster();
        this.renderer = new ArenaRenderer(this.elements.canvas);
        this.ui = new UIController(this.elements, this.roster);
        this.ui.renderTournament();
        this.matchmaker = new Matchmaker(this.roster);
        this.audio = new AudioEngine();
        this.tournament = null;
        this.currentTournamentMatch = null;
        this.simulation = null;
        this.lastTime = 0;
        this.rafId = 0;
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        this.elements.startButton.addEventListener("click", () => this.startTournament());
      }

      async startTournament() {
        this.audio.unlock();
        cancelAnimationFrame(this.rafId);
        this.elements.startButton.disabled = true;
        this.elements.startButton.classList.add("hidden");
        this.elements.startButton.textContent = "다시 시작";
        this.ui.resetLog();
        this.tournament = new TournamentManager(this.roster);
        this.currentTournamentMatch = null;
        this.ui.renderTournament(this.tournament);
        this.ui.addLog("Tournament bracket locked. Battles will run automatically to the final.");
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
        this.elements.startButton.disabled = true;
        this.elements.startButton.classList.add("hidden");
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
        this.ui.addLog(`Random matchup locked: ${label}`);
        this.ui.addLog(`The arena recognizes ${match[0].title} and ${match[1].title}.`);

        this.simulation = new BattleSimulation(match, {
          onLog: (message) => this.ui.addLog(message),
          onOvertime: () => {
            this.ui.updateStatus(label, "Overtime");
            this.audio.play("overtime");
          },
          onSound: (type, intensity) => this.audio.play(type, intensity)
        });

        this.renderer.render(this.simulation);
        await this.wait(1350);

        this.ui.hideOverlay();
        this.ui.updateStatus(label, "Fight");
        this.audio.play("start");
        this.ui.addLog("Fight starts automatically.");
        this.lastTime = performance.now();
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame((time) => this.loop(time));
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
            [this.currentTournamentMatch.a, this.currentTournamentMatch.b].find((fighter) => fighter?.id === winner.id)
            ?? this.roster.find((fighter) => fighter.id === winner.id);
          this.tournament.complete(this.currentTournamentMatch, winnerSpec);
          this.ui.renderTournament(this.tournament);
          this.ui.showOverlay(this.tournament.champion ? "Champion" : "Advances", winner.name);
          this.ui.updateStatus(
            this.tournament.champion ? `${winner.name} is champion` : `${winner.name} advances`,
            "Result"
          );
          this.ui.addLog(`${winner.name} defeats ${loser.name}.`);
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
        this.elements.startButton.textContent = "다시 시작";
        this.elements.startButton.classList.remove("hidden");
        this.elements.startButton.disabled = false;
      }

      showTournamentChampion() {
        if (!this.tournament?.champion) {
          return;
        }

        const champion = this.tournament.champion;
        this.ui.renderTournament(this.tournament);
        this.ui.showOverlay("Champion", champion.name);
        this.ui.updateStatus(`${champion.name} wins the tournament`, "Result");
        this.ui.addLog(`${champion.name} takes the whole bracket.`);
        this.elements.startButton.textContent = "다시 시작";
        this.elements.startButton.classList.remove("hidden");
        this.elements.startButton.disabled = false;
      }

      wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
      }
    }

