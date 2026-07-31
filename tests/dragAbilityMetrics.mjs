import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createDragAbilityMetricsConfig } from "../scripts/dragAbilityMetricsConfig.mjs";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createRoster } from "../src/roster.js";

const rosterIds = ["rage", "archer", "hero", "phantom", "trickster", "bat_ball", "eater"];

{
    const config = createDragAbilityMetricsConfig({}, rosterIds);
    assert.equal(config.seeds, 1);
    assert.equal(config.maxSeconds, 75);
    assert.deepEqual(config.abilityTiers, [0]);
    assert.deepEqual(config.characters, rosterIds);
    assert.deepEqual(config.stages, ["cave", "forest", "desert"]);
    assert.deepEqual(config.floors, [6, 20, 36]);
    assert.equal(config.commandResourcePrototype, false);
    assert.equal(config.abilityCommandPrototype, false);
    assert.ok(Object.isFrozen(config));
    assert.ok(Object.isFrozen(config.characters));
    assert.ok(Object.isFrozen(config.abilityTiers));
    assert.throws(() => config.abilityTiers.push(3), TypeError);
    assert.throws(() => config.characters.push("other"), TypeError);
}

{
    const config = createDragAbilityMetricsConfig(
        {
            METRICS_PROFILE: "long",
            METRICS_SEEDS: "4",
            METRICS_MAX_SECONDS: "12",
            METRICS_ABILITY_TIERS: "3,0,3,1"
        },
        rosterIds
    );
    assert.equal(config.seeds, 4);
    assert.equal(config.maxSeconds, 12);
    assert.deepEqual(config.abilityTiers, [3, 0, 1]);
    assert.equal(createDragAbilityMetricsConfig({ METRICS_PROFILE: "long" }, rosterIds).seeds, 10);
    assert.equal(createDragAbilityMetricsConfig({ METRICS_PROFILE: "long" }, rosterIds).maxSeconds, 120);
}

for (const environment of [
    { METRICS_PROFILE: "unknown" },
    { METRICS_ABILITY_TIERS: "-1" },
    { METRICS_ABILITY_TIERS: "4" },
    { METRICS_ABILITY_TIERS: "1.5" },
    { METRICS_ABILITY_TIERS: "one" },
    { METRICS_ABILITY_TIERS: "" }
]) {
    assert.throws(() => createDragAbilityMetricsConfig(environment, rosterIds));
}

const formatterCases = [
    [
        "rage-command-cashout",
        {
            attemptsPerMatch: 1,
            successRate: 0.5,
            values: [{ chargeRatio: 0.7, chargeTier: 2, abilityDamage: 8, directDamage: 4, earlyReset: true }]
        },
        "조기 초기화 100.0%"
    ],
    [
        "archer-command-shot",
        {
            attemptsPerMatch: 1,
            successRate: 0.5,
            values: [{ wallSegmentsFollowed: 2, plannedSegments: 3, elapsed: 1.2, secondShotHit: null }]
        },
        "후속 적중 0.0% (표본 0)"
    ],
    [
        "hero-command-core-cycle",
        { attemptsPerMatch: 1, successRate: 1, values: [{ released: 4, collected: 3, shield: 5, heal: 6 }] },
        "회수율 75.0%"
    ],
    [
        "phantom-command-chain",
        {
            attemptsPerMatch: 1,
            successRate: 1,
            values: [{ safeAppear: true, baseHit: true, chainDepth: 2, finishHit: true }]
        },
        "종결 적중 100.0%"
    ],
    [
        "trickster-command-route",
        {
            attemptsPerMatch: 1,
            successRate: 0.5,
            values: [
                {
                    launched: 3,
                    enemySeedContacts: 2,
                    ownerSeedTriggers: 1,
                    seedBursts: 1,
                    followupSeeds: 1,
                    plannedSegments: 2,
                    plannedBounces: 1,
                    elapsed: 1.2
                }
            ]
        },
        "적 접촉 2.00"
    ],
    [
        "bat-ball-command-called-shot",
        {
            attemptsPerMatch: 1,
            successRate: 0.5,
            values: [
                {
                    slashDamage: 20,
                    wallSlamImpacts: 1,
                    wallSlamDamage: 15,
                    firstWallDistance: 300,
                    homeRunMultiplier: 1.2,
                    resetTriggered: true,
                    plannedSegments: 2,
                    plannedBounces: 1,
                    elapsed: 0.85
                }
            ]
        },
        "Wall Slam 1.00회/15.00 피해"
    ],
    [
        "eater-command-spit-route",
        {
            attemptsPerMatch: 1,
            successRate: 1,
            values: [{ digestionTicksAtLaunch: 2, wallSlamDamage: 15, spitImpactDamage: 10, ruptureTriggered: true }]
        },
        "Spit Impact 10.00 피해"
    ]
];

for (const [type, result, expected] of formatterCases) {
    const text = formatAbilityResult(type, result);
    assert.ok(text.includes(expected));
    assert.doesNotMatch(text, /NaN|Infinity/);
}

assert.doesNotMatch(
    formatAbilityResult("unknown", { attemptsPerMatch: Infinity, successRate: NaN, values: [null] }),
    /NaN|Infinity/
);

for (const tier of [0, 3]) {
    const roster = createRoster();
    const phantom = roster.find((fighter) => fighter.id === "phantom");
    const opponent = roster.find((fighter) => fighter.id === "rage");
    const simulation = new BattleSimulation([phantom, opponent], { onLog() {}, onSound() {} }, null, {
        assignActions: false
    });
    simulation.setPlayerBall(simulation.fighters[0]);
    simulation.playerBall.progression.abilityTier = tier;
    const ability = simulation.playerBall.abilities.getByAbilityId("phantom");
    assert.equal(ability.abilityTier, tier);
    assert.equal(Boolean(ability.getLevelUpgrade().shadowFinish), tier === 3);
}

const cliOutput = execFileSync(process.execPath, ["scripts/dragAbilityMetrics.mjs"], {
    cwd: process.cwd(),
    env: {
        ...process.env,
        METRICS_SEEDS: "1",
        METRICS_MAX_SECONDS: "1",
        METRICS_STAGES: "cave",
        METRICS_FLOORS: "6",
        METRICS_CHARACTERS: "phantom",
        METRICS_ABILITY_TIERS: "0,3",
        METRICS_COMMAND_RESOURCE_PROTOTYPE: "1",
        METRICS_ABILITY_COMMAND_PROTOTYPE: "1"
    },
    encoding: "utf8"
});
assert.match(cliOutput, /ability tier=0/);
assert.match(cliOutput, /ability tier=3/);

console.log("[drag-ability-metrics] ok");
