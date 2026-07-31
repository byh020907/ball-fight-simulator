import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createSimulation(options = {}) {
    const results = [];
    const roster = createRoster();
    const batBall = roster.find((fighter) => fighter.id === "bat_ball");
    const opponent = roster.find((fighter) => fighter.id === "rage");
    const simulation = new BattleSimulation(
        [batBall, opponent],
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
    ability.state.arcAngle = 0;
    ability.state._facingAngle = 0;
    ability.state.sweepDirection = 1;
    ability.setCooldownRemaining(0);
    return { simulation, owner, target, ability, results };
}

function releaseCommand(simulation, pointerId = 1) {
    const { x, y } = simulation.playerBall.position;
    simulation.beginDragCombat(pointerId, { x, y });
    simulation.moveDragCombat(pointerId, { x: x - 140, y });
    return simulation.releaseDragCombat(pointerId);
}

function openCommand(context) {
    context.ability.setCooldownRemaining(0);
    context.ability.state._facingAngle = -Math.sin((performance.now() / 1000) * 2.5) * (Math.PI * 0.45);
    context.ability.update(0, context.target);
    assert.equal(context.ability.state.commandWindow?.remaining, 0.8);
}

{
    const context = createSimulation();
    openCommand(context);
    assert.deepEqual(context.ability.getCommandState(), { available: true, reserveResource: false });
    const velocity = context.owner.velocity.clone();
    releaseCommand(context.simulation);
    assert.equal(
        context.simulation.dragCombat.getSnapshot().playerShot.active,
        false,
        "called shot replaces body launch"
    );
    assert.deepEqual(context.owner.velocity, velocity, "called shot preserves owner velocity");
    assert.equal(
        context.simulation.commandResource.amount,
        0.35,
        "called shot spends once and gets one ability recovery"
    );
    assert.ok(context.target.state.wallSlam, "called shot executes the already-scanned Slash");
}

{
    const context = createSimulation();
    openCommand(context);
    const direction = context.ability._getCalledShotDirection({
        direction: { x: 1, y: 0 },
        pathSegments: [
            { x: 600, y: 400 },
            { x: 600, y: 700 }
        ]
    });
    assert.ok(direction.y > 0.99, "called shot restores the final non-zero planned segment");
    context.ability.prepareCommand({
        sequence: 1,
        direction: { x: 1, y: 0 },
        pathSegments: [
            { x: 600, y: 400 },
            { x: 600, y: 700 }
        ],
        bouncePoints: [],
        createdAt: 0
    });
    let knockbackDirection = null;
    const applyKnockback = context.target.applyKnockback.bind(context.target);
    context.target.applyKnockback = (impulse, duration) => {
        knockbackDirection = impulse.clone().normalize();
        return applyKnockback(impulse, duration);
    };
    context.ability.resolveCommandLaunch({ sequence: 1 });
    assert.ok(knockbackDirection.y > 0.99, "actual target knockback follows the final segment");
    assert.ok(Math.abs(context.ability.state.arcAngle - Math.PI / 2) < 1e-6, "Slash arc centers on called direction");
}

for (const resolveFallback of ["timeout", "cancel"]) {
    const context = createSimulation();
    openCommand(context);
    if (resolveFallback === "timeout") context.ability.update(0.81, context.target);
    else {
        context.simulation.dragCombat.input.state = "aiming";
        context.ability.update(0, context.target);
        context.simulation.dragCombat.input.state = "idle";
        context.ability.update(0, context.target);
    }
    assert.equal(context.ability.state.commandWindow, null, `${resolveFallback} clears the window`);
    assert.ok(context.target.state.wallSlam, `${resolveFallback} runs exactly the automatic Slash fallback`);
    assert.equal(context.results.length, 0, `${resolveFallback} does not record a command result`);
}

{
    const context = createSimulation();
    openCommand(context);
    context.target.flags.defeated = true;
    context.ability.update(0.1, context.target);
    assert.equal(context.ability.state.commandWindow, null, "invalid target clears stale command state");
    assert.equal(context.ability.cooldownReady, true, "target invalidation does not consume cooldown");
    assert.equal(context.simulation.commandResource.amount, 1, "target invalidation does not spend resource");
    context.target.flags.defeated = false;
    context.ability.state.arcAngle = 0;
    context.ability.state._facingAngle = 0;
    context.ability.update(0, context.target);
    assert.ok(context.ability.state.commandWindow, "next valid target can open a fresh window");
}

for (const options of [
    { abilityCommandEnabled: false },
    { dragCombatAutomated: true },
    { commandResource: { initial: 0 } }
]) {
    const context = createSimulation(options);
    if (options.dragCombatAutomated) context.simulation.dragCombat.automated = true;
    context.ability.update(0, context.target);
    assert.equal(context.ability.state.commandWindow, null, "non-eligible paths retain immediate automatic Slash");
    assert.ok(context.target.state.wallSlam);
}

{
    const context = createSimulation();
    context.owner.progression.abilityTier = 3;
    openCommand(context);
    releaseCommand(context.simulation, 3);
    const effect = context.target.state.wallSlam;
    const contactPoint = new Vector2(900, 400);
    context.target.velocity = new Vector2(600, 0);
    effect.onWallBounce(context.target, new Vector2(-1, 0), context.simulation, contactPoint, new Vector2(600, 0));
    context.target.state.wallSlam = null;
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, "called shot finalizes once when its Wall Slam ends");
    assert.equal(context.results[0].success, true, "actual Wall Slam damage determines success");
    assert.deepEqual(Object.keys(context.results[0].value).sort(), [
        "elapsed",
        "firstWallDistance",
        "homeRunMultiplier",
        "plannedBounces",
        "plannedSegments",
        "resetTriggered",
        "slashDamage",
        "tier",
        "wallSlamDamage",
        "wallSlamImpacts"
    ]);
    assert.equal(context.results[0].value.tier, 3);
    assert.ok(context.results[0].value.slashDamage > 0, "called shot stores actual Slash damage");
    assert.equal(context.results[0].value.resetTriggered, true, "tier 3 records only an actual reset");
}

for (const terminal of ["replaced", "defeated", "battle-ended"]) {
    const context = createSimulation();
    openCommand(context);
    releaseCommand(context.simulation, 4);
    if (terminal === "replaced") context.target.state.wallSlam = null;
    if (terminal === "defeated") context.target.flags.defeated = true;
    if (terminal === "battle-ended") context.ability.onBattleEnded();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, `${terminal} finalizes the cycle exactly once`);
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, `${terminal} cannot double-finalize the cycle`);
}

const emptyText = formatAbilityResult("bat-ball-command-called-shot", {
    attemptsPerMatch: NaN,
    successRate: Infinity,
    values: []
});
assert.doesNotMatch(emptyText, /NaN|Infinity/, "Bat Ball formatter keeps empty values finite");

console.log("[bat-ball-command] ok");
