import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createDragCombatConfig, getDragLaunchSpeed } from "../src/combat-drag/index.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation(onDragCombatEvent, options = {}) {
    const specs = createRoster()
        .slice(0, 4)
        .map((spec, index) => ({ ...spec, teamId: index === 0 ? "player" : "enemy" }));
    const simulation = new BattleSimulation(specs, { onLog() {}, onSound() {}, onDragCombatEvent }, null, {
        assignActions: false,
        dragCombatEnabled: true,
        ...options
    });
    simulation.playerBall = simulation.fighters[0];
    simulation.fighters.forEach((fighter, index) => {
        fighter.position = new Vector2(200 + index * 180, 480);
        fighter.velocity = new Vector2();
        fighter.physicsDebug.clear();
    });
    return simulation;
}

function createAutomatedSimulation(onDragCombatEvent) {
    const specs = createRoster()
        .slice(0, 2)
        .map((spec, index) => ({ ...spec, teamId: `team-${index}` }));
    const simulation = new BattleSimulation(specs, { onLog() {}, onSound() {}, onDragCombatEvent }, null, {
        assignActions: false,
        dragCombatEnabled: true,
        dragCombatAutomated: true
    });
    simulation.fighters.forEach((fighter, index) => {
        fighter.position = new Vector2(240 + index * 480, 480);
        fighter.velocity = new Vector2();
        fighter.physicsDebug.clear();
    });
    return simulation;
}

function impulseCount(fighter) {
    return fighter.physicsDebug.toArray().filter((event) => event.type === "impulse").length;
}

function launchPlayer(simulation, pointerId) {
    assert.deepEqual(simulation.beginDragCombat(pointerId, { x: 20, y: 20 }), { type: "begin" });
    simulation.moveDragCombat(pointerId, { x: -120, y: 20 });
    assert.equal(simulation.releaseDragCombat(pointerId).type, "launch");
}

function resolveActualEnemyCollision({ activeFlight }) {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    let simulation;
    try {
        simulation = createSimulation();
    } finally {
        Math.random = originalRandom;
    }
    const runtime = simulation.dragCombat;
    if (activeFlight) {
        runtime.tickEnemy(0);
        runtime.tickEnemy(1);
    }
    const attacker = activeFlight
        ? simulation.fighters.find((fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId)
        : simulation.fighters[1];
    const player = simulation.playerBall;
    attacker.position = new Vector2(450, 480);
    player.position = new Vector2(500, 480);
    attacker.velocity = new Vector2(300, 0);
    player.velocity = new Vector2(-120, 0);
    const hpBefore = player.hp;
    const context = simulation.handleFighterCollision(attacker, player);
    return { context, playerDamage: hpBefore - player.hp, runtime, attacker };
}

{
    const eventTypes = [];
    const simulation = createSimulation((snapshot) => eventTypes.push(snapshot.lastEvent?.type));
    simulation.dragCombat.tickEnemy(0);
    simulation.dragCombat.tickEnemy(1);
    assert.deepEqual(eventTypes.slice(0, 2), ["enemy-windup", "enemy-launch"]);
}

{
    const simulation = createAutomatedSimulation();
    const runtime = simulation.dragCombat;
    const [first, second] = simulation.fighters;

    assert.equal(simulation.playerBall, null, "automated character match must not need a fake player");
    assert.equal(runtime.begin(91, { x: 0, y: 0 }), null, "spectated automated matches must reject manual drag input");

    runtime.tickEnemy(0);
    const windup = runtime.getSnapshot();
    assert.equal(windup.automated, true);
    assert.equal(windup.enemyQueue.phase, "windup");
    assert.equal(windup.enemyQueue.attackerId, first.id);
    assert.equal(windup.enemyQueue.targetId, second.id);

    second.position.y += 180;
    const expected = Vector2.subtract(second.position, first.position).normalize();
    runtime.tickEnemy(1);
    const firstImpulse = first.physicsDebug.toArray().find((event) => event.type === "impulse");
    const firstImpulseLength = Math.hypot(firstImpulse?.impulse.x ?? 0, firstImpulse?.impulse.y ?? 0);
    assert.ok(firstImpulse);
    assert.ok(Math.abs(firstImpulse.impulse.x / firstImpulseLength - expected.x) < 1e-8);
    assert.ok(Math.abs(firstImpulse.impulse.y / firstImpulseLength - expected.y) < 1e-8);

    runtime.resolveFighterCollision({ a: first, b: second, hostile: true });
    const nextWindup = runtime.getSnapshot().enemyQueue;
    assert.equal(nextWindup.phase, "windup");
    assert.equal(nextWindup.attackerId, second.id, "the opposing character should aim immediately after contact");
    assert.equal(nextWindup.targetId, first.id);

    runtime.tickEnemy(1);
    assert.ok(second.physicsDebug.toArray().some((event) => event.type === "impulse"));
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    const [player, firstEnemy] = simulation.fighters;
    runtime.tickEnemy(0);
    const windupSnapshot = runtime.getSnapshot().enemyQueue;
    assert.equal(windupSnapshot.phase, "windup");
    assert.equal(windupSnapshot.windupDuration, 1);
    assert.equal(windupSnapshot.flightDuration, 1.8);
    const initial = windupSnapshot.windupDirection;
    player.position.y += 150;
    runtime.tickEnemy(0.6);
    const tracked = runtime.getSnapshot().enemyQueue.windupDirection;
    assert.notDeepEqual(tracked, initial, "windup telegraph follows the current player position");
    player.position.y += 150;
    const expected = Vector2.subtract(player.position, firstEnemy.position).normalize();
    runtime.tickEnemy(0.4);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "flight");
    const impulse = firstEnemy.physicsDebug.toArray().find((event) => event.type === "impulse");
    assert.ok(impulse);
    assert.ok(
        Math.abs(
            Math.hypot(impulse.impulse.x, impulse.impulse.y) -
                getDragLaunchSpeed(firstEnemy.stats.baseSpeed, 1, runtime.config.shot)
        ) < 1e-8
    );
    assert.ok(Math.abs(impulse.impulse.x / Math.hypot(impulse.impulse.x, impulse.impulse.y) - expected.x) < 1e-8);
    assert.ok(Math.abs(impulse.impulse.y / Math.hypot(impulse.impulse.x, impulse.impulse.y) - expected.y) < 1e-8);
}

{
    const config = createDragCombatConfig(1.5);
    const simulation = createSimulation(undefined, { dragCombatConfig: config });
    const runtime = simulation.dragCombat;
    runtime.tickEnemy(0);
    runtime.tickEnemy(1);
    const attacker = simulation.fighters.find((fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId);
    const impulse = attacker.physicsDebug.toArray().find((event) => event.type === "impulse");
    assert.ok(
        Math.abs(
            Math.hypot(impulse.impulse.x, impulse.impulse.y) -
                getDragLaunchSpeed(attacker.stats.baseSpeed, 1, config.shot)
        ) < 1e-8,
        "enemy dash uses the same tuned maximum drag output as the player"
    );
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    runtime.tickEnemy(0);
    launchPlayer(simulation, 2);
    runtime.tickEnemy(1);
    const attacker = simulation.fighters.find((fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId);
    const otherEnemy = simulation.fighters.find((fighter) => fighter !== attacker && fighter !== simulation.playerBall);
    runtime.resolveFighterCollision({ a: attacker, b: otherEnemy, hostile: false });
    const afterMiss = runtime.getSnapshot().enemyQueue;
    assert.equal(afterMiss.phase, "windup");
    runtime.tickEnemy(1.2);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "flight", "next enemy launches after its own windup");
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    runtime.tickEnemy(0);
    assert.equal(runtime.getSnapshot().enemyQueue.elapsed, 0);
    assert.deepEqual(simulation.beginDragCombat(3, { x: 0, y: 0 }), { type: "begin" });
    runtime.tickEnemy(1);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "windup");
    assert.ok(Math.abs(runtime.getSnapshot().enemyQueue.elapsed - 0.35) < 1e-8);
    simulation.cancelDragCombat(3);
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    runtime.tickEnemy(0);
    runtime.tickEnemy(1);
    const attacker = simulation.fighters.find((fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId);
    const player = simulation.playerBall;
    const result = runtime.resolveFighterCollision({ a: attacker, b: player, hostile: true });
    const context = { a: attacker, b: player, hostile: true, damageFromAToB: 10, damageFromBToA: 8 };
    runtime.applyResolvedFighterCollision(context, result, { damageFromAToB: 10, damageFromBToA: 8 });
    assert.equal(context.damageFromAToB, 13.5);
    assert.equal(context.damageFromBToA, 8);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "windup");
}

{
    const natural = resolveActualEnemyCollision({ activeFlight: false });
    const active = resolveActualEnemyCollision({ activeFlight: true });
    assert.ok(natural.playerDamage > 0);
    assert.equal(
        active.context.damageFromBToA,
        natural.context.damageFromBToA,
        "player outgoing damage stays unchanged by enemy flight"
    );
    assert.ok(
        active.context.damageFromAToB > natural.context.damageFromAToB,
        "only the active attacker final HP damage receives the enemy-flight multiplier"
    );
    assert.equal(
        active.runtime.getSnapshot().enemyQueue.phase,
        "windup",
        "first character collision immediately starts next windup"
    );
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    runtime.tickEnemy(0);
    runtime.tickEnemy(1);
    const attacker = simulation.fighters.find((fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId);
    attacker.velocity = new Vector2();
    runtime.tickEnemy(0.1);
    assert.equal(runtime.enemySlowElapsed, 0.1);
    simulation.notifyFighterStaticCollision(attacker, { surfaceKey: "wall:left" });
    assert.equal(runtime.enemySlowElapsed, 0, "static bounce resets enemy slow accumulation");
    runtime.tickEnemy(0.15);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "flight");

    runtime.enemyDirections.set("stale", { x: 1, y: 1 });
    runtime.resolveFighterCollision({ a: attacker, b: simulation.playerBall, hostile: true });
    assert.equal(runtime.enemyDirections.size, 1, "only the active windup direction survives");
    const snapshot = runtime.getSnapshot();
    snapshot.enemyQueue.windupDirection.x = 99;
    snapshot.enemyQueue.lastResolution.attackerId = "mutated";
    assert.notEqual(runtime.getSnapshot().enemyQueue.windupDirection.x, 99);
    assert.notEqual(runtime.getSnapshot().enemyQueue.lastResolution.attackerId, "mutated");
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    const attackers = [];
    runtime.tickEnemy(0);
    for (let index = 0; index < 3; index += 1) {
        runtime.tickEnemy(1);
        attackers.push(runtime.getSnapshot().enemyQueue.attackerId);
        const attacker = simulation.fighters.find((fighter) => fighter.id === attackers.at(-1));
        runtime.resolveFighterCollision({ a: attacker, b: simulation.playerBall, hostile: true });
    }
    assert.deepEqual(attackers, ["orbit", "trickster", "grenade"], "a→b→c flights remain round-robin");

    for (const invalidate of [
        (fighter) => (fighter.flags.defeated = true),
        (fighter) => fighter.participation.setMode("standby"),
        (fighter) => (fighter.state.swallowed = true),
        (fighter) => (fighter.state.movement = {})
    ]) {
        const skipped = createSimulation();
        const skippedRuntime = skipped.dragCombat;
        invalidate(skipped.fighters[2]);
        skippedRuntime.tickEnemy(0);
        skippedRuntime.tickEnemy(1);
        const first = skipped.fighters.find(
            (fighter) => fighter.id === skippedRuntime.getSnapshot().enemyQueue.attackerId
        );
        skippedRuntime.resolveFighterCollision({ a: first, b: skipped.playerBall, hostile: true });
        assert.notEqual(skippedRuntime.getSnapshot().enemyQueue.attackerId, skipped.fighters[2].id);
    }
}

{
    for (const [speed, delta] of [
        [0, 0.2],
        [100, 1.8]
    ]) {
        const simulation = createSimulation();
        const runtime = simulation.dragCombat;
        runtime.tickEnemy(0);
        runtime.tickEnemy(1);
        const attacker = simulation.fighters.find(
            (fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId
        );
        attacker.velocity = new Vector2(speed, 0);
        runtime.tickEnemy(delta);
        assert.equal(
            runtime.getSnapshot().enemyQueue.phase,
            "windup",
            "slow-stop/timeout immediately start next windup"
        );
    }
}

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    runtime.tickEnemy(0);
    runtime.tickEnemy(1);
    const attacker = simulation.fighters.find((fighter) => fighter.id === runtime.getSnapshot().enemyQueue.attackerId);
    simulation.playerBall.stats.baseSpeed = 1000;
    attacker.stats.baseSpeed = 100;
    attacker.velocity = new Vector2(200, 0);
    runtime.tickEnemy(0.2);
    assert.equal(
        runtime.getSnapshot().enemyQueue.phase,
        "flight",
        "enemy slow-stop threshold must use the attacker's own base speed"
    );
}

{
    const empty = createSimulation();
    empty.dragCombat.tickEnemy(0);
    launchPlayer(empty, 74);
    empty.fighters.slice(1).forEach((fighter) => (fighter.flags.defeated = true));
    empty.dragCombat.tickEnemy(0);
    const snapshot = empty.dragCombat.getSnapshot().enemyQueue;
    assert.equal(snapshot.phase, "idle");
    assert.equal(empty.dragCombat.enemyDirections.size, 0);
}

{
    const simulation = createSimulation();
    let maxOrder = 0;
    for (let iteration = 0; iteration < 1000; iteration += 1) {
        simulation.dragCombat.tickEnemy(0);
        maxOrder = Math.max(maxOrder, simulation.dragCombat.getSnapshot().enemyQueue.lastResolution ? 1 : 0);
        simulation.dragCombat.reset();
        const snapshot = simulation.dragCombat.getSnapshot();
        assert.equal(snapshot.enemyQueue.phase, "idle");
        assert.equal(snapshot.enemyQueue.attackerId, null);
    }
    assert.equal(maxOrder, 1);
    assert.equal(impulseCount(simulation.playerBall), 0);
}

console.log("[drag-enemy-runtime] ok");
