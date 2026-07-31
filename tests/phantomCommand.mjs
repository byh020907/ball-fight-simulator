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
    const { simulation, ability, target } = createSimulation({ abilityCommandEnabled: false });
    prime(ability);
    const intent = prepareCommand(ability, 2);
    assert.equal(ability.state.preparedCommand, null, "flag-off drag must remain a generic command");
    assert.equal(intent.sequence, 2);
    simulation.abilityCommandEnabled = true;
    ability.state.primed = false;
    prepareCommand(ability, 3);
    assert.equal(ability.state.preparedCommand, null, "non-primed drag must not reserve a Phantom command");
    assert.equal(ability.resolveCommandCollision({ commandSequence: 3, target }).handled, false);
}

{
    const { simulation, ability, target } = createSimulation();
    simulation.width = 80;
    simulation.height = 80;
    ability.owner.position = new Vector2(40, 40);
    target.position = new Vector2(40, 40);
    const fallback = ability._findTeleportPosition(target, new Vector2(1, 0));
    assert.equal(fallback.safeAppear, false, "blocked fallback must report unsafe teleport clearance");
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
    ability.setContext({ abilityTier: 3 });
    prime(ability);
    prepareCommand(ability, 11);
    ability.resolveCommandCollision({ commandSequence: 11, target });
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "base";
    ability.onDashHit(target, {});
    ability._triggerShadowChain(target, "shadowReboundStacks");
    assert.equal(ability.state.activeDashStage, "chain", "rebound chain remains a direct dash");
    ability.onDashHit(target, {});
    assert.equal(ability.state.pendingShadowStage, "finish", "chain hit starts the finish teleport");
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "finish";
    ability.onDashHit(target, {});
    ability._triggerShadowChain(target, "shadowPursuitStacks");
    assert.ok(ability.state.appearPos.x > target.position.x, "pursuit teleport reuses the stored command direction");
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "chain";
    ability.onDashHit(target, {});
    assert.equal(results.length, 1, "all consumed Tier 3 chains finalize exactly once");
    assert.deepEqual(results[0].value, { safeAppear: true, baseHit: true, chainDepth: 2, finishHit: true });
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
    prepareCommand(ability, 12);
    ability.resolveCommandCollision({ commandSequence: 12, target });
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "chain";
    ability.owner.state.movement = null;
    ability.update(0, target);
    ability.update(0, target);
    assert.equal(results.length, 1, "chain miss with no remaining stack finalizes once in the same frame");
}

{
    const { ability, target, results } = createSimulation();
    ability.setContext({ abilityTier: 3 });
    prime(ability);
    prepareCommand(ability, 13);
    ability.resolveCommandCollision({ commandSequence: 13, target });
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "base";
    ability.onDashHit(target, {});
    ability.setCooldownRemaining(0);
    ability._clearExpiredChain();
    ability._clearExpiredChain();
    assert.equal(results.length, 1, "cooldown expiry finalizes an open cycle once");
    ability.onBattleEnded();
    ability.onBattleEnded();
    assert.equal(results.length, 1, "battle-end repeats cannot duplicate a finalized cycle");
}

{
    const { ability, target, results } = createSimulation();
    ability.setContext({ abilityTier: 3 });
    prime(ability);
    ability.onCollision(target);
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "base";
    ability.onDashHit(target, {});
    ability._triggerShadowChain(target, "shadowPursuitStacks");
    ability.state.teleportPhase = 0;
    ability.state.activeDashStage = "chain";
    ability.onDashHit(target, {});
    assert.equal(results.length, 0, "legacy Phantom chains without commandSequence record no command result");
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

    for (const reason of ["replaced", "reset", "ally-stop", "battle-end"]) {
        prime(ability);
        prepareCommand(ability, reason.length + 20);
        ability.onCommandEnd({ commandSequence: reason.length + 20, reason });
        assert.equal(ability.state.preparedCommand, null, `${reason} clears a reserved intent`);
        assert.equal(ability.cooldownRemaining, ability.cooldown, `${reason} restarts the full cooldown`);
    }

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
