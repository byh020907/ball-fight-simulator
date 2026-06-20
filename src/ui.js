

export class ArenaRenderer {
      constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
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

        for (const entity of simulation.entities) {
          entity.draw(ctx, simulation);
        }

        for (const fighter of simulation.fighters) {
          fighter.draw(ctx);
          this.drawNameplate(fighter);
        }

        ctx.restore();
      }

      drawNameplate(fighter) {
        if (fighter.isDestroyed) {
          return;
        }

        const ctx = this.ctx;
        const y = fighter.position.y + fighter.radius + 18;
        ctx.save();
        ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(32, 32, 32, 0.7)";
        ctx.fillText(fighter.name, fighter.position.x, y);
        ctx.restore();
      }
    }

export class UIController {
      constructor(elements, roster) {
        this.elements = elements;
        this.roster = roster;
        this.logItems = [];
        this.renderRoster();
      }

      renderRoster(activeIds = []) {
        this.elements.fighterCards.innerHTML = "";
        const visibleRoster = activeIds.length
          ? this.roster.filter((fighter) => activeIds.includes(fighter.id))
          : [];

        for (const fighter of visibleRoster) {
          const card = document.createElement("article");
          card.className = `fighter-card${activeIds.includes(fighter.id) ? " active" : ""}`;
          card.innerHTML = `
            <div class="fighter-head">
              <div class="fighter-meta">
                <strong>${fighter.name}</strong>
                <span>250 / 250</span>
              </div>
            </div>
            <div class="hp-bar"><div class="hp-fill" style="background:${fighter.color};width:${activeIds.includes(fighter.id) ? "100%" : "18%"}"></div></div>
            <div class="cooldown-wrap">
              <div class="cooldown-meta"><span class="cooldown-label">Skill</span><span class="cooldown-text">Ready</span></div>
              <div class="cooldown-bar"><div class="cooldown-fill" style="width:100%"></div></div>
            </div>
          `;
          this.elements.fighterCards.appendChild(card);
        }
      }

      updateStatus(text, badge = "Ready") {
        this.elements.matchupLabel.innerHTML = `${text}<small>랜덤 대진과 전투 결과가 여기에 갱신됩니다.</small>`;
        this.elements.statusBadge.textContent = badge.toUpperCase();
        const topBar = this.elements.statusBadge.closest(".top-bar");
        topBar?.classList.toggle("overtime", badge.toLowerCase() === "overtime");
        topBar?.classList.toggle("result", badge.toLowerCase() === "result");
      }

      showOverlay(label, text) {
        this.elements.overlay.innerHTML = `
          <div class="overlay-card">
            <span>${label}</span>
            <strong>${text}</strong>
          </div>
        `;
        this.elements.overlay.classList.add("visible");
      }

      hideOverlay() {
        this.elements.overlay.classList.remove("visible");
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
        this.elements.battleLog.innerHTML = this.logItems.map((text) => `<li>${text}</li>`).join("");
      }

      renderTournament(tournament = null) {
        if (!this.elements.tournamentBracket) {
          return;
        }

        if (!tournament) {
          this.elements.tournamentPhase.textContent = "Ready";
          this.elements.tournamentBracket.innerHTML = `
            <div class="bracket-round">
              <div class="round-title">Round 1</div>
              <div class="bracket-match"><div class="bracket-slot empty">Press start</div><span class="bracket-status">WAIT</span></div>
            </div>
            <div class="bracket-round">
              <div class="round-title">Semi</div>
              <div class="bracket-match"><div class="bracket-slot empty">Auto battle</div><span class="bracket-status">LOCK</span></div>
            </div>
            <div class="bracket-round">
              <div class="round-title">Final</div>
              <div class="bracket-match"><div class="bracket-slot empty">Champion</div><span class="bracket-status">LOCK</span></div>
            </div>
          `;
          return;
        }

        this.elements.tournamentPhase.textContent = tournament.champion ? "Champion" : "Running";
        this.elements.tournamentBracket.innerHTML = tournament.rounds.map((round, roundIndex) => `
          <div class="bracket-round">
            <div class="round-title">${["Round 1", "Semi", "Final"][roundIndex]}</div>
            ${round.map((match) => this.renderTournamentMatch(match)).join("")}
          </div>
        `).join("");
      }

      renderTournamentMatch(match) {
        const classes = ["bracket-match", match.status];
        const status = match.winner ? "WIN" : match.status === "active" ? "LIVE" : match.status === "bye" ? "BYE" : "WAIT";
        return `
          <div class="${classes.join(" ")}">
            ${this.renderTournamentSlot(match.a, match.winner, match.roundIndex === 0 ? "BYE" : "TBD")}
            ${this.renderTournamentSlot(match.b, match.winner, match.roundIndex === 0 ? "BYE" : "TBD")}
            <span class="bracket-status">${status}</span>
          </div>
        `;
      }

      renderTournamentSlot(fighter, winner, emptyLabel = "TBD") {
        if (!fighter) {
          return `<div class="bracket-slot empty"><span class="bracket-dot"></span>${emptyLabel}</div>`;
        }

        const isWinner = winner?.id === fighter.id;
        return `
          <div class="bracket-slot${isWinner ? " winner" : ""}">
            <span class="bracket-dot" style="background:${fighter.color}"></span>${fighter.name}
          </div>
        `;
      }

      updateLiveCards(fighters) {
        const cards = Array.from(this.elements.fighterCards.children);
        for (const fighter of fighters) {
          const card = cards.find((item) => item.querySelector(".fighter-meta strong").textContent === fighter.name);
          if (!card) {
            continue;
          }

          const fill = card.querySelector(".hp-fill");
          const hpText = card.querySelector(".fighter-meta span");
          const cooldownFill = card.querySelector(".cooldown-fill");
          const cooldownLabel = card.querySelector(".cooldown-label");
          const cooldownText = card.querySelector(".cooldown-text");
          const abilityUi = fighter.getAbilityUiState();
          fill.style.width = `${Math.max(0, (fighter.hp / fighter.maxHp) * 100)}%`;
          hpText.textContent = `${Math.ceil(fighter.hp)} / ${fighter.maxHp}`;
          cooldownFill.style.width = `${Math.max(0, Math.min(1, abilityUi.progress)) * 100}%`;
          cooldownLabel.textContent = abilityUi.label;
          cooldownText.textContent = abilityUi.progress >= 0.995 ? "Ready" : `${Math.round(abilityUi.progress * 100)}%`;
          card.classList.toggle("active", !fighter.isDefeated);
          if (fighter.isDefeated) {
            fill.style.opacity = "0.3";
            cooldownFill.style.opacity = "0.35";
          }
        }
      }
    }
