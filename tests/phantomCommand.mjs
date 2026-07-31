import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation({ abilityCommandEnabled = true } = {}) {
    const results = [];
    const phantom = createRoster().find((fighter) => fighter.id === "phantom");
    const opponent = createRoster().find((fighter) => fighter.id !== "phantom");
    const simulation = new BattleSimulation(
        [phantom, opponent],
        { onLog() {}, onSound() {}, onAbilityResult: (event) => results.push(event) },
        null,
        { assignActions: false, dragCombatEnabled: true, abilityCommandEnabled, commandResourceEnabled: true }
    );
    simulation.setPlayerBall(simulation.fighters[0]);
    simulation.playerBall.position = new Vector2(200, 300);
    simulation.fighters[1].position = new Vector2(500, 300);
    const ability = simulation.playerBall.abilities.getByAbilityId("phantom");
    return { simulation, ability, target: simulation.fighters[1], results };
}

function prime(ability) {
    ability.state.primed = true;
    ability.state.primedTimer = 2.5;
}

function prepareCommand(ability, sequence = 1, direction = { x: 1, y: 0 }) {
    return ability.prepareCommand({
        sequence,
        direction,
        chargeRatio: 1,
        pathSegments: [],
        bouncePoints: [],
        predictedTerminal: null,
        createdAt: 0
    });
}

{
    const { simulation, ability } = createSimulation();
    prime(ability);
    assert.deepEqual(ability.getCommandState(), { available: true, reserveResource: false });
    simulation.dragCombat.automated = true;
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
    simulation.dragCombat.automated = false;
    simulation.playerBall = simulation.fighters[1];
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
}

{
    const { simulation, ability, target } = createSimulation();
    prime(ability);
    prepareCommand(ability, 7);
    assert.equal(ability.state.primed, false, "prepared command must consume the primed window");
    const originalRandom = Math.random;
    Math.random = () => {
        throw new Error("command teleport must not draw random direction");
    };
    try {
        simulation.spawnParticleBurst = () => {};
        const resolution = ability.resolveCommandCollision({ commandSequence: 7, target });
        assert.deepEqual(resolution, { handled: true, runDefaultOnCollision: false });
        assert.ok(ability.state.appearPos.x > target.position.x, "command direction chooses the first teleport exit");
        ability.onCommandEnd({ commandSequence: 7, reason: "plain-hit" });
        assert.ok(ability.state.commandCycle, "terminal onCommandEnd must not clear the started chain");
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(
        ability.resolveCommandCollision({ commandSequence: 7, target }).handled,
        false,
        "the same terminal sequence starts one base teleport"
    );
}

{
    const { ability, target, results } = createSimulation();
    prime(ability);
    prepareCommand(ability, 8);
    ability.resolveCommandCollision({ commandSequence: 8, target });
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "base";
    ability.onDashHit(target, {});
    assert.equal(results.length, 1, "base hit without a follow-up finalizes one result");
    assert.deepEqual(results[0].value, { safeAppear: true, baseHit: true, chainDepth: 0, finishHit: false });
    assert.equal(results[0].success, true);
}

{
    const { ability, target, results } = createSimulation();
    prime(ability);
    prepareCommand(ability, 9);
    ability.resolveCommandCollision({ commandSequence: 9, target });
    ability.state.activeDashStage = "base";
    ability.owner.state.movement = null;
    ability.update(0, target);
    assert.equal(results.length, 1, "a dash miss settles the command cycle");
    assert.deepEqual(results[0].value, { safeAppear: true, baseHit: false, chainDepth: 0, finishHit: false });
}

{
    const { ability, target } = createSimulation();
    prime(ability);
    prepareCommand(ability, 10);
    ability.onCommandEnd({ commandSequence: 10, reason: "expired" });
    assert.equal(ability.state.preparedCommand, null, "expired prepared intent is discarded");
    assert.equal(ability.cooldownRemaining, ability.cooldown, "expired intent restarts the full cooldown");

    prime(ability);
    const originalRandom = Math.random;
    let calls = 0;
    Math.random = () => {
        calls += 1;
        return 0.5;
    };
    try {
        ability.onCollision(target);
    } finally {
        Math.random = originalRandom;
    }
    assert.ok(calls > 0, "ordinary primed collision preserves the legacy random-driven teleport path");
}

console.log("[phantom-command] ok");
