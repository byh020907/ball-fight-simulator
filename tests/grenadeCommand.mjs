import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { GRENADE_COMMAND_VISUAL_CONFIG, Grenade } from "../src/entities/grenade.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createContext(options = {}) {
    const roster = createRoster();
    const results = [];
    const simulation = new BattleSimulation(
        [roster.find((fighter) => fighter.id === "grenade"), roster.find((fighter) => fighter.id === "rage")],
        { onLog() {}, onSound() {}, onAbilityResult: (result) => results.push(result) },
        null,
        {
            assignActions: false,
            dragCombatEnabled: true,
            abilityCommandEnabled: true,
            commandResourceEnabled: true,
            ...options
        }
    );
    const [owner, target] = simulation.fighters;
    simulation.setPlayerBall(owner);
    owner.position = new Vector2(400, 400);
    target.position = new Vector2(650, 400);
    return { simulation, owner, target, ability: owner.abilities.primary, results };
}

function withFixedRandom(value, callback) {
    const original = Math.random;
    Math.random = () => value;
    try {
        return callback();
    } finally {
        Math.random = original;
    }
}

function openWindow(context) {
    context.ability.setCooldownRemaining(0);
    context.ability.update(0, context.target);
    assert.equal(context.ability.commandWindow?.remaining, 0.8);
}

function directLaunch(context, sequence = 1, plannedBounces = 0) {
    const pathSegments = Array.from({ length: plannedBounces + 1 }, (_, index) => ({
        x: 700 + index * 40,
        y: 400 + (index % 2) * 80
    }));
    const bouncePoints = pathSegments.slice(0, plannedBounces);
    const intent = context.ability.prepareCommand({
        sequence,
        direction: { x: 1, y: 0 },
        pathSegments,
        bouncePoints,
        createdAt: context.simulation.elapsed
    });
    return context.ability.resolveCommandLaunch(intent);
}

function finishBurst(context) {
    for (let index = 0; index < 8 && context.ability.isBursting; index += 1) {
        context.ability.update(0.12, context.target);
    }
    return context.simulation.entities.filter((entity) => entity instanceof Grenade);
}

function settleGrenades(context, grenades, { guidedHit = true, randomHit = false } = {}) {
    for (const grenade of grenades) {
        const shouldHit = grenade.commandGuided ? guidedHit : randomHit;
        grenade.pos = shouldHit ? context.target.position.clone() : new Vector2(100, 100);
        grenade._detonate(context.simulation);
    }
    context.ability.update(0, context.target);
}

function releaseRuntimeCommand(context, offset = { x: -220, y: 0 }) {
    const start = context.owner.position.clone();
    context.simulation.beginDragCombat(1, start);
    context.simulation.moveDragCombat(1, Vector2.add(start, new Vector2(offset.x, offset.y)));
    return context.simulation.releaseDragCombat(1);
}

{
    const context = createContext();
    openWindow(context);
    assert.equal(context.ability.cooldownRemaining, 0, "the input window does not spend the cooldown early");
    assert.deepEqual(context.ability.getCommandState(), { available: true, reserveResource: false });
    assert.equal(context.ability.getUiState().label, "폭격선");
    assert.equal(context.ability.getUiState().text, "반사마다 유도탄 +1");
    const result = releaseRuntimeCommand(context);
    assert.equal(result.type, "launch");
    assert.equal(
        context.simulation.commandResource.amount,
        0.35,
        "a valid release spends once and keeps the existing ability-use recovery"
    );
    assert.equal(context.simulation.dragCombat.getSnapshot().playerShot.active, false, "the command is payload-only");
    assert.equal(context.ability.cooldownRemaining, 3, "the command burst spends the existing cooldown once");
}

{
    const context = createContext();
    openWindow(context);
    const intent = context.ability.prepareCommand({
        sequence: 2,
        direction: { x: 1, y: 0 },
        pathSegments: [{ x: 700, y: 400 }],
        bouncePoints: [],
        createdAt: 0
    });
    context.target.flags.defeated = true;
    assert.equal(context.ability.resolveCommandLaunch(intent).mode, "payload-only");
    assert.equal(
        context.simulation.entities.filter((entity) => entity instanceof Grenade).length,
        1,
        "a prepared bombing line still launches after its initial target dies"
    );
}

for (const plannedBounces of [0, 1, 2, 3, 4]) {
    const context = createContext();
    openWindow(context);
    withFixedRandom(0.99, () => directLaunch(context, 10 + plannedBounces, plannedBounces));
    const grenades = withFixedRandom(0.75, () => finishBurst(context));
    const expectedGuided = 1 + Math.min(3, plannedBounces);
    assert.equal(grenades.length, 5, "the maximum legacy burst count remains five");
    assert.equal(
        grenades.filter((grenade) => grenade.commandGuided).length,
        expectedGuided,
        `planned bounce ${plannedBounces} only changes the guided subset`
    );
    assert.deepEqual(
        grenades.map((grenade) => Number(grenade.maxTimer.toFixed(2))),
        [0.6, 1.2, 1.8, 2.4, 3],
        "the existing fuse order remains unchanged"
    );
    assert.ok(
        grenades.every((grenade) => Math.abs(grenade.launchSpeed - context.owner.stats.baseSpeed * 1.1) < 1e-9),
        "the command burst keeps the existing projectile speed"
    );
    assert.ok(
        grenades.every(
            (grenade) => grenade.explosionRadius === 174 && grenade.innerRadius === 72 && grenade.maxBounces === 4
        ),
        "the command burst keeps the existing explosion and wall-bounce contract"
    );
    assert.ok(grenades.slice(0, expectedGuided).every((grenade) => grenade.velocity.x > 0));
    assert.ok(grenades.slice(expectedGuided).every((grenade) => grenade.velocity.y < 0));
}

{
    const context = createContext();
    openWindow(context);
    withFixedRandom(0.99, () => directLaunch(context, 25, 3));
    assert.equal(context.simulation.entities.filter((entity) => entity instanceof Grenade).length, 1);
    assert.equal(context.ability.getUiState().text, "유도 4발");
    context.ability.update(0.119, context.target);
    assert.equal(
        context.simulation.entities.filter((entity) => entity instanceof Grenade).length,
        1,
        "the next grenade does not launch before the existing 0.12-second interval"
    );
    context.ability.update(0.0011, context.target);
    assert.equal(
        context.simulation.entities.filter((entity) => entity instanceof Grenade).length,
        2,
        "the next grenade launches at the existing 0.12-second interval"
    );
}

for (const [tier, expected] of [
    [0, [false, false, false]],
    [1, [true, false, false]],
    [2, [true, true, false]],
    [3, [true, true, true]]
]) {
    const context = createContext();
    context.owner.progression.abilityTier = tier;
    openWindow(context);
    withFixedRandom(0, () => directLaunch(context, 40 + tier, 0));
    const grenade = context.simulation.entities.find((entity) => entity instanceof Grenade);
    assert.deepEqual(
        [grenade.stickyEnabled, grenade.burningEnabled, grenade.stickyHomingEnabled],
        expected,
        `tier ${tier} keeps the existing grenade option progression`
    );
}

{
    const context = createContext();
    openWindow(context);
    withFixedRandom(0, () => directLaunch(context, 30, 2));
    const grenades = withFixedRandom(0.25, () => finishBurst(context));
    assert.equal(context.ability.getUiState().text ?? null, null, "completed launch no longer leaks command burst UI");
    settleGrenades(context, grenades, { guidedHit: true });
    assert.equal(context.results.length, 1, "all command grenades settle into one result");
    const result = context.results[0];
    assert.equal(result.resultType, "grenade-command-bombing-line");
    assert.equal(result.success, true);
    assert.equal(result.value.totalGrenades, 3);
    assert.equal(result.value.guidedPlanned, 3);
    assert.equal(result.value.guidedLaunched, 3);
    assert.equal(result.value.settledGrenades, 3);
    assert.equal(result.value.guidedEnemyExplosions, 3);
    assert.equal(result.value.initialTargetExplosions, 3);
    assert.equal(result.value.wastedExplosions, 0);
    assert.equal(result.value.reason, "completed");
    assert.ok(result.value.actualDamage > 0);
    assert.ok(Object.values(result.value).every((value) => typeof value !== "number" || Number.isFinite(value)));
}

{
    const context = createContext();
    openWindow(context);
    withFixedRandom(0, () => directLaunch(context, 31, 0));
    const grenades = withFixedRandom(0.5, () => finishBurst(context));
    settleGrenades(context, grenades, { guidedHit: false, randomHit: true });
    assert.equal(context.results[0].success, false, "random splash cannot claim a guided-line success");
    assert.equal(context.results[0].value.guidedEnemyExplosions, 0);
    assert.ok(context.results[0].value.initialTargetExplosions > 0);
    assert.equal(context.results[0].value.reason, "no-guided-hit");
}

for (const [name, finish, reason] of [
    ["owner defeat", (context) => context.ability.onOwnerDefeated(), "owner-defeat"],
    ["battle end", (context) => context.ability.onBattleEnded(), "battle-ended"]
]) {
    const context = createContext();
    openWindow(context);
    withFixedRandom(0, () => directLaunch(context, reason.length, 1));
    const grenades = withFixedRandom(0.5, () => finishBurst(context));
    grenades[0].pos = context.target.position.clone();
    grenades[0]._detonate(context.simulation);
    finish(context);
    finish(context);
    assert.equal(context.results.length, 1, `${name} settles exactly once`);
    assert.equal(context.results[0].success, false, `${name} is never reported as completed success`);
    assert.equal(context.results[0].value.reason, reason);
    assert.equal(context.ability.commandWindow, null);
    assert.equal(context.ability.preparedCommand, null);
    assert.equal(context.ability.isBursting, false, `${name} clears the pending burst reference`);
}

{
    const timeout = createContext();
    openWindow(timeout);
    withFixedRandom(0, () => timeout.ability.update(0.8, timeout.target));
    assert.equal(timeout.ability.isBursting, true, "timeout starts the legacy burst once");
    assert.equal(timeout.simulation.commandResource.amount, 1.35, "timeout is free and keeps ability-use recovery");

    const cancel = createContext();
    openWindow(cancel);
    cancel.simulation.beginDragCombat(2, cancel.owner.position);
    cancel.ability.update(1, cancel.target);
    assert.equal(cancel.ability.commandWindow?.remaining, 0.8, "aiming pauses the command window");
    cancel.simulation.cancelDragCombat(2);
    withFixedRandom(0, () => cancel.ability.update(0, cancel.target));
    assert.equal(cancel.ability.isBursting, true, "cancel immediately falls back to one legacy burst");
    assert.equal(cancel.simulation.commandResource.amount, 1.35, "cancel is free and keeps ability-use recovery");

    const deadZone = createContext();
    openWindow(deadZone);
    deadZone.simulation.beginDragCombat(3, deadZone.owner.position);
    deadZone.simulation.moveDragCombat(3, Vector2.add(deadZone.owner.position, new Vector2(-1, 0)));
    deadZone.ability.update(0, deadZone.target);
    deadZone.simulation.releaseDragCombat(3);
    withFixedRandom(0, () => deadZone.ability.update(0, deadZone.target));
    assert.equal(deadZone.ability.isBursting, true, "dead-zone release falls back to one legacy burst");
    assert.equal(
        deadZone.simulation.commandResource.amount,
        1.35,
        "dead-zone release is free and keeps ability-use recovery"
    );
}

for (const [name, configure] of [
    ["flag off", (context) => (context.simulation.abilityCommandEnabled = false)],
    ["automated", (context) => (context.simulation.dragCombat.automated = true)],
    ["non-focal", (context) => (context.simulation.playerBall = context.target)],
    ["no resource", (context) => (context.simulation.commandResource.amount = 0)]
]) {
    const context = createContext();
    configure(context);
    context.ability.setCooldownRemaining(0);
    withFixedRandom(0, () => context.ability.update(0, context.target));
    assert.equal(context.ability.commandWindow, null, `${name} never exposes the command window`);
    assert.equal(context.ability.isBursting, true, `${name} keeps the automatic burst`);
    assert.equal(context.simulation.entities.filter((entity) => entity instanceof Grenade).length, 1);
}

{
    const context = createContext();
    const outcomes = [];
    const grenade = new Grenade(context.owner, context.target.position, 1, {
        sticky: true,
        stickyHoming: true,
        commandGuided: true,
        onDetonate: (outcome) => outcomes.push(outcome)
    });
    grenade.wasSticky = true;
    grenade.homingActivated = true;
    grenade.stickyTarget = null;
    grenade.homingTrail = [];
    grenade.pos = new Vector2(100, 100);
    grenade._detonate(context.simulation);
    grenade._detonate(context.simulation);
    assert.equal(outcomes.length, 1, "detonation outcomes are emitted exactly once");
    assert.equal(outcomes[0].wasSticky, true, "sticky contact survives detachment until settlement");
    assert.equal(outcomes[0].homingActivated, true, "homing activation survives trail cleanup until settlement");
}

{
    assert.deepEqual(GRENADE_COMMAND_VISUAL_CONFIG, {
        color: "#ffd166",
        trailLength: 10,
        lineWidth: 3,
        dash: [4, 5],
        ringPadding: 5
    });
    const context = createContext();
    const guided = new Grenade(context.owner, context.target.position, 1, { commandGuided: true });
    guided.commandTrail.push(new Vector2(450, 400));
    guided.homingTrail.push(new Vector2(410, 400), new Vector2(430, 405));
    const calls = [];
    const canvas = new Proxy(
        {},
        {
            get: (_, key) => (typeof key === "string" ? (...args) => calls.push([key, ...args]) : undefined),
            set: (_, key, value) => {
                calls.push(["set", key, value]);
                return true;
            }
        }
    );
    guided.draw(canvas);
    assert.ok(calls.some(([name, dash]) => name === "setLineDash" && dash?.[0] === 4 && dash?.[1] === 5));
    assert.ok(
        calls.some(([name, , , radius]) => name === "arc" && radius === guided.radius + 5),
        "guided grenades draw the configured gold ring"
    );
    assert.ok(calls.some(([name, key, value]) => name === "set" && key === "strokeStyle" && value === "#ffd166"));
    assert.ok(
        calls.some(([name]) => name === "quadraticCurveTo"),
        "tier 3 homing keeps its curved trail shape"
    );
    assert.ok(
        calls.some(([name, key, value]) => name === "set" && key === "strokeStyle" && value === context.owner.color),
        "the homing trail keeps owner color beside the gold command trail"
    );
    for (let index = 0; index < 12; index += 1) {
        guided.pos = new Vector2(460 + index, 400);
        guided._recordCommandTrail();
    }
    assert.equal(guided.commandTrail.length, 10, "the command trail retains only the latest ten world points");

    const random = new Grenade(context.owner, context.target.position, 1);
    const randomCalls = [];
    const randomCanvas = new Proxy(canvas, {
        set: (_, key, value) => {
            randomCalls.push([key, value]);
            return true;
        }
    });
    random.draw(randomCanvas);
    assert.equal(
        randomCalls.some(([key, value]) => key === "strokeStyle" && value === "#ffd166"),
        false,
        "ordinary random grenades never receive the command highlight"
    );

    const pulses = [];
    context.simulation.spawnPulse = (position, color) => pulses.push({ position, color });
    guided.pos = new Vector2(100, 100);
    guided._detonate(context.simulation);
    random.pos = new Vector2(100, 100);
    random._detonate(context.simulation);
    assert.deepEqual(
        pulses.map(({ color }) => color),
        ["#ffd166"],
        "only a guided detonation reuses the gold pulse"
    );
}

assert.doesNotMatch(
    formatAbilityResult("grenade-command-bombing-line", {
        attemptsPerMatch: NaN,
        successRate: Infinity,
        values: []
    }),
    /NaN|Infinity/
);

console.log("[grenade-command] ok");
