import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createRoster } from "../src/roster.js";
import { HUNTING_ENEMY_TYPES, HUNTING_MONSTER_TYPES, HUNTING_STAGE_IDS } from "../src/hunting/huntingConfig.js";
import { getHuntingBattleArena, scaleEnemySpecForHunting } from "../src/hunting/huntingEncounters.js";
import { HUNTING_TEAMS, createHuntingMobSpec } from "../src/hunting/huntingMonsters.js";

const OUTPUT_PATH = fileURLToPath(new URL("../src/hunting/eliteMobCombinations.js", import.meta.url));
const GENERATOR_VERSION = "1";
const RULE_VERSION = "elite-mob-combination-v1";
const STEP = 1 / 60;

function readPositiveIntegerOption(name, fallback, minimum = 1) {
    const index = process.argv.findIndex((argument) => argument === name);
    if (index < 0) return fallback;
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

const CONFIG = Object.freeze({
    seed: readPositiveIntegerOption("--seed", 20260714),
    candidatesPerSize: readPositiveIntegerOption("--candidates", 48),
    repetitions: readPositiveIntegerOption("--repetitions", 2),
    maxSeconds: readPositiveIntegerOption("--max-seconds", 30),
    floor: readPositiveIntegerOption("--floor", 50),
    stageId: HUNTING_STAGE_IDS.CAVE,
    sizes: Object.freeze([3, 4, 5]),
    winningRemainingHpWeight: 0.01,
    step: STEP
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

function withDeterministicSimulationEnvironment(seed, callback) {
    const previousRandom = Math.random;
    const previousNow = performance.now;
    let elapsedMs = 0;
    Math.random = createSeededRng(seed);
    performance.now = () => elapsedMs;
    try {
        return callback({ advanceClock: (delta) => (elapsedMs += delta * 1000) });
    } finally {
        Math.random = previousRandom;
        performance.now = previousNow;
    }
}

function getUniqueMonsterTypes() {
    return Object.freeze([...new Set(Object.values(HUNTING_MONSTER_TYPES))].sort());
}

function createCanonicalCombination(monsterTypes) {
    return Object.freeze([...monsterTypes].sort());
}

function createCandidateCombinations(size, monsterTypes, rng) {
    const combinations = new Map();
    const maxAttempts = CONFIG.candidatesPerSize * 100;
    let attempts = 0;
    while (combinations.size < CONFIG.candidatesPerSize && attempts < maxAttempts) {
        const candidate = createCanonicalCombination(
            Array.from({ length: size }, () => monsterTypes[Math.floor(rng() * monsterTypes.length)])
        );
        combinations.set(candidate.join("+"), candidate);
        attempts += 1;
    }
    if (combinations.size < CONFIG.candidatesPerSize) {
        throw new Error(
            `Only generated ${combinations.size}/${CONFIG.candidatesPerSize} unique size-${size} combinations`
        );
    }
    return [...combinations.values()];
}

function createPlayerSpec(base) {
    return {
        ...base,
        teamId: HUNTING_TEAMS.PLAYER,
        stats: { ...base.stats },
        appearance: { ...(base.appearance ?? {}) }
    };
}

function createEliteMobSpecs(monsterTypes) {
    return monsterTypes.map((type, index) =>
        scaleEnemySpecForHunting(
            createHuntingMobSpec({ type, floor: CONFIG.floor, index, stageId: CONFIG.stageId, rng: Math.random }),
            CONFIG.floor,
            { enemyType: HUNTING_ENEMY_TYPES.ELITE }
        )
    );
}

function disableVisualEffects(simulation) {
    simulation.addSparkBurst = () => {};
    simulation.spawnExplosion = () => {};
    simulation.spawnPulse = () => {};
    simulation.spawnDeathExplosion = () => {};
    simulation.updateOvertimeParticles = () => {};
}

function getEnemyHpRatio(enemyBalls) {
    const totalMaxHp = enemyBalls.reduce((sum, ball) => sum + ball.maxHp, 0);
    if (totalMaxHp <= 0) return 0;
    const totalHp = enemyBalls.reduce((sum, ball) => sum + Math.max(0, ball.hp), 0);
    return totalHp / totalMaxHp;
}

function getMatchSeed(size, playerIndex, repetition) {
    return CONFIG.seed + size * 100_000 + playerIndex * 100 + repetition;
}

function runMatch({ monsterTypes, playerSpec, playerIndex, repetition }) {
    return withDeterministicSimulationEnvironment(
        getMatchSeed(monsterTypes.length, playerIndex, repetition),
        ({ advanceClock }) => {
            const enemySpecs = createEliteMobSpecs(monsterTypes);
            const arena = getHuntingBattleArena(CONFIG.stageId, enemySpecs.length);
            const simulation = new BattleSimulation(
                [createPlayerSpec(playerSpec), ...enemySpecs],
                { onLog() {}, onSound() {} },
                null,
                {
                    assignActions: false,
                    arenaWidth: arena.WIDTH,
                    arenaHeight: arena.HEIGHT,
                    hostileAbsenceGraceDuration: 1,
                    hostileAbsenceGraceTeamId: HUNTING_TEAMS.PLAYER
                }
            );
            disableVisualEffects(simulation);

            while (!simulation.finished && simulation.elapsed < CONFIG.maxSeconds) {
                advanceClock(CONFIG.step);
                simulation.update(CONFIG.step, CONFIG.step);
            }

            const enemyBalls = simulation.fighters.filter((fighter) => fighter.teamId === HUNTING_TEAMS.ENEMY);
            return {
                monsterWon: simulation.finished && simulation.winner?.teamId === HUNTING_TEAMS.ENEMY,
                timedOut: !simulation.finished,
                remainingHpRatio: getEnemyHpRatio(enemyBalls)
            };
        }
    );
}

function roundMetric(value) {
    return Number(value.toFixed(6));
}

function evaluateCombination(monsterTypes, roster) {
    const results = roster.flatMap((playerSpec, playerIndex) =>
        Array.from({ length: CONFIG.repetitions }, (_, repetition) =>
            runMatch({ monsterTypes, playerSpec, playerIndex, repetition })
        )
    );
    const wins = results.filter((result) => result.monsterWon);
    const monsterWinRate = wins.length / results.length;
    const winningRemainingHpRatio = wins.length
        ? wins.reduce((sum, result) => sum + result.remainingHpRatio, 0) / wins.length
        : 0;
    return Object.freeze({
        matches: results.length,
        wins: wins.length,
        timeoutMatches: results.filter((result) => result.timedOut).length,
        monsterWinRate: roundMetric(monsterWinRate),
        winningRemainingHpRatio: roundMetric(winningRemainingHpRatio),
        score: roundMetric(monsterWinRate + winningRemainingHpRatio * CONFIG.winningRemainingHpWeight)
    });
}

function compareCandidates(a, b) {
    if (b.metrics.monsterWinRate !== a.metrics.monsterWinRate)
        return b.metrics.monsterWinRate - a.metrics.monsterWinRate;
    if (b.metrics.winningRemainingHpRatio !== a.metrics.winningRemainingHpRatio) {
        return b.metrics.winningRemainingHpRatio - a.metrics.winningRemainingHpRatio;
    }
    if (b.metrics.score !== a.metrics.score) return b.metrics.score - a.metrics.score;
    return a.monsterTypes.join("+").localeCompare(b.monsterTypes.join("+"));
}

function createCombinationId(size, rank, monsterTypes) {
    return `elite-${size}-${rank}-${monsterTypes.join("-")}`;
}

function generateResults() {
    const monsterTypes = getUniqueMonsterTypes();
    const roster = createRoster();
    const rng = createSeededRng(CONFIG.seed);
    const rankedCandidates = CONFIG.sizes.map((size) => {
        const candidates = createCandidateCombinations(size, monsterTypes, rng)
            .map((candidate) => ({ monsterTypes: candidate, metrics: evaluateCombination(candidate, roster) }))
            .sort(compareCandidates);
        return Object.freeze({ size, candidates: Object.freeze(candidates) });
    });
    const combinations = rankedCandidates.map(({ size, candidates }) => {
        const best = candidates[0];
        return Object.freeze({
            id: createCombinationId(size, 1, best.monsterTypes),
            size,
            monsterTypes: best.monsterTypes,
            metrics: best.metrics
        });
    });
    return Object.freeze({
        metadata: Object.freeze({
            generatorVersion: GENERATOR_VERSION,
            ruleVersion: RULE_VERSION,
            generatedAt: "reproducible",
            seed: CONFIG.seed,
            candidateCountPerSize: CONFIG.candidatesPerSize,
            repetitionsPerCharacter: CONFIG.repetitions,
            playerRosterCount: roster.length,
            maxSeconds: CONFIG.maxSeconds,
            floor: CONFIG.floor,
            stageId: CONFIG.stageId,
            uniqueMonsterTypes: monsterTypes,
            scoreFormula: `monsterWinRate + winningRemainingHpRatio * ${CONFIG.winningRemainingHpWeight}`,
            winningRemainingHpWeight: CONFIG.winningRemainingHpWeight
        }),
        combinations,
        rankedCandidates
    });
}

function formatGenerationMetadata(metadata) {
    const monsterTypes = metadata.uniqueMonsterTypes.map((type) => `        ${JSON.stringify(type)}`).join(",\n");
    return `{
    generatorVersion: ${JSON.stringify(metadata.generatorVersion)},
    ruleVersion: ${JSON.stringify(metadata.ruleVersion)},
    generatedAt: ${JSON.stringify(metadata.generatedAt)},
    seed: ${metadata.seed},
    candidateCountPerSize: ${metadata.candidateCountPerSize},
    repetitionsPerCharacter: ${metadata.repetitionsPerCharacter},
    playerRosterCount: ${metadata.playerRosterCount},
    maxSeconds: ${metadata.maxSeconds},
    floor: ${metadata.floor},
    stageId: ${JSON.stringify(metadata.stageId)},
    uniqueMonsterTypes: [
${monsterTypes}
    ],
    scoreFormula: ${JSON.stringify(metadata.scoreFormula)},
    winningRemainingHpWeight: ${metadata.winningRemainingHpWeight}
}`;
}

function formatCombination(combination) {
    const metrics = combination.metrics;
    return `    Object.freeze({
        id: ${JSON.stringify(combination.id)},
        size: ${combination.size},
        monsterTypes: Object.freeze(${JSON.stringify(combination.monsterTypes).replaceAll(",", ", ")}),
        metrics: Object.freeze({
            matches: ${metrics.matches},
            wins: ${metrics.wins},
            timeoutMatches: ${metrics.timeoutMatches},
            monsterWinRate: ${metrics.monsterWinRate},
            winningRemainingHpRatio: ${metrics.winningRemainingHpRatio},
            score: ${metrics.score}
        })
    })`;
}

function createRuntimeModule(results) {
    const combinations = results.combinations.map((combination) => formatCombination(combination)).join(",\n");
    return `// This file is generated by scripts/generateEliteMobCombinations.mjs --write.\n// Run npm run hunting:elite-combinations after changing hunting monster definitions, behavior, or generation rules.\n\nexport const ELITE_MOB_COMBINATION_GENERATION = Object.freeze(${formatGenerationMetadata(results.metadata)});\n\nexport const ELITE_MOB_COMBINATIONS = Object.freeze([\n${combinations}\n]);\n\nexport function getEliteMobCombination(combinationId) {\n    return ELITE_MOB_COMBINATIONS.find((combination) => combination.id === combinationId) ?? null;\n}\n\nexport function pickEliteMobCombination(rng = Math.random) {\n    const index = Math.floor(Math.max(0, Math.min(0.999999, rng())) * ELITE_MOB_COMBINATIONS.length);\n    return ELITE_MOB_COMBINATIONS[index] ?? ELITE_MOB_COMBINATIONS[0];\n}\n`;
}

function printResults(results, willWrite) {
    console.log("Elite mob combination generator");
    console.log(JSON.stringify(results.metadata));
    results.rankedCandidates.forEach(({ size, candidates }) => {
        console.log(`[${size}] top candidates`);
        candidates.slice(0, 3).forEach((candidate, index) => {
            const metrics = candidate.metrics;
            console.log(
                `  #${index + 1} ${candidate.monsterTypes.join(", ")} | ` +
                    `win ${(metrics.monsterWinRate * 100).toFixed(2)}% | ` +
                    `winner HP ${(metrics.winningRemainingHpRatio * 100).toFixed(2)}% | ` +
                    `score ${metrics.score.toFixed(6)} | timeouts ${metrics.timeoutMatches}/${metrics.matches}`
            );
        });
    });
    console.log(willWrite ? `Writing ${OUTPUT_PATH}` : `Preview only. Run with --write to update ${OUTPUT_PATH}`);
}

function main() {
    const write = process.argv.includes("--write");
    const results = generateResults();
    const moduleSource = createRuntimeModule(results);
    const existing = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf8") : null;
    printResults(results, write);

    if (!write) {
        console.log(
            existing === moduleSource
                ? "Generated runtime data is already current."
                : "Generated runtime data would change."
        );
        return;
    }

    writeFileSync(OUTPUT_PATH, moduleSource, "utf8");
    console.log(
        existing === moduleSource ? "Generated runtime data was already current." : "Generated runtime data updated."
    );
}

main();
