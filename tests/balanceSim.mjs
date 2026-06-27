import { createRandomStatAllocation, applyStatAllocation } from "../src/statAllocation.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { TournamentManager } from "../src/tournament.js";
import { createRoster } from "../src/roster.js";
import { getActionPool } from "../src/clickActions.js";

const roster = createRoster();
const TOURNAMENT_COUNT = 200;
const TOTAL_STAT_POINTS = 100;

const ACTION_NAME_MAP = {
    time_warp: "시간왜곡",
    rush: "돌진",
    counter: "카운터",
    projectile_guard: "투사체방어",
    endure: "버티기",
    life_steal: "흡혈",
    shockwave: "충격파",
    evade: "회피"
};

// ── 액션 파라미터 오버라이드 ──────────────────────────────────
// 여기 값을 바꾸고 `node tests/balanceSim.mjs` 재실행
const OVERRIDES = {
    // TIME_WARP_DURATION: 1.0,
    // TIME_WARP_COST: 0.3,
    // RUSH_DURATION: 1.5,
    // RUSH_SPEED_BONUS: 0.8,
    // RUSH_COST: 0.8,
    // COUNTER_WINDOW_SECONDS: 0.3,
    // COUNTER_REFLECT_RATE: 0.8,
    // COUNTER_COST: 1.2,
    // PROJECTILE_GUARD_WINDOW_SECONDS: 0.5,
    // PROJECTILE_GUARD_DAMAGE_MULTIPLIER: 0.2,
    // PROJECTILE_GUARD_COST: 0.8,
    // ENDURE_DURATION: 0.2,
    // ENDURE_DAMAGE_MULTIPLIER: 0.15,
    // ENDURE_COST: 0.8
};

// ── 액션 파라미터 헬퍼 ───────────────────────────────────────

function applyOverrides(overrides) {
    if (!overrides || Object.keys(overrides).length === 0) return;
    const pool = getActionPool();
    for (const action of pool) {
        switch (action.id) {
            case "time_warp":
                if (overrides.TIME_WARP_DURATION !== undefined) action.duration = overrides.TIME_WARP_DURATION;
                if (overrides.TIME_WARP_COST !== undefined) action._hpCostPercent = overrides.TIME_WARP_COST;
                break;
            case "rush":
                if (overrides.RUSH_DURATION !== undefined) action.duration = overrides.RUSH_DURATION;
                if (overrides.RUSH_SPEED_BONUS !== undefined) action.speedBonus = overrides.RUSH_SPEED_BONUS;
                if (overrides.RUSH_COST !== undefined) action._hpCostPercent = overrides.RUSH_COST;
                break;
            case "counter":
                if (overrides.COUNTER_WINDOW_SECONDS !== undefined)
                    action.windowSeconds = overrides.COUNTER_WINDOW_SECONDS;
                if (overrides.COUNTER_REFLECT_RATE !== undefined) action.reflectRate = overrides.COUNTER_REFLECT_RATE;
                if (overrides.COUNTER_COST !== undefined) action._hpCostPercent = overrides.COUNTER_COST;
                break;
            case "projectile_guard":
                if (overrides.PROJECTILE_GUARD_WINDOW_SECONDS !== undefined)
                    action.windowSeconds = overrides.PROJECTILE_GUARD_WINDOW_SECONDS;
                if (overrides.PROJECTILE_GUARD_DAMAGE_MULTIPLIER !== undefined)
                    action.damageMultiplier = overrides.PROJECTILE_GUARD_DAMAGE_MULTIPLIER;
                if (overrides.PROJECTILE_GUARD_COST !== undefined)
                    action._hpCostPercent = overrides.PROJECTILE_GUARD_COST;
                break;
            case "endure":
                if (overrides.ENDURE_DURATION !== undefined) action.duration = overrides.ENDURE_DURATION;
                if (overrides.ENDURE_DAMAGE_MULTIPLIER !== undefined)
                    action.damageMultiplier = overrides.ENDURE_DAMAGE_MULTIPLIER;
                if (overrides.ENDURE_COST !== undefined) action._hpCostPercent = overrides.ENDURE_COST;
                break;
            case "life_steal":
                if (overrides.LIFE_STEAL_DURATION !== undefined) action.duration = overrides.LIFE_STEAL_DURATION;
                if (overrides.LIFE_STEAL_RATE !== undefined) action.lifestealRate = overrides.LIFE_STEAL_RATE;
                if (overrides.LIFE_STEAL_COST !== undefined) action._hpCostPercent = overrides.LIFE_STEAL_COST;
                break;
            case "shockwave":
                if (overrides.SHOCKWAVE_RADIUS !== undefined) action.radius = overrides.SHOCKWAVE_RADIUS;
                if (overrides.SHOCKWAVE_PUSH_FORCE !== undefined) action.pushForce = overrides.SHOCKWAVE_PUSH_FORCE;
                if (overrides.SHOCKWAVE_COST !== undefined) action._hpCostPercent = overrides.SHOCKWAVE_COST;
                break;
            case "evade":
                if (overrides.EVADE_DASH_SPEED !== undefined) action.dashSpeed = overrides.EVADE_DASH_SPEED;
                if (overrides.EVADE_SPEED_BOOST !== undefined) action.speedBoost = overrides.EVADE_SPEED_BOOST;
                if (overrides.EVADE_SPEED_BOOST_DURATION !== undefined)
                    action.speedBoostDuration = overrides.EVADE_SPEED_BOOST_DURATION;
                if (overrides.EVADE_COST !== undefined) action._hpCostPercent = overrides.EVADE_COST;
                break;
        }
    }
}

function resetActionDefaults() {
    const pool = getActionPool();
    for (const action of pool) {
        const Ctor = action.constructor;
        if (Ctor.DEFAULT_DURATION !== undefined) action.duration = Ctor.DEFAULT_DURATION;
        if (Ctor.DEFAULT_SPEED_BONUS !== undefined) action.speedBonus = Ctor.DEFAULT_SPEED_BONUS;
        if (Ctor.DEFAULT_WINDOW_SECONDS !== undefined) action.windowSeconds = Ctor.DEFAULT_WINDOW_SECONDS;
        if (Ctor.DEFAULT_REFLECT_RATE !== undefined) action.reflectRate = Ctor.DEFAULT_REFLECT_RATE;
        if (Ctor.DEFAULT_DAMAGE_MULTIPLIER !== undefined) action.damageMultiplier = Ctor.DEFAULT_DAMAGE_MULTIPLIER;
        if (Ctor.DEFAULT_HP_COST !== undefined) action._hpCostPercent = Ctor.DEFAULT_HP_COST;
        if (Ctor.DEFAULT_LIFESTEAL_RATE !== undefined) action.lifestealRate = Ctor.DEFAULT_LIFESTEAL_RATE;
        if (Ctor.DEFAULT_RADIUS !== undefined) action.radius = Ctor.DEFAULT_RADIUS;
        if (Ctor.DEFAULT_PUSH_FORCE !== undefined) action.pushForce = Ctor.DEFAULT_PUSH_FORCE;
        if (Ctor.DEFAULT_SPEED_BOOST !== undefined) action.speedBoost = Ctor.DEFAULT_SPEED_BOOST;
        if (Ctor.DEFAULT_SPEED_BOOST_DURATION !== undefined)
            action.speedBoostDuration = Ctor.DEFAULT_SPEED_BOOST_DURATION;
        if (Ctor.DEFAULT_DASH_SPEED !== undefined) action.dashSpeed = Ctor.DEFAULT_DASH_SPEED;
    }
}

// ── 시뮬레이션 실행 ───────────────────────────────────────────

function runReport(label, assignActions, overrides) {
    resetActionDefaults();
    applyOverrides(overrides);

    const results = {};
    for (const fighter of roster) {
        results[fighter.id] = { tourneyWins: 0, matchWins: 0, matches: 0 };
    }
    const actionStats = {};
    const actionWinStats = {};

    function runMatch(a, b) {
        const sim = new BattleSimulation(
            [a, b],
            {
                onLog() {},
                onSound() {},
                onDamageTaken() {},
                onDamageDealt() {},
                onHpChanged() {}
            },
            null,
            { assignActions }
        );

        const STEP = 1 / 60;
        const MAX_STEPS = 60 * 60 * 5;
        let steps = 0;
        while (!sim.finished && steps < MAX_STEPS) {
            sim.update(STEP);
            steps++;
        }

        // 액션 보유별 승률
        if (sim.aiControllers) {
            for (let i = 0; i < sim.fighters.length; i++) {
                const fighterId = sim.fighters[i].id;
                const ctrl = sim.aiControllers[i];

                // 액션 사용량
                if (!actionStats[fighterId]) actionStats[fighterId] = {};
                for (const [actionId, count] of Object.entries(ctrl.usageCount)) {
                    actionStats[fighterId][actionId] = (actionStats[fighterId][actionId] ?? 0) + count;
                }

                // 액션 보유별 승패
                for (const action of ctrl.actions) {
                    if (!actionWinStats[fighterId]) actionWinStats[fighterId] = {};
                    if (!actionWinStats[fighterId][action.id])
                        actionWinStats[fighterId][action.id] = { matches: 0, wins: 0 };
                    actionWinStats[fighterId][action.id].matches++;
                    if (sim.winner && sim.winner.id === fighterId) {
                        actionWinStats[fighterId][action.id].wins++;
                    }
                }
            }
        }

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

    return { label, results, actionStats, actionWinStats };
}

// ── 출력 ─────────────────────────────────────────────────────

function printHeader(label) {
    console.log(`\n=== ${label} ===\n`);
    console.log(
        `${"Character".padEnd(16)} ${"Matches".padEnd(8)} ${"Match Wins".padEnd(10)} ${"Match Rate".padEnd(10)} ${"Tourney Wins".padEnd(12)} ${"Tourney Rate".padEnd(12)}`
    );
    console.log("-".repeat(68));
}

function printBody(results) {
    for (const fighter of roster) {
        const r = results[fighter.id];
        const matchRate = r.matches > 0 ? ((r.matchWins / r.matches) * 100).toFixed(1) + "%" : "-";
        const tourneyRate = ((r.tourneyWins / TOURNAMENT_COUNT) * 100).toFixed(1) + "%";
        console.log(
            `${fighter.name.padEnd(16)} ${String(r.matches).padEnd(8)} ${String(r.matchWins).padEnd(10)} ${matchRate.padEnd(10)} ${String(r.tourneyWins).padEnd(12)} ${tourneyRate.padEnd(12)}`
        );
    }
}

function printDelta(baselineResults, withResults) {
    console.log(`\n=== Win Rate Delta (With - Without) ===\n`);
    console.log(`${"Character".padEnd(16)} ${"Match Rate".padEnd(20)} ${"Tourney Rate".padEnd(20)}`);
    console.log("-".repeat(56));
    for (const fighter of roster) {
        const base = baselineResults[fighter.id];
        const withR = withResults[fighter.id];
        const baseMatchPct = base.matches > 0 ? (base.matchWins / base.matches) * 100 : 0;
        const withMatchPct = withR.matches > 0 ? (withR.matchWins / withR.matches) * 100 : 0;
        const matchDelta = (withMatchPct - baseMatchPct).toFixed(1);
        const baseTourneyPct = (base.tourneyWins / TOURNAMENT_COUNT) * 100;
        const withTourneyPct = (withR.tourneyWins / TOURNAMENT_COUNT) * 100;
        const tourneyDelta = (withTourneyPct - baseTourneyPct).toFixed(1);
        const matchStr = `${baseMatchPct.toFixed(1)}% → ${withMatchPct.toFixed(1)}%`;
        const sign = matchDelta >= 0 ? "+" : "";
        console.log(
            `${fighter.name.padEnd(16)} ${(matchStr + ` (${sign}${matchDelta}%)`).padEnd(20)} ${(tourneyDelta >= 0 ? "+" : "") + tourneyDelta + "%".padEnd(19)}`
        );
    }
}

function printActionUsage(actionStats) {
    console.log(`\n=== Action Usage Stats (${TOURNAMENT_COUNT} tournaments) ===\n`);
    console.log(
        `${"Character".padEnd(16)} ${Object.values(ACTION_NAME_MAP)
            .map((n) => n.padEnd(10))
            .join(" ")}`
    );
    console.log("-".repeat(16 + 10 * Object.keys(ACTION_NAME_MAP).length));
    for (const fighter of roster) {
        const stats = actionStats[fighter.id] ?? {};
        const line = Object.keys(ACTION_NAME_MAP)
            .map((id) => String(stats[id] ?? 0).padEnd(10))
            .join(" ");
        console.log(`${fighter.name.padEnd(16)} ${line}`);
    }
}

function printActionWinRate(actionWinStats) {
    console.log(`\n=== Win Rate by Character × Action (With AI Actions) ===\n`);
    console.log(
        `${"Character".padEnd(16)} ${Object.values(ACTION_NAME_MAP)
            .map((n) => n.padEnd(10))
            .join(" ")}`
    );
    console.log("-".repeat(16 + 10 * Object.keys(ACTION_NAME_MAP).length));
    for (const fighter of roster) {
        const stats = actionWinStats[fighter.id] ?? {};
        const cells = Object.keys(ACTION_NAME_MAP).map((id) => {
            const entry = stats[id];
            if (!entry || entry.matches === 0) return "-".padEnd(10);
            const rate = ((entry.wins / entry.matches) * 100).toFixed(1) + "%";
            return rate.padEnd(10);
        });
        console.log(`${fighter.name.padEnd(16)} ${cells.join(" ")}`);
    }
    console.log("\n(값은 해당 액션을 보유한 매치의 승률)");
}

// ── 실행 ─────────────────────────────────────────────────────

console.log(`Ball Fight Simulator — Balance Report (${TOURNAMENT_COUNT} tournaments)`);

const baseline = runReport("Baseline: Without Actions", false, {});
printHeader(baseline.label);
printBody(baseline.results);

const withActions = runReport("With AI Actions", true, OVERRIDES);
printHeader(withActions.label);
printBody(withActions.results);

printDelta(baseline.results, withActions.results);
printActionUsage(withActions.actionStats);
printActionWinRate(withActions.actionWinStats);
