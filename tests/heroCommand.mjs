import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation({ abilityCommandEnabled = true, commandResource = true } = {}) {
    const results = [];
    const heroSpec = createRoster().find((fighter) => fighter.id === "hero");
    const opponent = createRoster().find((fighter) => fighter.id !== "hero");
    const simulation = new BattleSimulation(
        [heroSpec, opponent],
        { onLog() {}, onSound() {}, onAbilityResult: (event) => results.push(event) },
        null,
        { assignActions: false, dragCombatEnabled: true, abilityCommandEnabled, commandResource }
    );
    simulation.setPlayerBall(simulation.fighters[0]);
    simulation.playerBall.position = new Vector2(200, 300);
    simulation.fighters[1].position = new Vector2(500, 300);
    const ability = simulation.playerBall.abilities.getByAbilityId("hero");
    assert.equal(ability.abilityId, "hero");
    return { simulation, ability, target: simulation.fighters[1], results };
}

{
    const { simulation, ability, target } = createSimulation();
    ability.state.growthStacks = 5;
    ability._openCommandWindow();
    ability.update(0.2, target);
    assert.ok(
        Math.abs(ability.state.commandWindowRemaining - 0.6) < 1e-9,
        "full Hero should reserve the 0.8s command window"
    );
    assert.equal(simulation.playerBall.state.movement, null, "window must delay the automatic pursuit dash");

    simulation.dragCombat.input.state = "aiming";
    ability.update(1, target);
    assert.ok(
        Math.abs(ability.state.commandWindowRemaining - 0.6) < 1e-9,
        "aiming keeps the command window open until release or cancel"
    );
    simulation.dragCombat.input.state = "idle";
    ability.update(0, target);
    assert.ok(simulation.playerBall.state.movement, "aim cancel should fall back to the existing pursuit immediately");
}

for (const options of [
    { abilityCommandEnabled: false, commandResource: true },
    { abilityCommandEnabled: true, commandResource: false }
]) {
    const { simulation, ability, target } = createSimulation(options);
    ability.state.growthStacks = 5;
    ability.update(0, target);
    assert.ok(
        simulation.playerBall.state.movement,
        "AI, disabled, or no-resource Hero must preserve automatic pursuit"
    );
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.state.growthStacks = 5;
    ability._openCommandWindow();
    const intent = ability.prepareCommand({ sequence: 7, direction: { x: 1, y: 0 } });
    const context = { contactPoint: target.position.clone() };
    const resolution = ability.resolveCommandCollision(
        { commandSequence: 7, target, contactPoint: target.position.clone() },
        { context }
    );
    assert.equal(resolution.runDefaultOnCollision, true, "Hero command keeps normal collision processing enabled");
    ability.onFighterCollisionDamageResolved(target, 12, context);
    ability.onFighterCollisionDamageResolved(target, 12, context);
    const orbs = simulation.entities.filter((entity) => entity.commandSequence === 7);
    assert.equal(orbs.length, 5, "terminal damage callback should release five cores exactly once");
    const angles = orbs.map((orb) => Math.atan2(orb.velocity.y, orb.velocity.x));
    assert.ok(Math.min(...angles) < -0.45 && Math.max(...angles) > 0.45, "command cores should span the 60-degree fan");

    ability.onOrbCollected(orbs[0], { applied: false });
    orbs[0].settle({ collected: true });
    for (const orb of orbs.slice(1)) orb.settle({ collected: false });
    assert.equal(results.length, 1, "all terminal paths settle one command result exactly once");
    assert.deepEqual(results[0].value, { released: 5, collected: 1, shield: 0, heal: 0 });
    assert.equal(results[0].success, true);
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.setContext({ abilityTier: 2 });
    simulation.playerBall.hp = simulation.playerBall.maxHp * 0.5;
    ability.state.growthStacks = 5;
    ability._openCommandWindow();
    ability.prepareCommand({ sequence: 8, direction: { x: 1, y: 0 } });
    const context = { contactPoint: target.position.clone() };
    ability.resolveCommandCollision({ commandSequence: 8, target, contactPoint: target.position.clone() }, { context });
    ability.onFighterCollisionDamageResolved(target, 1, context);
    const [firstOrb, ...remainingOrbs] = simulation.entities.filter((entity) => entity.commandSequence === 8);
    const hpBefore = simulation.playerBall.hp;
    const shieldBefore = ability.state.shield;
    ability.onOrbCollected(firstOrb, { applied: true });
    assert.ok(ability.state.shield > shieldBefore, "armor core should record the actual shield delta");
    assert.ok(simulation.playerBall.hp > hpBefore, "recovery core should record the actual heal delta");
    firstOrb.settle({ collected: true });
    for (const orb of remainingOrbs) orb.settle({ collected: false });
    assert.ok(results[0].value.shield > 0 && results[0].value.heal > 0, "result must retain actual shield and heal");
}

{
    const { simulation, ability, target, results } = createSimulation();
    ability.state.growthStacks = 5;
    ability._openCommandWindow();
    ability.prepareCommand({ sequence: 9, direction: { x: 1, y: 0 } });
    const context = { contactPoint: target.position.clone() };
    ability.resolveCommandCollision({ commandSequence: 9, target, contactPoint: target.position.clone() }, { context });
    ability.onFighterCollisionDamageResolved(target, 1, context);
    ability.onBattleEnded();
    ability.onBattleEnded();
    assert.equal(results.length, 1, "battle end resolves remaining command orbs once");
    assert.deepEqual(results[0].value, { released: 5, collected: 0, shield: 0, heal: 0 });
}

console.log("[hero-command] ok");
