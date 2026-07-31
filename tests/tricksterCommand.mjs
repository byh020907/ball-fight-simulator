import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation(options = {}) {
    const results = [];
    const trickster = createRoster().find((fighter) => fighter.id === "trickster");
    const opponent = createRoster().find((fighter) => fighter.id !== "trickster");
    const simulation = new BattleSimulation(
        [trickster, opponent],
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
    simulation.playerBall.position = new Vector2(200, 300);
    simulation.fighters[1].position = new Vector2(500, 300);
    return {
        simulation,
        ability: simulation.playerBall.abilities.getByAbilityId("trickster"),
        target: simulation.fighters[1],
        results
    };
}

function releaseCommand(simulation, pointerId = 1) {
    const { x, y } = simulation.playerBall.position;
    simulation.beginDragCombat(pointerId, { x, y });
    simulation.moveDragCombat(pointerId, { x: x - 140, y });
    return simulation.releaseDragCombat(pointerId);
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    assert.equal(ability.state.commandWindow.remaining, 0.8, "ready Trickster opens the 0.8 second command window");
    assert.deepEqual(ability.getCommandState(), { available: true, reserveResource: false });
    const velocity = simulation.playerBall.velocity.clone();
    releaseCommand(simulation);
    const seeds = simulation.entities.filter((entity) => entity.commandSequence === 1);
    assert.equal(seeds.length, 3, "valid release launches exactly three commanded seeds");
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, false, "command route is payload-only");
    assert.deepEqual(simulation.playerBall.velocity, velocity, "command route leaves body velocity unchanged");
    assert.equal(simulation.commandResource.amount, 0.35, "command spend receives the existing ability recovery");
}

{
    const { ability } = createSimulation();
    const fan = ability._getCommandDirections({ direction: { x: 1, y: 0 }, pathSegments: [{ x: 400, y: 300 }] });
    assert.equal(fan.length, 3);
    assert.ok(fan[0].y < -0.4 && Math.abs(fan[1].y) < 1e-9 && fan[2].y > 0.4, "straight route uses the ±24 degree fan");
    const route = ability._getCommandDirections({
        direction: { x: 1, y: 0 },
        pathSegments: [
            { x: 400, y: 300 },
            { x: 400, y: 500 }
        ]
    });
    assert.ok(route.some((direction) => direction.x > 0.99) && route.some((direction) => direction.y > 0.99));
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    releaseCommand(simulation, 2);
    const seeds = simulation.entities.filter((entity) => entity.commandSequence === 1);
    ability.onSeedContact(target, seeds[0]);
    seeds[0].settle({ reason: "contact" });
    seeds[1].settle({ reason: "lifetime" });
    seeds[2].settle({ reason: "lifetime" });
    simulation.playerBall.state.movement = null;
    ability.update(0, target);
    ability.onBattleEnded();
    assert.equal(results.length, 1, "settled command cycle records exactly once");
    assert.deepEqual(Object.keys(results[0].value).sort(), [
        "elapsed",
        "enemySeedContacts",
        "followupSeeds",
        "launched",
        "ownerSeedTriggers",
        "plannedBounces",
        "plannedSegments",
        "seedBursts",
        "tier"
    ]);
    assert.equal(results[0].success, true);
}

{
    const { simulation, ability, target, results } = createSimulation({ abilityCommandEnabled: false });
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    assert.equal(simulation.entities.filter((entity) => entity.constructor?.name === "SeedOrb").length, 3);
    assert.equal(results.length, 0, "flag-off automatic seeds create no command result");
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    simulation.dragCombat.input.state = "aiming";
    ability.update(0, target);
    simulation.dragCombat.input.state = "idle";
    ability.update(0, target);
    assert.equal(ability.state.commandWindow, null, "aim cancel clears the command window");
    assert.equal(simulation.entities.filter((entity) => entity.constructor?.name === "SeedOrb").length, 3);
    ability.update(0, target);
    assert.equal(simulation.entities.filter((entity) => entity.constructor?.name === "SeedOrb").length, 3);
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    ability.update(0.81, target);
    assert.equal(ability.state.commandWindow, null, "timeout clears the command window");
    assert.equal(simulation.entities.filter((entity) => entity.constructor?.name === "SeedOrb").length, 3);
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    target.flags.defeated = true;
    ability.update(0.1, target);
    assert.equal(ability.state.commandWindow, null, "invalid window target cannot leave a stale command window");
    target.flags.defeated = false;
    ability.update(0, target);
    assert.ok(ability.state.commandWindow, "a valid target can open a new window after invalidation");
    target.flags.defeated = true;
    assert.equal(ability.prepareCommand({ sequence: 4, direction: { x: 1, y: 0 } }).sequence, 4);
    assert.equal(ability.state.preparedCommand, null, "invalid release clears stale prepared command state");
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, false);
}

for (const option of [{}, { dragCombatAutomated: true }]) {
    const { simulation, ability, target } = createSimulation(option);
    ability.setCooldownRemaining(0);
    if (option.dragCombatAutomated) simulation.dragCombat.automated = true;
    if (!option.dragCombatAutomated) simulation.playerBall = target;
    ability.update(0, target);
    assert.equal(simulation.entities.filter((entity) => entity.constructor?.name === "SeedOrb").length, 3);
    assert.equal(ability.state.commandWindow, null, "AI or non-focal Trickster keeps automatic seeds");
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setContext({ abilityTier: 1 });
    const seed = ability._spawnSeed(target.position, new Vector2(1, 0), ability.getLevelUpgrade(), { atContact: true });
    seed.update(0, simulation);
    assert.equal(target.state.slow.amount, 0.8, "tier 1 keeps the existing Vine Snare slow");
    assert.equal(target.state.periodicDamage.at(-1).damage, ability.owner.stats.baseDamage * 0.1);
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.setContext({ abilityTier: 2 });
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    releaseCommand(simulation, 6);
    const [seed, ...remainingSeeds] = simulation.entities.filter((entity) => entity.commandSequence === 1);
    seed.position = target.position.clone();
    seed.update(0, simulation);
    const dash = simulation.playerBall.state.movement;
    assert.equal(dash.commandSequence, 1, "actual command SeedOrb passes sequence into Seed Dash");
    const burstDamages = [];
    const takeDamage = target.takeDamage.bind(target);
    target.takeDamage = (damage, source, label, options) => {
        if (label === "Seed Burst") burstDamages.push(damage);
        return takeDamage(damage, source, label, options);
    };
    dash.onCollision(simulation.playerBall, target, simulation, target.position.clone());
    assert.deepEqual(burstDamages, [ability.owner.stats.baseDamage * 1.2], "tier 2 burst keeps its 1.20x damage once");
    for (const remainingSeed of remainingSeeds) remainingSeed.settle({ reason: "lifetime" });
    simulation.playerBall.state.movement = null;
    ability.update(0, target);
    assert.equal(results[0].value.seedBursts, 1);
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setContext({ abilityTier: 3 });
    ability.setCooldownRemaining(0);
    ability.update(0, target);
    releaseCommand(simulation, 7);
    const seed = simulation.entities.find((entity) => entity.commandSequence === 1);
    seed.position = target.position.clone();
    seed.update(0, simulation);
    simulation.playerBall.state.movement.onCollision(
        simulation.playerBall,
        target,
        simulation,
        target.position.clone()
    );
    const followup = simulation.entities.find((entity) => entity.commandSequence === 1 && !entity.tracksCommandCycle);
    assert.equal(followup.life, 14, "tier 3 keeps the existing 14 second followup lifetime");
    assert.equal(followup.collisionGraceRemaining, 0.5, "tier 3 keeps the existing followup grace");
    assert.equal(
        ability.state.commandCycles.get(1).followupSeeds,
        1,
        "followup increments only the command cycle count"
    );
}

console.log("[trickster-command] ok");
