import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { aggregateBattleMetrics, BattleMetricsRecorder } from "../src/simulation/battleMetrics.js";
import { applyEquipmentStats } from "../src/hunting/equipmentConfig.js";
import { addEquipmentQuantity, equipEquipmentTemplate } from "../src/hunting/equipmentInventory.js";
import { createHuntingMobEncounter } from "../src/hunting/huntingMonsters.js";
import { getHuntingBattleArena } from "../src/hunting/huntingEncounters.js";
import { EQUIPMENT_TEMPLATES } from "../src/hunting/equipmentTemplates.js";
import { createDefaultPlayerProfile } from "../src/playerProfile.js";
import { createRoster } from "../src/roster.js";

function readNumber(name, fallback, minimum = 0) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

function readList(name, fallback) {
    return (
        process.env[name]
            ?.split(",")
            .map((value) => value.trim())
            .filter(Boolean) ?? fallback
    ).filter(Boolean);
}

const CONFIG = Object.freeze({
    seeds: readNumber("METRICS_SEEDS", 2, 1),
    maxSeconds: readNumber("METRICS_MAX_SECONDS", 75, 1),
    characters: readList("METRICS_CHARACTERS", ["rage", "archer", "hero"]),
    stages: readList("METRICS_STAGES", ["cave", "forest", "desert"]),
    floors: readList("METRICS_FLOORS", ["4", "18", "34"]).map((value) => Math.max(1, Number(value) || 1)),
    seed: readNumber("METRICS_SEED", 20260730),
    step: 1 / 60
});

const COMPLETED_TEMPLATE_IDS = EQUIPMENT_TEMPLATES.filter((template) => template.tier === "completed").map(
    (template) => template.id
);

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

function createEquippedSpec(characterId, templateId) {
    const profile = createDefaultPlayerProfile();
    if (templateId) {
        addEquipmentQuantity(profile, templateId);
        equipEquipmentTemplate(profile, templateId, 0);
    }
    const source = createRoster().find((fighter) => fighter.id === characterId);
    if (!source) throw new Error(`Unknown character: ${characterId}`);
    return applyEquipmentStats(source, profile);
}

function disableVisualEffects(simulation) {
    simulation.addSparkBurst = () => {};
    simulation.spawnExplosion = () => {};
    simulation.spawnPulse = () => {};
    simulation.spawnDeathExplosion = () => {};
    simulation.updateOvertimeParticles = () => {};
}

function decideTimedOutResult(player, enemies) {
    const playerRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0;
    const enemyRatio = enemies.length
        ? enemies.reduce((sum, enemy) => sum + (enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0), 0) / enemies.length
        : 0;
    if (playerRatio === enemyRatio) return { winner: null, loser: null };
    return playerRatio > enemyRatio ? { winner: player, loser: enemies[0] ?? null } : { winner: null, loser: player };
}

function runMatch({ seed, characterId, stageId, floor, templateId }) {
    const originalRandom = Math.random;
    const rng = createSeededRng(seed);
    Math.random = rng;
    try {
        const enemies = createHuntingMobEncounter({ floor, stageId, rng });
        const arena = getHuntingBattleArena(stageId, enemies.length);
        const recorder = new BattleMetricsRecorder();
        const simulation = new BattleSimulation(
            [createEquippedSpec(characterId, templateId), ...enemies],
            {
                onLog() {},
                onSound() {},
                onDamageResolved: (event) => recorder.recordDamage(event),
                onEquipmentPassiveTriggered: (event) => recorder.recordEquipmentPassiveTrigger(event)
            },
            null,
            { assignActions: true, rng, width: arena.WIDTH, height: arena.HEIGHT }
        );
        disableVisualEffects(simulation);
        if (templateId) recorder.trackEquipment(templateId, simulation.fighters[0].id);
        while (!simulation.finished && simulation.elapsed < CONFIG.maxSeconds)
            simulation.update(CONFIG.step, CONFIG.step);
        const player = simulation.fighters[0];
        const timedOutResult = simulation.finished ? null : decideTimedOutResult(player, simulation.fighters.slice(1));
        return recorder.snapshot({
            elapsed: simulation.elapsed,
            winner: simulation.winner ?? timedOutResult?.winner,
            loser: simulation.loser ?? timedOutResult?.loser,
            fighters: simulation.fighters,
            timedOut: !simulation.finished,
            focalFighterId: player.id
        });
    } finally {
        Math.random = originalRandom;
    }
}

function createScenarios() {
    const scenarioCount = Math.max(CONFIG.characters.length, CONFIG.stages.length, CONFIG.floors.length);
    return Array.from({ length: scenarioCount }, (_, index) => {
        const characterId = CONFIG.characters[index % CONFIG.characters.length];
        const stageId = CONFIG.stages[index % CONFIG.stages.length];
        const floor = CONFIG.floors[index % CONFIG.floors.length];
        return Array.from({ length: CONFIG.seeds }, (_, seedIndex) => ({
            seed: CONFIG.seed + index * 10_000 + seedIndex,
            characterId,
            stageId,
            floor
        }));
    }).flat();
}

function formatPercent(value) {
    return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
    return Number(value).toFixed(2);
}

function getCandidateNote(metrics, templateId, winRateChange, durationChange) {
    const entry = metrics.equipment[templateId];
    const notes = [];
    if (winRateChange >= 0.2 || durationChange <= -0.25 || entry?.directDamageRatio > 0.35) notes.push("과대 후보");
    if (!entry?.triggersPerMatch) notes.push("미발동");
    if (entry?.triggersPerMatch > 0 && !entry.directDamagePerMatch) notes.push("직접 피해 외 효과");
    return notes.length ? notes.join("·") : "관측";
}

function main() {
    const scenarios = createScenarios();
    const baseline = aggregateBattleMetrics(scenarios.map((scenario) => runMatch({ ...scenario, templateId: null })));
    console.log("완성 장비 사냥터 패시브 메트릭");
    console.log(
        `표본: ${scenarios.length}경기 (seed ${CONFIG.seeds}, 캐릭터 ${CONFIG.characters.join(", ")}, 최대 ${CONFIG.maxSeconds}초)`
    );
    console.log(
        "장비 | 승률 변화 | 평균 시간 변화 | 중앙값 | p90 | 경기당 발동 | 직접 피해 | 소유자 전체 피해 대비 | 판정"
    );
    for (const templateId of COMPLETED_TEMPLATE_IDS) {
        const metrics = aggregateBattleMetrics(scenarios.map((scenario) => runMatch({ ...scenario, templateId })));
        const entry = metrics.equipment[templateId] ?? {
            triggersPerMatch: 0,
            directDamagePerMatch: 0,
            directDamageRatio: 0
        };
        const durationChange = baseline.duration.average
            ? (metrics.duration.average - baseline.duration.average) / baseline.duration.average
            : 0;
        const winRateChange = metrics.winRate - baseline.winRate;
        console.log(
            [
                templateId,
                formatPercent(winRateChange).replace("%", "%p"),
                formatPercent(durationChange),
                formatNumber(metrics.duration.median),
                formatNumber(metrics.duration.p90),
                formatNumber(entry.triggersPerMatch),
                formatNumber(entry.directDamagePerMatch),
                formatPercent(entry.directDamageRatio),
                getCandidateNote(metrics, templateId, winRateChange, durationChange)
            ].join(" | ")
        );
    }
}

main();
