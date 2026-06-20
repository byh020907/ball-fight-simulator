

export class Matchmaker {
      constructor(roster) {
        this.roster = roster;
      }

      pick() {
        const shuffled = [...this.roster].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 2);
      }
    }

export class TournamentManager {
      constructor(roster) {
        const entrants = [...roster].sort(() => Math.random() - 0.5);
        const slots = new Array(8).fill(null);
        const byeIndexes = [1, 6, 3, 4].slice(0, Math.max(0, 8 - entrants.length));
        const playIndexes = slots.map((_, index) => index).filter((index) => !byeIndexes.includes(index));
        entrants.slice(0, playIndexes.length).forEach((entrant, index) => {
          slots[playIndexes[index]] = entrant;
        });
        this.rounds = [
          this.createRound(slots, 0),
          this.createRound([null, null, null, null], 1),
          this.createRound([null, null], 2)
        ];
        this.champion = null;
        this.autoAdvanceByes();
      }

      createRound(slots, roundIndex) {
        const matches = [];
        for (let index = 0; index < slots.length; index += 2) {
          matches.push({
            id: `r${roundIndex}m${index / 2}`,
            roundIndex,
            matchIndex: index / 2,
            a: slots[index],
            b: slots[index + 1],
            winner: null,
            status: "pending"
          });
        }
        return matches;
      }

      autoAdvanceByes() {
        for (const match of this.rounds[0]) {
          if (match.status !== "pending") {
            continue;
          }

          if (match.a && !match.b) {
            this.complete(match, match.a, "bye");
          } else if (!match.a && match.b) {
            this.complete(match, match.b, "bye");
          }
        }
      }

      nextMatch() {
        for (const round of this.rounds) {
          const match = round.find((candidate) => candidate.status === "pending" && candidate.a && candidate.b);
          if (match) {
            return match;
          }
        }
        return null;
      }

      markActive(match) {
        match.status = "active";
      }

      complete(match, winner, status = "done") {
        match.winner = winner;
        match.status = status;
        if (match.roundIndex >= this.rounds.length - 1) {
          this.champion = winner;
          return;
        }

        const next = this.rounds[match.roundIndex + 1][Math.floor(match.matchIndex / 2)];
        if (match.matchIndex % 2 === 0) {
          next.a = winner;
        } else {
          next.b = winner;
        }
      }
    }
