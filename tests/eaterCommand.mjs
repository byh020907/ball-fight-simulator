import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createSimulation(options = {}) {
    const results = [];
    const roster = createRoster();
    const eater = roster.find((fighter) => fighter.id === "eater");
    const opponent = roster.find((fighter) => fighter.id === "rage");
    const simulation = new BattleSimulation(
        [eater, opponent],
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
    target.position = new Vector2(500, 400);
    const ability = owner.abilities.primary;
    ability.state.feastTimer = 1;
    ability.onCollision(target);
    return { simulation, owner, target, ability, results };
}

function releaseCommand(simulation, pointerId = 1) {
    const { x, y } = simulation.playerBall.position;
    simulation.beginDragCombat(pointerId, { x, y });
    simulation.moveDragCombat(pointerId, { x: x - 140, y });
    return simulation.releaseDragCombat(pointerId);
}

{
    const context = createSimulation();
    assert.deepEqual(context.ability.getCommandState(), { available: true, reserveResource: false });
    assert.equal(context.ability.getUiState().label, "Aim Spit", "eligible swallowed state is readable as Aim Spit");
    assert.equal(context.simulation.commandResource.amount, 1, "swallow does not reserve resource");
    releaseCommand(context.simulation);
    assert.equal(
        context.simulation.dragCombat.getSnapshot().playerShot.active,
        false,
        "spit route replaces generic shot"
    );
    assert.equal(context.simulation.commandResource.amount, 0, "valid release spends resource once");
    assert.equal(context.target.state.movement.commandSequence, 1, "target Spit Dash keeps command sequence");
    assert.equal(context.owner.state.movement, null, "owner never receives generic body shot");
    assert.ok(context.target.state.wallSlam, "release starts existing Wall Slam chain");
}

{
    const context = createSimulation();
    context.owner.progression.abilityTier = 2;
    const impulses = [];
    const applyImpulse = context.owner.applyImpulse.bind(context.owner);
    context.owner.applyImpulse = (impulse) => {
        impulses.push(impulse.clone());
        return applyImpulse(impulse);
    };
    let spitImpactDamage = 0;
    const takeDamage = context.target.takeDamage.bind(context.target);
    context.target.takeDamage = (damage, source, label, options) => {
        if (label === "Spit Impact") spitImpactDamage = damage;
        return takeDamage(damage, source, label, options);
    };
    releaseCommand(context.simulation);
    assert.equal(spitImpactDamage, Math.round(context.owner.stats.baseDamage), "tier 2 preserves Spit Impact ×1.0");
    assert.ok(
        impulses.some((impulse) => Math.abs(impulse.length() - 420) < 1e-6),
        "tier 2 preserves 420 recoil"
    );
    assert.equal(
        context.target.state.movement.speedOverride,
        context.target.stats.baseSpeed * 3,
        "tier 2 preserves 3x spit speed"
    );
}

{
    const context = createSimulation();
    const direction = context.ability._getCommandDirection({
        direction: { x: 0, y: 0 },
        pathSegments: [
            { x: 400, y: 650 },
            { x: 850, y: 650 }
        ]
    });
    assert.ok(direction.y > 0.99, "first absolute segment determines spit direction");
    context.ability.state.spitDirection = new Vector2(-1, 0);
    assert.equal(context.ability._getCommandDirection({ direction: { x: 0, y: 0 }, pathSegments: [] }).x, -1);
}

for (const fallback of ["timeout", "cancel"]) {
    const context = createSimulation();
    if (fallback === "timeout") context.ability.update(0.73, context.target);
    else {
        context.simulation.dragCombat.input.state = "aiming";
        context.ability.update(0, context.target);
        context.simulation.dragCombat.input.state = "idle";
        context.ability.update(0, context.target);
    }
    assert.equal(context.results.length, 0, `${fallback} creates no command result`);
    assert.equal(context.simulation.commandResource.amount, 1, `${fallback} preserves resource`);
    assert.ok(context.target.state.wallSlam, `${fallback} releases stored automatic spit once`);
}

for (const options of [
    { abilityCommandEnabled: false },
    { commandResource: { initial: 0 } },
    { dragCombatAutomated: true }
]) {
    const context = createSimulation(options);
    if (options.dragCombatAutomated) context.simulation.dragCombat.automated = true;
    assert.equal(context.ability.getCommandState().available, false, "ineligible path has no manual spit command");
    context.ability.update(0.73, context.target);
    assert.ok(context.target.state.wallSlam, "ineligible path keeps automatic release");
}

{
    const context = createSimulation();
    context.owner.progression.abilityTier = 3;
    releaseCommand(context.simulation);
    const effect = context.target.state.wallSlam;
    context.target.velocity = new Vector2(600, 0);
    effect.onWallBounce(
        context.target,
        new Vector2(-1, 0),
        context.simulation,
        new Vector2(900, 400),
        new Vector2(600, 0)
    );
    assert.equal(context.results.length, 1, "first actual wall impact finalizes command once");
    assert.equal(context.results[0].success, true, "actual Wall Slam damage determines success");
    assert.deepEqual(Object.keys(context.results[0].value).sort(), [
        "digestionTicksAtLaunch",
        "elapsed",
        "holdRemaining",
        "plannedBounces",
        "plannedSegments",
        "ruptureSplashDamage",
        "ruptureSplashHits",
        "ruptureTargetDamage",
        "ruptureTriggered",
        "spitImpactDamage",
        "tier",
        "wallHit",
        "wallSlamDamage"
    ]);
    assert.equal(context.results[0].value.ruptureTriggered, true, "tier 3 rupture follows the actual wall contact");
}

for (const terminal of ["replaced", "defeated", "battle-ended"]) {
    const context = createSimulation();
    releaseCommand(context.simulation);
    if (terminal === "replaced") context.target.state.wallSlam = null;
    if (terminal === "defeated") context.target.flags.defeated = true;
    if (terminal === "battle-ended") context.ability.onBattleEnded();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, `${terminal} finalizes once`);
}

assert.doesNotMatch(
    formatAbilityResult("eater-command-spit-route", { attemptsPerMatch: NaN, successRate: Infinity, values: [] }),
    /NaN|Infinity/
);
console.log("[eater-command] ok");
