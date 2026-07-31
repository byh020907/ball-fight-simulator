import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createSimulation(options = {}) {
    const results = [];
    const orbit = createRoster().find((fighter) => fighter.id === "orbit");
    const opponent = createRoster().find((fighter) => fighter.id !== "orbit");
    const simulation = new BattleSimulation(
        [orbit, opponent],
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
        ability: simulation.playerBall.abilities.getByAbilityId("orbit"),
        target: simulation.fighters[1],
        results
    };
}

{
    const { simulation, ability, target } = createSimulation();
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    assert.equal(ability.getCommandState().available, true, "ready focal Orbit opens a command window");
    const intent = ability.prepareCommand({ sequence: 1, direction: { x: 1, y: 0 }, pathSegments: [{ x: 1, y: 2 }] });
    const launch = ability.resolveCommandLaunch(intent);
    assert.equal(launch.mode, "payload-only");
    assert.equal(
        simulation.dragCombat.getSnapshot().playerShot.active,
        false,
        "command volley does not start a body shot"
    );
    ability.update(0, target);
    const projectile = simulation.entities.find((entity) => entity.commandSequence === 1);
    assert.ok(projectile, "command volley creates a tagged projectile");
    assert.equal(projectile.dir.x > 0, true, "tier 0 shard uses the fixed command point direction");
}

{
    const { simulation, ability, target } = createSimulation({ abilityCommandEnabled: false });
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    assert.equal(ability.state.volleyActive, true, "flag-off preserves automatic volley");
    assert.equal(ability.state.commandWindow, null);
    simulation.playerBall = target;
    ability.cooldowns.clear("volley");
    ability.state.volleyActive = false;
    ability.update(0, target);
    assert.equal(ability.state.commandWindow, null, "non-focal Orbit cannot reserve a command");
}

{
    const { simulation, ability, target } = createSimulation();
    ability.setContext({ abilityTier: 1 });
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    const intent = ability.prepareCommand({ sequence: 5, direction: { x: 1, y: 0 }, pathSegments: [] });
    ability.resolveCommandLaunch(intent);
    ability.update(0, target);
    const projectile = simulation.entities.find((entity) => entity.commandSequence === 5);
    assert.ok(projectile.convergence, "tier 1 command projectile starts synchronized convergence at spawn");
    const convergence = projectile.convergence;
    ability.registerProjectileHit(projectile, target, projectile.position.clone());
    assert.equal(projectile.convergence, convergence, "first hit does not duplicate command convergence");
}

{
    const { ability, target } = createSimulation();
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    const intent = ability.prepareCommand({ sequence: 6, direction: { x: 1, y: 0 }, pathSegments: [] });
    target.flags.defeated = true;
    assert.equal(ability.resolveCommandLaunch(intent).mode, "default-shot", "invalidated release falls back once");
    assert.equal(ability.state.commandCycles.size, 0, "invalidated release leaves no empty cycle");
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    simulation.dragCombat.input.state = "aiming";
    ability.update(1, target);
    simulation.dragCombat.input.state = "idle";
    ability.update(0, target);
    assert.equal(ability.state.volleyActive, true, "aim cancel immediately falls back to one auto volley");
    assert.equal(results.length, 0, "cancel does not create a command result");
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    const intent = ability.prepareCommand({ sequence: 4, direction: { x: 1, y: 0 }, pathSegments: [] });
    ability.resolveCommandLaunch(intent);
    ability.onBattleEnded();
    ability.onBattleEnded();
    assert.equal(results.length, 1, "battle end settles a launched command cycle once");
    assert.deepEqual(Object.keys(results[0].value).sort(), [
        "catches",
        "elapsed",
        "hits",
        "plannedSegments",
        "released",
        "synchronizedHits",
        "tier"
    ]);
}

{
    const { simulation, ability, target } = createSimulation();
    ability.cooldowns.clear("volley");
    ability.update(0, target);
    simulation.dragCombat.automated = true;
    assert.deepEqual(ability.getCommandState(), { available: false, reserveResource: false });
}

{
    const text = formatAbilityResult("orbit-command-volley", { attemptsPerMatch: 0, successRate: 0, values: [] });
    assert.ok(!text.includes("NaN") && !text.includes("Infinity"), "empty Orbit metrics stay finite");
}

console.log("[orbit-command] ok");
