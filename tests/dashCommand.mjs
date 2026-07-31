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

for (const level of [0, 1, 2]) {
    const context = createSimulation();
    context.ability.state.cooldownLevel = level;
    const slashes = [];
    context.simulation.spawnSlash = (start, end) => slashes.push({ start, end });
    openCommand(context);
    const intent = context.ability.prepareCommand({
        sequence: level + 20,
        direction: { x: -1, y: 0 },
        pathSegments: [
            { x: 520, y: 520 },
            { x: 700, y: 400 }
        ],
        bouncePoints: [],
        createdAt: 0
    });
    const result = context.ability.resolveCommandLaunch(intent);
    const effect = context.owner.state.movement;
    const expected = new Vector2(120, 120).normalize();
    assert.equal(result.mode, "replace-shot", `stage ${level} resolves as Dash replacement`);
    assert.equal(effect.commandSequence, level + 20, `stage ${level} preserves command sequence`);
    assert.ok(context.owner.state.forcedHeading.direction.dot(expected) > 0.999, `stage ${level} uses first endpoint`);
    assert.ok(
        context.owner.velocity.clone().normalize().dot(expected) > 0.999,
        `stage ${level} velocity uses entry direction`
    );
    const slashDirection = Vector2.subtract(slashes[0].end, slashes[0].start).normalize();
    assert.ok(slashDirection.dot(expected) > 0.999, `stage ${level} slash stays 120px on entry direction`);
    if (level === 0) {
        context.target.position = new Vector2(400, 800);
        const before = context.owner.state.forcedHeading.direction.clone();
        context.ability.update(0.2, context.target);
        assert.ok(
            context.owner.state.forcedHeading.direction.dot(before) > 0.999,
            "stage 0 command Dash disables automatic homing"
        );
    }
}

{
    const context = createSimulation();
    openCommand(context);
    const foreignMovement = { commandSequence: null };
    context.owner.state.movement = foreignMovement;
    context.ability.update(0, context.target);
    assert.equal(context.ability.state.commandWindow, null, "other movement clears the stale command window");
    assert.equal(context.owner.state.movement, foreignMovement, "other movement is never overwritten by fallback");
}

for (const terminal of ["expiry", "replacement", "owner defeat", "target defeat", "battle end"]) {
    const context = createSimulation();
    openCommand(context);
    const intent = context.ability.prepareCommand({
        sequence: 40,
        direction: { x: 1, y: 0 },
        pathSegments: [{ x: 600, y: 400 }],
        bouncePoints: [],
        createdAt: 0
    });
    context.ability.resolveCommandLaunch(intent);
    const effect = context.owner.state.movement;
    if (terminal === "expiry") effect.expired = true;
    if (terminal === "replacement") context.owner.state.movement = { commandSequence: null };
    if (terminal === "owner defeat") context.owner.flags.defeated = true;
    if (terminal === "target defeat") context.target.flags.defeated = true;
    if (terminal === "battle end") context.ability.onBattleEnded();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, `${terminal} finalizes once`);
    context.ability.onBattleEnded();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, `${terminal} cannot double-finalize`);
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

{
    const context = createSimulation();
    context.owner.progression.abilityTier = 3;
    openCommand(context);
    const start = context.owner.position;
    context.simulation.beginDragCombat(8, start);
    context.simulation.moveDragCombat(8, { x: start.x - 140, y: start.y });
    context.simulation.releaseDragCombat(8);
    const effect = context.owner.state.movement;
    context.ability.onDashHit(context.target, effect);
    const cycle = context.ability.state.commandCycles.get(effect.commandSequence);
    const laser = cycle.laser;
    assert.equal(context.ability.laserCombatStates.get(laser).commandSequence, effect.commandSequence);
    laser.segments = [{ start: context.owner.position.clone(), end: context.target.position.clone() }];
    context.ability._dealDashLaserTick(laser, laser.fireDuration);
    context.ability._dealDashLaserTick(laser, laser.fireDuration);
    assert.ok(cycle.laserDamage > 0, "tier laser accumulates actual tick damage on its command cycle");
    assert.equal(cycle.ignitionTargetIds.size, 1, "tier 3 ignition targets remain unique");
    context.owner.clearDash();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 0, "result waits for the command-owned laser to finish");
    laser.isExpired = true;
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, "laser finish finalizes the command cycle once");
}

{
    const context = createSimulation();
    openCommand(context);
    const effect =
        context.ability.resolveCommandLaunch(
            context.ability.prepareCommand({
                sequence: 9,
                direction: { x: 1, y: 0 },
                pathSegments: [{ x: 600, y: 400 }],
                bouncePoints: [],
                createdAt: 0
            })
        ) && context.owner.state.movement;
    context.owner.abilities.onDashWall(effect);
    assert.equal(context.ability.state.cooldownLevel, 0, "exact DashEffect wall forwarding resets stage zero");
    assert.equal(
        context.ability.state.commandCycles.get(9).cooldownLevelAfter,
        0,
        "wall snapshots full cooldown stage"
    );
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
