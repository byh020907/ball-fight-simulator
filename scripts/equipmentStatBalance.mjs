import { BattleSimulation } from "../src/simulation/battleSimulation.js";

function readNumberEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
}

const CONFIG = Object.freeze({
    samples: Math.max(8, Math.floor(readNumberEnv("BALANCE_SAMPLES", 24))),
    targetUplift: readNumberEnv("BALANCE_TARGET_UPLIFT", 0.05),
    maxSeconds: Math.max(30, readNumberEnv("BALANCE_MAX_SECONDS", 60)),
    seed: Math.floor(readNumberEnv("BALANCE_SEED", 20260712)),
    step: 1 / 60
});

const STANDARD_STATS = Object.freeze({ hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 1 });

const STAT_CANDIDATES = Object.freeze({
    hp: Object.freeze([5, 10, 20, 40, 80]),
    damage: Object.freeze([0.5, 1, 2, 4, 8]),
    defense: Object.freeze([0.25, 0.5, 1, 2, 4]),
    speed: Object.freeze([10, 20, 40, 80, 160])
});

function createSeededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function createStandardSpec(id, bonus = {}) {
    return {
        id,
        teamId: id,
        name: "Standard Ball",
        title: "",
        description: "Equipment stat calibration reference",
        color: "#8a8a8a",
        face: "default",
        ability: "none",
        rotationEnabled: true,
        appearance: { sides: 0, face: "default" },
        stats: {
            hp: STANDARD_STATS.hp + (bonus.hp ?? 0),
            damage: STANDARD_STATS.damage + (bonus.damage ?? 0),
            defense: STANDARD_STATS.defense + (bonus.defense ?? 0),
            speed: STANDARD_STATS.speed + (bonus.speed ?? 0),
            radius: STANDARD_STATS.radius,
            mass: STANDARD_STATS.mass
        }
    };
}

function disableVisualEffects(simulation) {
    simulation.addSparkBurst = () => {};
    simulation.spawnExplosion = () => {};
    simulation.spawnPulse = () => {};
    simulation.spawnDeathExplosion = () => {};
    simulation.updateOvertimeParticles = () => {};
}

function runMatch(seed, boostedStat = null, amount = 0, boostedIndex = 0) {
    const originalRandom = Math.random;
    Math.random = createSeededRng(seed);
    try {
        const bonus = boostedStat ? { [boostedStat]: amount } : {};
        const specs =
            boostedIndex === 0
                ? [createStandardSpec("boosted", bonus), createStandardSpec("baseline")]
                : [createStandardSpec("baseline"), createStandardSpec("boosted", bonus)];
        const simulation = new BattleSimulation(specs, { onLog() {}, onSound() {} }, null, { assignActions: false });
        disableVisualEffects(simulation);

        while (!simulation.finished && simulation.elapsed < CONFIG.maxSeconds) {
            simulation.update(CONFIG.step, CONFIG.step);
        }

        if (simulation.finished) {
            return { won: simulation.winner === simulation.fighters[boostedIndex], decidedBy: "knockout" };
        }

        const boosted = simulation.fighters[boostedIndex];
        const opponent = simulation.fighters[boostedIndex === 0 ? 1 : 0];
        const boostedHpRatio = boosted.hp / boosted.maxHp;
        const opponentHpRatio = opponent.hp / opponent.maxHp;
        return { won: boostedHpRatio > opponentHpRatio, decidedBy: "hp_ratio" };
    } finally {
        Math.random = originalRandom;
    }
}

function measureUplift(stat, amount) {
    let upliftSum = 0;
    let knockoutMatches = 0;
    let hpRatioMatches = 0;

    for (let sample = 0; sample < CONFIG.samples; sample += 1) {
        const seed = CONFIG.seed + sample;
        for (const boostedIndex of [0, 1]) {
            const baseline = runMatch(seed, null, 0, boostedIndex);
            const boosted = runMatch(seed, stat, amount, boostedIndex);
            upliftSum += Number(boosted.won) - Number(baseline.won);
            knockoutMatches += Number(baseline.decidedBy === "knockout") + Number(boosted.decidedBy === "knockout");
            hpRatioMatches += Number(baseline.decidedBy === "hp_ratio") + Number(boosted.decidedBy === "hp_ratio");
        }
    }

    return {
        uplift: upliftSum / (CONFIG.samples * 2),
        knockoutMatches,
        hpRatioMatches
    };
}

function findTargetCandidate(results) {
    return results.find((result) => result.uplift >= CONFIG.targetUplift) ?? null;
}

function formatPercent(value) {
    return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%p`;
}

function main() {
    console.log("\nEquipment stat calibration: standard no-ability ball");
    console.log(
        `Base stats: HP ${STANDARD_STATS.hp}, DMG ${STANDARD_STATS.damage}, DEF ${STANDARD_STATS.defense}, SPD ${STANDARD_STATS.speed}`
    );
    console.log(
        `Samples: ${CONFIG.samples} seeds x both start positions | target uplift: ${formatPercent(CONFIG.targetUplift)}`
    );
    console.log("\nEach result is position-normalized against the no-bonus match with the same seed.");

    const targets = {};
    for (const [stat, candidates] of Object.entries(STAT_CANDIDATES)) {
        const results = candidates.map((amount) => ({ amount, ...measureUplift(stat, amount) }));
        const target = findTargetCandidate(results);
        targets[stat] = target;

        console.log(`\n[${stat}]`);
        for (const result of results) {
            console.log(
                `  +${result.amount}: ${formatPercent(result.uplift)} (KO ${result.knockoutMatches}, HP ratio ${result.hpRatioMatches})`
            );
        }
        console.log(target ? `  target: +${target.amount}` : "  target: not reached in this scan");
    }

    const reference = Object.entries(targets)
        .filter(([, result]) => result)
        .map(([stat, result]) => `${stat.toUpperCase()} +${result.amount}`)
        .join(" = ");
    console.log(`\nSuggested equal-value reference: ${reference || "no target candidates reached"}`);
}

main();
