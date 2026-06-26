import { createRandomStatAllocation, applyStatAllocation } from "../src/statAllocation.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { TournamentManager } from "../src/tournament.js";
import { createRoster } from "../src/roster.js";

const roster = createRoster();

const TOURNAMENT_COUNT = 200;
const TOTAL_STAT_POINTS = 100;

const results = {};
for (const fighter of roster) {
    results[fighter.id] = { tourneyWins: 0, matchWins: 0, matches: 0 };
}

function runMatch(a, b) {
    const sim = new BattleSimulation([a, b], {
        onLog() {},
        onSound() {},
        onDamageTaken() {},
        onDamageDealt() {},
        onHpChanged() {}
    });

    const STEP = 1 / 60;
    const MAX_STEPS = 60 * 60 * 5;
    let steps = 0;
    while (!sim.finished && steps < MAX_STEPS) {
        sim.update(STEP);
        steps++;
    }

    // sim.winner is a BattleBall instance; return original spec by id
    if (sim.winner && sim.winner.id === a.id) return a;
    if (sim.winner && sim.winner.id === b.id) return b;
    return null;
}

function runTournament(rng = Math.random) {
    const shuffled = [...roster];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const entrants = shuffled.slice(0, 8).map((fighter) => {
        const alloc = createRandomStatAllocation(rng, TOTAL_STAT_POINTS);
        return applyStatAllocation(fighter, alloc, false);
    });

    const tourney = new TournamentManager(entrants);
    tourney.autoAdvanceByes();

    let match = tourney.nextMatch();
    while (match) {
        tourney.markActive(match);
        const winner = runMatch(match.a, match.b);
        if (winner) {
            tourney.complete(match, winner);
        }
        match = tourney.nextMatch();
    }

    return tourney;
}

for (let index = 0; index < TOURNAMENT_COUNT; index++) {
    const tourney = runTournament();

    for (const round of tourney.rounds) {
        for (const match of round) {
            if (!match.a || !match.b || match.status === "bye") continue;
            results[match.a.id].matches++;
            results[match.b.id].matches++;
            if (match.winner) {
                results[match.winner.id].matchWins++;
            }
        }
    }

    if (tourney.champion) {
        results[tourney.champion.id].tourneyWins++;
    }
}

console.log(`\n=== Balance Report (${TOURNAMENT_COUNT} tournaments) ===\n`);
console.log(
    `${"Character".padEnd(16)} ${"Matches".padEnd(8)} ${"Match Wins".padEnd(10)} ${"Match Rate".padEnd(10)} ${"Tourney Wins".padEnd(12)} ${"Tourney Rate".padEnd(12)}`
);
console.log("-".repeat(68));

for (const fighter of roster) {
    const r = results[fighter.id];
    const matchRate = r.matches > 0 ? ((r.matchWins / r.matches) * 100).toFixed(1) + "%" : "-";
    const tourneyRate = ((r.tourneyWins / TOURNAMENT_COUNT) * 100).toFixed(1) + "%";
    console.log(
        `${fighter.name.padEnd(16)} ${String(r.matches).padEnd(8)} ${String(r.matchWins).padEnd(10)} ${matchRate.padEnd(10)} ${String(r.tourneyWins).padEnd(12)} ${tourneyRate.padEnd(12)}`
    );
}
