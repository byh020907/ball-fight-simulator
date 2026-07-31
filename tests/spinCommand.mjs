import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createSimulation({ abilityCommandEnabled = true } = {}) {
    const results = [];
    const uses = [];
    const spin = createRoster().find((fighter) => fighter.id === "spin");
    const opponent = createRoster().find((fighter) => fighter.id !== "spin");
    const simulation = new BattleSimulation(
        [spin, opponent],
        {
            onLog() {},
            onSound() {},
            onAbilityResult: (event) => results.push(event),
            onAbilityUsed: (event) => uses.push(event)
        },
        null,
        { assignActions: false, dragCombatEnabled: true, abilityCommandEnabled, commandResource: true }
    );
    simulation.setPlayerBall(simulation.fighters[0]);
    simulation.playerBall.position = new Vector2(200, 300);
    simulation.fighters[1].position = new Vector2(500, 300);
    const ability = simulation.playerBall.abilities.getByAbilityId("spin");
    return { simulation, ability, target: simulation.fighters[1], results, uses };
}

function prepare(ability, sequence = 1) {
    return ability.prepareCommand({
        sequence,
        direction: { x: 1, y: 0 },
        pathSegments: [
            { x: 320, y: 300 },
            { x: 500, y: 300 }
        ],
        bouncePoints: [],
        predictedTerminal: { x: 500, y: 300 },
        createdAt: 2
    });
}

function releaseCommand(simulation, pointerId = 1) {
    assert.deepEqual(simulation.beginDragCombat(pointerId, { x: 20, y: 20 }), { type: "begin" });
    assert.equal(simulation.moveDragCombat(pointerId, { x: -120, y: 20 }).active, true);
    return simulation.releaseDragCombat(pointerId);
}

{
    const { simulation, ability } = createSimulation({ abilityCommandEnabled: false });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
    assert.equal(prepare(ability, 1).sequence, 1);
    assert.equal(ability.state.commandIntents.size, 0, "flag-off Spin must keep the generic path");
    simulation.abilityCommandEnabled = true;
    ability.state.timeWithoutCollision = 0;
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: true });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    assert.deepEqual(ability.getCommandState(), { available: true, reserveResource: false });
    ability.state.cut = {};
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: true });
    ability.state.cut = null;
    simulation.dragCombat.automated = true;
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
    simulation.dragCombat.automated = false;
    simulation.playerBall = simulation.fighters[1];
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
}

{
    const { simulation, ability } = createSimulation();
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    const resourceBefore = simulation.commandResource.amount;
    const release = releaseCommand(simulation, 7);
    assert.equal(release.type, "launch");
    assert.equal(simulation.commandResource.amount, resourceBefore - 1, "valid release spends one resource");
    assert.equal(simulation.dragCombat.shot.active, true, "Spin command remains a default player shot");
    assert.ok(simulation.playerBall.velocity.length() > 0, "default shot applies velocity once");
    assert.equal(ability.state.commandIntents.size, 1, "release creates one Spin command intent");

    ability.state.timeWithoutCollision = ability.getMaxChargeTime() * 0.5;
    assert.deepEqual(
        ability.resolveCommandLaunch({ sequence: 1 }),
        { mode: "default-shot" },
        "charge loss before release falls back to one default shot"
    );
    assert.equal(ability.state.commandIntents.size, 0, "low charge fallback discards the empty Spin cycle");
}

{
    const { ability, target, results, uses, simulation } = createSimulation();
    ability.setContext({ abilityTier: 3 });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 7);
    ability.onCommandBounce({ commandSequence: 7 }, { context: { wall: true } });
    ability.onCommandBounce({ commandSequence: 7 }, { context: { terrain: true } });
    ability.onCommandBounce({ commandSequence: 7 }, { context: { wall: true } });
    const context = { deferredSpinCut: {} };
    const resolution = ability.resolveCommandCollision(
        { commandSequence: 7, target, type: "rear-hit", contactPoint: target.position.clone() },
        { context }
    );
    assert.deepEqual(resolution, { handled: true, runDefaultOnCollision: false });
    assert.equal(ability.getChargeProgress(), 0.5, "three bounces retain the capped 50% charge");
    assert.equal(uses.length, 1, "hostile cashout records usage exactly once");
    simulation.elapsed = 4;
    ability.onFighterCollisionDamageResolved(target, 12, context);
    ability.onFighterCollisionDamageResolved(target, 12, context);
    assert.equal(results.length, 1, "terminal collision records one result");
    assert.deepEqual(results[0].value, {
        tier: 3,
        chargeRatio: 1,
        plannedSegments: 2,
        bounces: 3,
        retainedCharge: 0.5,
        directDamage: 12,
        surfaceCut: true,
        rearHit: true,
        countered: false,
        elapsed: 2
    });
    assert.equal(results[0].success, true);
}

for (const [sequence, bounces, expectedRetention] of [
    [20, 0, 0],
    [21, 1, 0.25],
    [22, 2, 0.5],
    [23, 3, 0.5]
]) {
    const { ability, target, results } = createSimulation();
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, sequence);
    for (const _ of Array.from({ length: bounces })) {
        ability.onCommandBounce({ commandSequence: sequence }, { context: { wall: true } });
    }
    const context = {};
    ability.resolveCommandCollision({ commandSequence: sequence, target, type: "plain-hit" }, { context });
    ability.onFighterCollisionDamageResolved(target, 4, context);
    assert.equal(results[0].value.retainedCharge, expectedRetention, `${bounces} bounces preserve the contract ratio`);
    assert.equal(ability.getChargeProgress(), expectedRetention, "retained charge becomes the next Spin charge state");
}

{
    const { ability, target, results, uses } = createSimulation();
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 8);
    const context = {};
    ability.resolveCommandCollision({ commandSequence: 8, target, type: "shield-counter" }, { context });
    ability.onFighterCollisionDamageResolved(target, 0, context);
    assert.equal(results[0].success, false, "shield counter is a failed result");
    assert.equal(results[0].value.countered, true);
    assert.equal(uses.length, 1, "shield counter still cashes out Spin usage once");
}

{
    const { ability, target, results } = createSimulation();
    ability.setContext({ abilityTier: 3 });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 30);
    const context = {};
    ability.resolveCommandCollision({ commandSequence: 30, target, type: "plain-hit" }, { context });
    ability.onFighterCollisionDamageResolved(target, 4, context);
    assert.equal(results[0].value.surfaceCut, false, "tier and charge alone cannot claim a deferred cut");

    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 31);
    const deferredContext = { deferredSpinCut: {} };
    ability.resolveCommandCollision({ commandSequence: 31, target, type: "plain-hit" }, { context: deferredContext });
    ability.onFighterCollisionDamageResolved(target, 4, deferredContext);
    assert.equal(results[1].value.surfaceCut, true, "actual deferred cut context is recorded");
}

{
    const { ability, results } = createSimulation();
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 9);
    ability.onCommandEnd({ commandSequence: 9, reason: "expired" });
    ability.onCommandEnd({ commandSequence: 9, reason: "expired" });
    assert.equal(results.length, 1, "expired command records one failed result without a charge cashout");
    assert.equal(results[0].success, false);
    assert.equal(results[0].value.retainedCharge, 0);
}

for (const reason of ["miss", "replaced", "reset", "battle-end"]) {
    const { ability, results } = createSimulation();
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, reason.length + 40);
    ability.onCommandBounce({ commandSequence: reason.length + 40 }, { context: { wall: true } });
    if (reason === "battle-end") ability.onBattleEnded();
    else ability.onCommandEnd({ commandSequence: reason.length + 40, reason });
    ability.onBattleEnded();
    assert.equal(results.length, 1, `${reason} settles one failed result`);
    assert.equal(results[0].value.bounces, 1, `${reason} preserves observed bounces`);
    assert.equal(results[0].value.retainedCharge, 0, `${reason} cannot retain charge without hostile cashout`);
    assert.equal(results[0].value.surfaceCut, false);
}

{
    const text = formatAbilityResult("spin-command-gyro-bank", {
        attemptsPerMatch: 1,
        successRate: 0.5,
        values: [{ chargeRatio: 1, plannedSegments: 2, bounces: 1, retainedCharge: 0.25, directDamage: 4 }]
    });
    assert.match(text, /반사 1.00/);
    assert.doesNotMatch(text, /NaN|Infinity/);
    assert.doesNotMatch(
        formatAbilityResult("spin-command-gyro-bank", { attemptsPerMatch: NaN, successRate: Infinity, values: [] }),
        /NaN|Infinity/
    );
}

console.log("[spin-command] ok");
