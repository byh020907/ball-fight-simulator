import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { ElementalOrb } from "../src/entities/index.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";
import { selectRecallRoute } from "../src/abilities/elementalistRecallRoute.js";
import { ELEMENTALIST_RECALL_VISUAL_CONFIG, ElementalistRecallEffect } from "../src/effects/index.js";

function createContext() {
    const roster = createRoster();
    const elementalist = roster.find((fighter) => fighter.id === "elementalist");
    const rage = roster.find((fighter) => fighter.id === "rage");
    const results = [];
    const simulation = new BattleSimulation(
        [elementalist, rage],
        { onLog() {}, onSound() {}, onAbilityResult: (event) => results.push(event) },
        null,
        {
            assignActions: false,
            dragCombatEnabled: true,
            abilityCommandEnabled: true,
            commandResourceEnabled: true
        }
    );
    const [owner, target] = simulation.fighters;
    simulation.setPlayerBall(owner);
    owner.position = new Vector2(400, 400);
    target.position = new Vector2(600, 400);
    return { simulation, owner, target, ability: owner.abilities.primary, results };
}

function addOrb(context, element, x, y) {
    const orb = new ElementalOrb({
        owner: context.owner,
        element,
        position: new Vector2(x, y),
        targetMemory: context.target,
        ability: context.ability
    });
    orb.createdAt = context.simulation.elapsed;
    context.ability.activeOrbs.push(orb);
    context.simulation.entities.push(orb);
    return orb;
}

function releaseCommand(context, offset = { x: -180, y: 0 }) {
    const { x, y } = context.owner.position;
    context.simulation.beginDragCombat(1, { x, y });
    context.simulation.moveDragCombat(1, { x: x + offset.x, y: y + offset.y });
    return context.simulation.releaseDragCombat(1);
}

function prepareAndLaunch(
    context,
    sequence,
    { pathSegments = [{ x: 700, y: 400 }], predictedTerminal = { x: 600, y: 400 } } = {}
) {
    context.ability.prepareCommand({
        sequence,
        pathSegments,
        bouncePoints: pathSegments.slice(0, -1),
        predictedTerminal,
        createdAt: context.simulation.elapsed
    });
    return context.ability.resolveCommandLaunch({ sequence });
}

function tickCommandChannels(context, duration, step = 0.08) {
    for (let elapsed = 0; elapsed < duration - 1e-9; elapsed += step) {
        context.ability._updateChannels(Math.min(step, duration - elapsed));
        context.ability._finalizeCompletedCommandCycles();
    }
}

{
    const context = createContext();
    assert.deepEqual(context.ability.getCommandState(), { available: false, reserveResource: true });
    context.simulation.commandResource.amount = 0;
    assert.deepEqual(context.ability.getCommandState(), { available: false, reserveResource: false });
    addOrb(context, "fire", 480, 400);
    context.simulation.commandResource.amount = 1;
    assert.deepEqual(context.ability.getCommandState(), { available: true, reserveResource: false });
    assert.equal(context.ability.getUiState().label, "원소 회수선");
    assert.equal(context.ability.getUiState().text, "오브 1/8 · 경로로 회수");
    context.simulation.playerBall = context.target;
    assert.deepEqual(context.ability.getCommandState(), { available: false, reserveResource: false });
}

{
    const context = createContext();
    const orb = addOrb(context, "fire", 480, 400);
    context.ability.prepareCommand({
        sequence: 4,
        pathSegments: [{ x: 700, y: 400 }],
        bouncePoints: [],
        predictedTerminal: { x: 600, y: 400 },
        createdAt: 0
    });
    orb.expire();
    assert.equal(context.ability.resolveCommandLaunch({ sequence: 4 }).mode, "payload-only");
    assert.equal(context.ability.activeChannels.length, 0, "an invalidated route never consumes another payload");
    assert.equal(context.results[0].value.reason, "route-miss");
    assert.equal(context.results[0].value.selectedOrbs, 0);
}

{
    const context = createContext();
    addOrb(context, "fire", 500, 400);
    releaseCommand(context);
    assert.equal(context.simulation.commandResource.amount, 0, "runtime release spends resource once");
    assert.equal(
        context.simulation.dragCombat.getSnapshot().playerShot.active,
        false,
        "runtime release is payload-only"
    );
    const cancel = createContext();
    addOrb(cancel, "fire", 500, 400);
    cancel.simulation.beginDragCombat(1, cancel.owner.position);
    cancel.simulation.cancelDragCombat(1);
    assert.equal(cancel.simulation.commandResource.amount, 1, "cancel preserves resource");
    const deadZone = createContext();
    addOrb(deadZone, "fire", 500, 400);
    deadZone.simulation.beginDragCombat(1, deadZone.owner.position);
    deadZone.simulation.moveDragCombat(1, { x: deadZone.owner.position.x - 1, y: deadZone.owner.position.y });
    deadZone.simulation.releaseDragCombat(1);
    assert.equal(deadZone.simulation.commandResource.amount, 1, "dead-zone release preserves resource");
}

{
    const context = createContext();
    context.owner.progression.abilityTier = 3;
    const first = addOrb(context, "fire", 480, 400);
    const second = addOrb(context, "electric", 540, 400);
    const route = selectRecallRoute({
        ownerPosition: context.owner.position,
        pathSegments: [{ x: 700, y: 400 }],
        orbs: [first, second],
        tier: 3
    });
    assert.equal(route.selectedOrbs.length, 2, "tier 3 route selects ordered distinct normal orbs");
    context.ability.prepareCommand({
        sequence: 1,
        pathSegments: [{ x: 700, y: 400 }],
        bouncePoints: [],
        predictedTerminal: { x: 600, y: 400 },
        createdAt: 0
    });
    const launch = context.ability.resolveCommandLaunch({ sequence: 1 });
    assert.equal(launch.mode, "payload-only");
    assert.equal(
        context.simulation.dragCombat.getSnapshot().playerShot.active,
        false,
        "recall never starts a generic body shot"
    );
    assert.equal(context.ability.activeOrbs.length, 0, "selected materials are consumed into one channel");
    for (let index = 0; index < 26; index += 1) context.ability.update(0.08, context.target);
    assert.equal(context.results.length, 1, "completed command records once");
    assert.equal(context.results[0].resultType, "elementalist-command-recall-route");
    assert.equal(context.results[0].value.recipeBuilt, true);
    assert.equal(context.results[0].value.targetLocked, true);
    assert.equal(context.results[0].value.channelCompleted, true);
    assert.equal(context.results[0].value.reason, "completed");
    assert.ok(context.results[0].value.actualDamage > 0, "completed command records actual channel damage");
}

{
    const context = createContext();
    addOrb(context, "fire", 480, 500);
    context.ability.prepareCommand({
        sequence: 3,
        pathSegments: [{ x: 700, y: 400 }],
        bouncePoints: [],
        predictedTerminal: { x: 700, y: 400 },
        createdAt: 0
    });
    assert.equal(context.ability.resolveCommandLaunch({ sequence: 3 }).mode, "payload-only");
    assert.equal(context.results[0].success, false, "route miss fails without a generic shot");
    assert.equal(context.results[0].value.reason, "route-miss");
}

for (const tier of [0, 1, 2]) {
    const context = createContext();
    context.owner.progression.abilityTier = tier;
    const first = addOrb(context, "fire", 480, 400);
    const second = addOrb(context, "electric", 540, 400);
    prepareAndLaunch(context, 10 + tier);
    assert.equal(first.isExpired, true, `tier ${tier} recalls the first orb`);
    assert.equal(second.isExpired, false, `tier ${tier} preserves the second orb`);
    assert.deepEqual(context.ability.activeChannels[0].elements, ["fire"]);
    assert.equal(context.ability.activeChannels[0].recipe, null, `tier ${tier} does not unlock fusion early`);
}

{
    const context = createContext();
    context.owner.progression.abilityTier = 3;
    const first = addOrb(context, "fire", 480, 400);
    const same = addOrb(context, "fire", 520, 400);
    prepareAndLaunch(context, 20);
    assert.equal(first.isExpired, true);
    assert.equal(same.isExpired, false, "same-element follower remains for a later route");
    assert.equal(context.ability.activeChannels[0].recipe, null);
}

{
    const context = createContext();
    context.owner.progression.abilityTier = 3;
    const composite = addOrb(context, "fire", 480, 400);
    composite.elements = ["fire", "electric"];
    composite.isComposite = true;
    composite.recipe = context.ability.getCombinationRecipe("fire", "electric");
    const later = addOrb(context, "earth", 540, 400);
    prepareAndLaunch(context, 21);
    assert.equal(composite.isExpired, true, "first composite is recalled directly");
    assert.equal(later.isExpired, false, "composite recall never consumes another material");
    assert.equal(context.ability.activeChannels[0].recipe.id, "plasma_drill");
}

{
    const context = createContext();
    const inside = addOrb(context, "fire", 500, 428);
    const outside = addOrb(context, "electric", 540, 428.01);
    const route = selectRecallRoute({
        ownerPosition: context.owner.position,
        pathSegments: [{ x: 700, y: 400 }],
        orbs: [outside, inside],
        tier: 3
    });
    assert.deepEqual(route.selectedOrbs, [inside], "28px corridor includes its edge and excludes values above it");
}

{
    const context = createContext();
    context.owner.progression.abilityTier = 3;
    const firstSegmentOrb = addOrb(context, "fire", 480, 400);
    const secondSegmentOrb = addOrb(context, "electric", 500, 520);
    const route = selectRecallRoute({
        ownerPosition: context.owner.position,
        pathSegments: [new Vector2(500, 400), new Vector2(500, 650)],
        orbs: [secondSegmentOrb, firstSegmentOrb],
        tier: 3
    });
    assert.deepEqual(route.selectedOrbs, [firstSegmentOrb, secondSegmentOrb], "absolute segments keep route order");
}

{
    const context = createContext();
    addOrb(context, "fire", 480, 400);
    prepareAndLaunch(context, 30, { predictedTerminal: { x: 700, y: 650 } });
    const cycle = context.ability.commandCycles.get(30);
    assert.equal(cycle.targetLocked, false, "terminal miss does not claim a target lock");
    assert.equal(cycle.channel.target, context.target, "terminal miss falls back to the existing nearest policy");
}

{
    const context = createContext();
    const pulseEvents = [];
    context.simulation.spawnPulse = (position, color) => pulseEvents.push({ position, color });
    addOrb(context, "fire", 480, 500);
    prepareAndLaunch(context, 31, { predictedTerminal: { x: 710, y: 410 } });
    assert.equal(pulseEvents.at(-1).color, "#9aa0a6", "route miss emits the muted failure pulse");
    assert.deepEqual(pulseEvents.at(-1).position, new Vector2(710, 410));
}

{
    const context = createContext();
    const intent = { sequence: 32, pathSegments: [{ x: 700, y: 400 }], bouncePoints: [] };
    assert.equal(context.ability.prepareCommand(intent), intent, "unavailable state does not prepare a command");
    assert.equal(context.ability.resolveCommandLaunch(intent).mode, "default-shot");
    context.simulation.abilityCommandEnabled = false;
    assert.deepEqual(context.ability.getCommandState(), { available: false, reserveResource: false });
    context.simulation.abilityCommandEnabled = true;
    context.simulation.dragCombat.automated = true;
    assert.deepEqual(context.ability.getCommandState(), { available: false, reserveResource: false });
}

{
    const context = createContext();
    addOrb(context, "fire", 480, 400);
    context.ability.prepareCommand({
        sequence: 33,
        pathSegments: [{ x: 700, y: 400 }],
        bouncePoints: [],
        predictedTerminal: { x: 600, y: 400 }
    });
    context.ability.onCommandEnd({ commandSequence: 33, reason: "expired" });
    assert.equal(context.ability.preparedCommand, null, "expired intents clear prepared route state");
    assert.equal(context.ability.resolveCommandLaunch({ sequence: 33 }).mode, "default-shot");
}

{
    const context = createContext();
    context.target.position = new Vector2(1100, 400);
    addOrb(context, "fire", 480, 400);
    prepareAndLaunch(context, 40, { predictedTerminal: null });
    tickCommandChannels(context, 0.5, 0.1);
    assert.equal(context.results.length, 0, "pending detection does not settle early");
    context.target.position = new Vector2(600, 400);
    tickCommandChannels(context, 1.5, 0.05);
    assert.equal(context.results[0].success, true, "late target acquisition can still complete");
    assert.equal(context.results[0].value.channelStarted, true);
    assert.equal(context.results[0].value.reason, "completed");
}

{
    const context = createContext();
    context.target.position = new Vector2(1100, 400);
    addOrb(context, "fire", 480, 400);
    prepareAndLaunch(context, 41, { predictedTerminal: null });
    tickCommandChannels(context, 2, 0.1);
    assert.equal(context.results[0].success, false, "a detection channel without a target is not a success");
    assert.equal(context.results[0].value.channelStarted, false);
    assert.equal(context.results[0].value.reason, "no-target");
}

for (const [index, endCycle] of [
    (context) => (context.target.position = new Vector2(1100, 400)),
    (context) => (context.target.flags.defeated = true)
].entries()) {
    const context = createContext();
    addOrb(context, "fire", 480, 400);
    prepareAndLaunch(context, 50 + index);
    endCycle(context);
    tickCommandChannels(context, 0.01, 0.01);
    assert.equal(context.results.length, 1);
    assert.equal(context.results[0].success, false);
    assert.equal(context.results[0].value.reason, "cancelled");
}

for (const [sequence, finish, expectedReason] of [
    [60, (context) => context.ability.onOwnerDefeated(), "owner-defeat"],
    [61, (context) => context.ability.onBattleEnded(), "battle-ended"]
]) {
    const context = createContext();
    addOrb(context, "fire", 480, 400);
    prepareAndLaunch(context, sequence);
    const recall = context.simulation.entities.find((entity) => entity instanceof ElementalistRecallEffect);
    finish(context);
    finish(context);
    assert.equal(context.results.length, 1, `${expectedReason} settles exactly once`);
    assert.equal(context.results[0].success, false);
    assert.equal(context.results[0].value.reason, expectedReason);
    assert.equal(context.ability.preparedCommand, null);
    assert.equal(recall.isExpired, true, `${expectedReason} removes recall VFX`);
}

assert.doesNotMatch(
    formatAbilityResult("elementalist-command-recall-route", {
        attemptsPerMatch: NaN,
        successRate: Infinity,
        values: []
    }),
    /NaN|Infinity/
);

{
    const context = createContext();
    assert.deepEqual(ELEMENTALIST_RECALL_VISUAL_CONFIG, {
        duration: 0.36,
        tetherWidth: 3,
        tetherDash: [5, 4],
        beadRadius: 4,
        ringPadding: 10
    });
    const composite = addOrb(context, "fire", 480, 400);
    composite.elements = ["fire", "electric"];
    composite.isComposite = true;
    const effect = new ElementalistRecallEffect({ owner: context.owner, orbs: [composite] });
    const calls = [];
    const ctx = new Proxy(
        {},
        {
            get: (_, key) => (typeof key === "string" ? (...args) => calls.push([key, ...args]) : undefined),
            set: (_, key, value) => {
                calls.push(["set", key, value]);
                return true;
            }
        }
    );
    effect.draw(ctx);
    assert.ok(
        calls.some(([name, ...args]) => name === "setLineDash" && args[0][0] === 5),
        "recall tether is dashed"
    );
    assert.ok(
        calls.some(([name, ...args]) => name === "arc" && args[2] === composite.radius + 10),
        "ring uses orb radius"
    );
    assert.ok(
        ["#ff7043", "#ffe066"].every((color) =>
            calls.some(([name, key, value]) => name === "set" && key === "strokeStyle" && value === color)
        ),
        "composite recall keeps both elemental palette colors"
    );
    effect.update(0.36, context.simulation);
    assert.equal(effect.isExpired, true, "recall effect expires at 0.36 seconds");
}
console.log("[elementalist-command] ok");
