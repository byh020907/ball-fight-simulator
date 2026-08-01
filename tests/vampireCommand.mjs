import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { BatProjectile, BAT_COMMAND_VISUAL_CONFIG } from "../src/entities/batProjectile.js";
import { createRoster } from "../src/roster.js";
import { formatAbilityResult } from "../scripts/dragAbilityMetricFormatters.mjs";

function createContext(options = {}) {
    const roster = createRoster();
    const results = [];
    const simulation = new BattleSimulation(
        [roster.find((fighter) => fighter.id === "vampire"), roster.find((fighter) => fighter.id === "rage")],
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
    target.position = new Vector2(700, 400);
    return { simulation, owner, target, ability: owner.abilities.primary, results };
}

function openWindow(context) {
    context.ability.setCooldownRemaining(0);
    context.ability.update(0, context.target);
    assert.equal(context.ability.commandWindow?.remaining, 0.8);
}

function launch(context, sequence = 1) {
    const intent = context.ability.prepareCommand({
        sequence,
        direction: { x: 1, y: 0 },
        pathSegments: [
            { x: 520, y: 400 },
            { x: 620, y: 460 }
        ],
        bouncePoints: [{ x: 520, y: 400 }],
        createdAt: context.simulation.elapsed
    });
    return context.ability.resolveCommandLaunch(intent);
}

{
    const context = createContext();
    openWindow(context);
    assert.deepEqual(context.ability.getCommandState(), { available: true, reserveResource: false });
    assert.deepEqual(context.ability.getUiState(), { label: "혈로", text: "선두 박쥐가 경로를 유도", progress: 1 });
    assert.equal(launch(context).mode, "default-shot");
    const bats = context.simulation.entities.filter((entity) => entity instanceof BatProjectile);
    assert.equal(bats.length, 7, "command launches the legacy seven bats");
    assert.equal(bats[3].commandGuided, true, "the center bat is the only route lead");
    assert.ok(
        bats.filter((_, index) => index !== 3).every((bat) => !bat.commandGuided),
        "the six outer bats keep the automatic swarm behavior"
    );
    assert.equal(context.ability.cooldownRemaining, 3);
    assert.equal(
        context.simulation.dragCombat.getSnapshot().playerShot.active,
        false,
        "direct resolver defers default shot to runtime"
    );
    assert.equal(
        context.simulation.commandResource.amount,
        1.35,
        "direct resolver never double-spends command resource"
    );
}

for (const [name, finish, reason] of [
    ["owner defeat", (ability) => ability.onOwnerDefeated(), "owner-defeat"],
    ["battle end", (ability) => ability.onBattleEnded(), "battle-ended"]
]) {
    const context = createContext();
    openWindow(context);
    launch(context, 80 + reason.length);
    finish(context.ability);
    finish(context.ability);
    assert.equal(context.results.length, 1, `${name} finalizes the cycle exactly once`);
    assert.equal(context.results[0].value.reason, reason);
}

{
    const context = createContext();
    openWindow(context);
    const start = context.owner.position.clone();
    context.simulation.beginDragCombat(21, start);
    context.simulation.moveDragCombat(21, Vector2.add(start, new Vector2(-220, 0)));
    const result = context.simulation.releaseDragCombat(21);
    const bats = context.simulation.entities.filter((entity) => entity instanceof BatProjectile);
    assert.equal(result.type, "launch");
    assert.equal(context.simulation.dragCombat.getSnapshot().playerShot.active, true, "혈로 keeps generic body flight");
    assert.ok(context.owner.velocity.length() > 0, "혈로 release applies the generic body impulse");
    assert.equal(bats.length, 7);
    assert.equal(bats.filter((bat) => bat.commandGuided).length, 1);
    assert.equal(bats[3].commandGuided, true);
}

{
    const context = createContext();
    openWindow(context);
    context.ability.update(0.8, context.target);
    assert.equal(context.ability.commandWindow, null);
    assert.equal(context.simulation.entities.filter((entity) => entity instanceof BatProjectile).length, 7);
    assert.equal(context.simulation.commandResource.amount, 1.35, "timeout remains free");
}

for (const [name, finishAim] of [
    ["explicit cancel", (context, pointerId) => context.simulation.cancelDragCombat(pointerId)],
    [
        "dead-zone release",
        (context, pointerId, start) => {
            context.simulation.moveDragCombat(pointerId, Vector2.add(start, new Vector2(-10, 0)));
            return context.simulation.releaseDragCombat(pointerId);
        }
    ]
]) {
    const context = createContext();
    openWindow(context);
    const start = context.owner.position.clone();
    const pointerId = 40 + name.length;
    context.simulation.beginDragCombat(pointerId, start);
    context.ability.update(0, context.target);
    assert.equal(finishAim(context, pointerId, start)?.type, "cancel");
    context.ability.update(0, context.target);
    assert.equal(
        context.simulation.entities.filter((entity) => entity instanceof BatProjectile).length,
        7,
        `${name} falls back to one legacy swarm`
    );
    context.ability.update(0, context.target);
    assert.equal(
        context.simulation.entities.filter((entity) => entity instanceof BatProjectile).length,
        7,
        `${name} never double-launches the fallback swarm`
    );
    assert.equal(context.results.length, 0, `${name} never records a command result`);
    assert.equal(context.simulation.commandResource.amount, 1.35, `${name} remains free`);
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
    context.ability.update(0, context.target);
    assert.equal(context.ability.commandWindow, null, `${name} cannot open a command window`);
    assert.equal(context.simulation.entities.filter((entity) => entity instanceof BatProjectile).length, 7);
}

{
    const context = createContext();
    openWindow(context);
    launch(context, 2);
    const bats = context.simulation.entities.filter((entity) => entity instanceof BatProjectile);
    const lead = bats.find((bat) => bat.commandGuided);
    lead.position = new Vector2(520, 400);
    lead.update(0.04, context.simulation);
    assert.equal(lead._commandRouteIndex, 1, "lead consumes a waypoint inside 44px");
    assert.equal(lead.commandRoute.length, 2, "route is deep-copied into the projectile");
    for (const bat of bats) {
        bat.isExpired = true;
        bat._settle();
    }
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, "seven bats settle exactly once into one cycle");
    assert.equal(context.results[0].value.totalBats, 7);
    assert.equal(context.results[0].value.settledBats, 7);
    assert.ok(
        Object.values(context.results[0].value).every((value) => typeof value !== "number" || Number.isFinite(value))
    );
}

{
    const context = createContext();
    openWindow(context);
    launch(context, 3);
    const bats = context.simulation.entities.filter((entity) => entity instanceof BatProjectile);
    const ordinary = bats[0];
    context.owner.hp = 10;
    context.target.hp = 100;
    ordinary.position = context.target.position.clone();
    ordinary.update(0, context.simulation);
    for (const bat of bats) bat._settle();
    context.ability.update(0, context.target);
    const value = context.results[0].value;
    assert.equal(value.totalBites, 1, "ordinary bats contribute to swarm bite totals");
    assert.equal(value.terminalBites, 1, "ordinary terminal bites contribute to success evidence");
    assert.ok(value.actualDamage > 0);
    assert.ok(value.actualHealing > 0);
    assert.equal(value.leadBites, 0, "only the guided center bat contributes leadBites");
}

{
    const context = createContext();
    context.owner.progression.abilityTier = 3;
    openWindow(context);
    launch(context, 4);
    const cycle = context.ability.commandCycles.get(4);
    const lead = context.simulation.entities.filter((entity) => entity instanceof BatProjectile)[3];
    context.target.hp = 100;
    lead.position = context.target.position.clone();
    lead.update(0, context.simulation);
    assert.equal(cycle.bloodMarks, 1, "actual command bat bite creates the tier-three blood mark");
    context.owner.position = context.target.position.clone();
    context.owner.hp = 20;
    context.ability.onCollision(context.target, { contactPoint: context.target.position.clone() });
    assert.equal(cycle.ruptures, 1, "tier-three mark rupture is attributed to the command cycle");
    assert.ok(cycle.actualDamage > 0 && cycle.actualHealing > 0);
    for (const bat of context.simulation.entities.filter((entity) => entity instanceof BatProjectile)) bat._settle();
    context.ability.update(0, context.target);
    assert.equal(context.results.length, 1, "rupture command settles exactly once after all bats finish");
}

{
    const context = createContext();
    context.owner.progression.abilityTier = 2;
    openWindow(context);
    launch(context, 5);
    const bat = context.simulation.entities.filter((entity) => entity instanceof BatProjectile)[0];
    context.owner.hp = 10;
    context.target.hp = 100;
    bat.position = context.target.position.clone();
    bat._onExpired(context.simulation);
    assert.ok(bat._commandActualDamage > 0 && bat._commandActualHealing > 0, "life burst settles into command totals");
    for (const other of context.simulation.entities.filter((entity) => entity instanceof BatProjectile))
        other._settle();
    context.ability.update(0, context.target);
    assert.ok(context.results[0].value.actualDamage > 0 && context.results[0].value.actualHealing > 0);
}

{
    const context = createContext();
    const second = { ...createRoster().find((fighter) => fighter.id === "archer"), id: "second-target" };
    const simulation = new BattleSimulation(
        [
            createRoster().find((fighter) => fighter.id === "vampire"),
            createRoster().find((fighter) => fighter.id === "rage"),
            second
        ],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false, dragCombatEnabled: true, abilityCommandEnabled: true, commandResourceEnabled: true }
    );
    const owner = simulation.fighters[0];
    const [nearest, terminal] = simulation.fighters.slice(1);
    simulation.setPlayerBall(owner);
    owner.position = new Vector2(400, 400);
    nearest.position = new Vector2(500, 400);
    terminal.position = new Vector2(700, 400);
    const ability = owner.abilities.primary;
    ability.setCooldownRemaining(0);
    ability.update(0, nearest);
    const intent = ability.prepareCommand({
        sequence: 6,
        direction: { x: 1, y: 0 },
        pathSegments: [{ x: 600, y: 400 }],
        bouncePoints: [],
        predictedTerminal: terminal.position.clone()
    });
    ability.resolveCommandLaunch(intent);
    const lead = simulation.entities.filter((entity) => entity instanceof BatProjectile)[3];
    const ordinary = simulation.entities.filter((entity) => entity instanceof BatProjectile)[0];
    assert.equal(lead.commandTerminalTargetId, terminal.id, "predicted terminal overrides the nearer window target");
    lead._commandRouteIndex = lead.commandRoute.length;
    assert.equal(
        ordinary._getGuidanceTarget(simulation),
        nearest,
        "ordinary swarm bats retain nearest-enemy guidance instead of terminal lock"
    );
    terminal.flags.defeated = true;
    assert.equal(lead._getGuidanceTarget(simulation), nearest, "defeated terminal falls back to nearest enemy");
}

{
    assert.deepEqual(BAT_COMMAND_VISUAL_CONFIG, {
        color: "#ff6f91",
        outlineWidth: 2,
        waypointRadius: 3,
        trailLength: 14,
        trailInterval: 0.04,
        trailLifetime: 0.32,
        lineWidth: 3,
        dash: [6, 5]
    });
    const context = createContext();
    const bat = new BatProjectile(context.owner, new Vector2(450, 400), new Vector2(100, 0), [], {
        commandGuided: true
    });
    bat._recordCommandTrail(0.04);
    bat._recordCommandTrail(0.04);
    const calls = [];
    const canvas = new Proxy(
        {},
        {
            get:
                (_, key) =>
                (...args) =>
                    calls.push([key, ...args]),
            set: (_, key, value) => {
                calls.push(["set", key, value]);
                return true;
            }
        }
    );
    bat.draw(canvas);
    assert.ok(calls.some(([name, key, value]) => name === "set" && key === "strokeStyle" && value === "#ff6f91"));
    assert.ok(calls.some(([name, dash]) => name === "setLineDash" && dash?.[0] === 6));
    const batDraw = calls.findIndex(
        ([name, key, value]) => name === "set" && key === "fillStyle" && value === "#331122"
    );
    const markerDraw = calls.findLastIndex(
        ([name, key, value]) => name === "set" && key === "fillStyle" && value === "#ff6f91"
    );
    assert.ok(markerDraw > batDraw, "the command marker draws after the bat body");
}

assert.doesNotMatch(
    formatAbilityResult("vampire-command-blood-route", { attemptsPerMatch: NaN, successRate: Infinity, values: [] }),
    /NaN|Infinity/
);
console.log("[vampire-command] ok");
