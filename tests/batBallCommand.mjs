import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

const originalPerformanceNow = performance.now;
performance.now = () => 0;

function createRecordingContext() {
    const calls = [];
    const methods = new Set([
        "save",
        "restore",
        "beginPath",
        "arc",
        "stroke",
        "moveTo",
        "lineTo",
        "fill",
        "setLineDash"
    ]);
    return new Proxy(
        { calls },
        {
            get(target, property) {
                if (property in target) return target[property];
                if (methods.has(property)) return (...args) => calls.push([property, ...args]);
                return () => {};
            },
            set(target, property, value) {
                target[property] = value;
                return true;
            }
        }
    );
}

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
    let knockbackMagnitude = 0;
    let knockbackDuration = 0;
    let slashDamage = 0;
    const takeDamage = context.target.takeDamage.bind(context.target);
    context.target.takeDamage = (damage, source, label, options) => {
        if (label === "Slash") slashDamage = damage;
        return takeDamage(damage, source, label, options);
    };
    const applyKnockback = context.target.applyKnockback.bind(context.target);
    context.target.applyKnockback = (impulse, duration) => {
        knockbackDirection = impulse.clone().normalize();
        knockbackMagnitude = impulse.length();
        knockbackDuration = duration;
        return applyKnockback(impulse, duration);
    };
    context.ability.resolveCommandLaunch({ sequence: 1 });
    assert.equal(slashDamage, Math.round(context.owner.stats.baseDamage * 1.3), "tier 0 keeps 1.3x Slash damage");
    assert.equal(knockbackMagnitude, 550, "tier 0 keeps 550 knockback");
    assert.equal(knockbackDuration, 0.85, "tier 0 keeps 0.85 second knockback");
    assert.equal(context.target.state.wallSlam.effect.duration, 0.85, "tier 0 keeps 0.85 second Wall Slam");
    assert.ok(knockbackDirection.y > 0.99, "actual target knockback follows the final segment");
    assert.ok(Math.abs(context.ability.state.arcAngle - Math.PI / 2) < 1e-6, "Slash arc centers on called direction");
    assert.equal(context.ability.state.sweepDirection, 1, "called shot aligns arc winding with its Slash direction");

    const startFrame = createRecordingContext();
    context.ability.state.slashTimer = 0.3;
    context.ability._drawSlashEffect(startFrame, context.owner.position);
    const startArc = startFrame.calls.find(([method]) => method === "arc");
    assert.equal(startArc.at(-1), false, "called shot starts with the short forward Slash winding");
    assert.ok(Math.abs(startArc[4] - startArc[5]) < 1e-9, "called shot starts at the intended arc edge");

    const middleFrame = createRecordingContext();
    context.ability.state.slashTimer = 0.15;
    context.ability._drawSlashEffect(middleFrame, context.owner.position);
    const middleArc = middleFrame.calls.find(([method]) => method === "arc");
    assert.equal(middleArc.at(-1), false, "called shot midpoint retains the short arc winding");
    assert.ok(Math.abs(middleArc[5] - middleArc[4] - Math.PI / 3) < 1e-9, "midpoint arc remains half of 120 degrees");

    const batFrame = createRecordingContext();
    context.ability._drawBat(batFrame, 0);
    const [move, line] = batFrame.calls.filter(([method]) => method === "moveTo" || method === "lineTo");
    const batDirection = new Vector2(line[1] - move[1], line[2] - move[2]).normalize();
    assert.ok(batDirection.y > 0.99, "midpoint bat direction matches called knockback direction");

    const endFrame = createRecordingContext();
    context.ability.state.slashTimer = 0;
    context.ability._drawSlashEffect(endFrame, context.owner.position);
    assert.equal(endFrame.calls.filter(([method]) => method === "arc").length, 0, "Slash effect ends at 0.30 seconds");
}

{
    const context = createSimulation();
    context.owner.progression.abilityTier = 1;
    openCommand(context);
    const impulses = [];
    const applyAngularImpulse = context.target.applyAngularImpulse.bind(context.target);
    context.target.applyAngularImpulse = (impulse) => {
        impulses.push(impulse);
        return applyAngularImpulse(impulse);
    };
    releaseCommand(context.simulation, 2);
    assert.ok(
        impulses.some((impulse) => Math.abs(impulse) > 0),
        "tier 1 keeps the rotating-hit angular impulse"
    );
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
    context.simulation.playerBall = context.target;
    context.ability.update(0, context.target);
    assert.equal(context.ability.state.commandWindow, null, "non-focal Bat Ball keeps the immediate legacy Slash");
    assert.ok(context.target.state.wallSlam, "non-focal Bat Ball does not defer its existing Slash");
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
    assert.ok(context.results[0].value.homeRunMultiplier > 1, "tier 2+ keeps the first-impact HOME RUN multiplier");
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

performance.now = originalPerformanceNow;
console.log("[bat-ball-command] ok");
