import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

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
        { assignActions: false, dragCombatEnabled: true, abilityCommandEnabled, commandResourceEnabled: true }
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

{
    const { simulation, ability } = createSimulation({ abilityCommandEnabled: false });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
    assert.equal(prepare(ability, 1).sequence, 1);
    assert.equal(ability.state.commandIntents.size, 0, "flag-off Spin must keep the generic path");
    simulation.abilityCommandEnabled = true;
    simulation.dragCombat.automated = true;
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
}

{
    const { ability, target, results, uses, simulation } = createSimulation();
    ability.setContext({ abilityTier: 3 });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 7);
    ability.onCommandBounce({ commandSequence: 7 }, { context: { wall: true } });
    ability.onCommandBounce({ commandSequence: 7 }, { context: { terrain: true } });
    ability.onCommandBounce({ commandSequence: 7 }, { context: { wall: true } });
    const context = {};
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
    const { ability, results } = createSimulation();
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    prepare(ability, 9);
    ability.onCommandEnd({ commandSequence: 9, reason: "expired" });
    ability.onCommandEnd({ commandSequence: 9, reason: "expired" });
    assert.equal(results.length, 1, "expired command records one failed result without a charge cashout");
    assert.equal(results[0].success, false);
    assert.equal(results[0].value.retainedCharge, 0);
}

console.log("[spin-command] ok");
