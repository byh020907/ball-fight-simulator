import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createSimulation(options = {}) {
    const roster = createRoster();
    const dash = roster.find((fighter) => fighter.id === "dash");
    const opponent = roster.find((fighter) => fighter.id === "rage");
    const results = [];
    const simulation = new BattleSimulation(
        [dash, opponent],
        { onLog() {}, onSound() {}, onAbilityResult: (event) => results.push(event) },
        null,
        {
            assignActions: false,
            dragCombatEnabled: true,
            abilityCommandEnabled: true,
            commandResourceEnabled: true,
            ...options
        }
    );
    simulation.setPlayerBall(simulation.fighters[0]);
    const [owner, target] = simulation.fighters;
    owner.position = new Vector2(400, 400);
    target.position = new Vector2(600, 400);
    owner.abilities.primary.setCooldownRemaining(0);
    return { simulation, owner, target, ability: owner.abilities.primary, results };
}

function openCommand(context) {
    context.ability.setCooldownRemaining(0);
    context.ability.update(0, context.target);
    assert.equal(context.ability.state.commandWindow?.remaining, 0.8);
}

for (const level of [0, 1, 2]) {
    const context = createSimulation();
    context.ability.state.cooldownLevel = level;
    openCommand(context);
    assert.deepEqual(context.ability.getCommandState(), { available: true, reserveResource: false });
}

{
    const context = createSimulation();
    openCommand(context);
    const start = context.owner.position;
    context.simulation.beginDragCombat(1, start);
    context.simulation.moveDragCombat(1, { x: start.x - 140, y: start.y });
    context.simulation.releaseDragCombat(1);
    const effect = context.owner.state.movement;
    assert.equal(context.simulation.dragCombat.getSnapshot().playerShot.active, false);
    assert.equal(effect.commandSequence, 1);
    assert.ok(context.owner.state.forcedHeading, "command Dash creates the existing forced heading");
    assert.equal(
        context.simulation.commandResource.amount,
        0.35,
        "valid manual Dash spends once before existing ability recovery"
    );
    assert.ok(effect.getSpeed(context.owner) > 0, "existing Dash movement starts");
    context.ability.onDashHit(context.target, effect);
    context.owner.clearDash();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1);
    assert.equal(context.results[0].success, true, JSON.stringify(context.results[0]));
    assert.deepEqual(Object.keys(context.results[0].value).sort(), [
        "cooldownLevelAfter",
        "cooldownLevelAtLaunch",
        "dashHit",
        "elapsed",
        "ignitionTargets",
        "laserDamage",
        "laserHitSegments",
        "plannedBounces",
        "plannedSegments",
        "tier",
        "wallFailed"
    ]);
}

for (const fallback of ["timeout", "cancel"]) {
    const context = createSimulation();
    openCommand(context);
    if (fallback === "timeout") context.ability.update(0.81, context.target);
    else {
        context.simulation.dragCombat.input.state = "aiming";
        context.ability.update(0, context.target);
        context.simulation.dragCombat.input.state = "idle";
        context.ability.update(0, context.target);
    }
    assert.ok(context.simulation.commandResource.amount >= 1, "fallback does not spend command resource");
    assert.equal(context.results.length, 0);
    assert.ok(context.owner.state.movement);
    assert.equal(context.owner.state.movement.commandSequence, null);
}

{
    const context = createSimulation();
    openCommand(context);
    context.target.flags.defeated = true;
    context.ability.update(0.1, context.target);
    assert.equal(context.ability.state.commandWindow, null);
    assert.equal(context.ability.cooldownReady, true);
    assert.equal(context.simulation.commandResource.amount, 1);
}

for (const options of [{ abilityCommandEnabled: false }, { commandResource: { initial: 0 } }]) {
    const context = createSimulation(options);
    context.ability.update(0, context.target);
    assert.equal(context.ability.state.commandWindow, null);
    assert.ok(context.owner.state.movement);
}

const text = formatAbilityResult("dash-command-manual-entry", {
    attemptsPerMatch: NaN,
    successRate: Infinity,
    values: []
});
assert.doesNotMatch(text, /NaN|Infinity/);
console.log("[dash-command] ok");
