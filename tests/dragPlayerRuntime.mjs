import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createDragCombatConfig, getDragLaunchSpeed } from "../src/combat-drag/index.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation(enabled = true, options = {}, fighterSpecs = createRoster()) {
    const [playerSpec, enemySpec] = fighterSpecs;
    const simulation = new BattleSimulation([playerSpec, enemySpec], { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        ...(enabled === "omitted" ? {} : { dragCombatEnabled: enabled }),
        ...options
    });
    simulation.playerBall = simulation.fighters[0];
    simulation.fighters[0].position = new Vector2(240, 480);
    simulation.fighters[1].position = new Vector2(720, 480);
    simulation.fighters.forEach((fighter) => fighter.applyImpulse(fighter.velocity.clone().scale(-1)));
    simulation.fighters.forEach((fighter) => fighter.physicsDebug.clear());
    return simulation;
}

function impulseEvents(fighter) {
    return fighter.physicsDebug.toArray().filter((entry) => entry.type === "impulse");
}

function impulseCount(fighter) {
    return impulseEvents(fighter).length;
}

function clearImpulseEvents(fighter) {
    fighter.physicsDebug.clear();
}

function beginWithVector(simulation, pointerId, point = { x: 20, y: 20 }, current = { x: -120, y: 20 }) {
    assert.deepEqual(simulation.beginDragCombat(pointerId, point), { type: "begin" });
    assert.equal(simulation.moveDragCombat(pointerId, current).active, true);
}

function assertIdleAndClean(simulation) {
    const snapshot = simulation.dragCombat.getSnapshot();
    assert.equal(snapshot.drag.state, "idle");
    assert.equal(snapshot.playerShot.active, false);
    assert.equal(snapshot.playerShot.shields.length, 0);
    assert.equal(simulation._clickActionContext.timeWarps.size, 0);
}

function assertFiniteSnapshot(snapshot) {
    const visit = (value) => {
        if (typeof value === "number") return Number.isFinite(value);
        if (!value || typeof value !== "object") return true;
        return Object.values(value).every(visit);
    };
    assert.equal(visit(snapshot), true, "runtime snapshot contains a non-finite value");
}

{
    let disabled;
    let omitted;
    const snapshot = (simulation) => ({
        position: simulation.playerBall.position.clone(),
        hp: simulation.playerBall.hp,
        timeWarps: simulation._clickActionContext.timeWarps.size,
        impulseCount: impulseCount(simulation.playerBall)
    });
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
        disabled = createSimulation(false);
        omitted = createSimulation("omitted");
        for (let tick = 0; tick < 50; tick += 1) {
            disabled.update(0.1, 0.1);
            omitted.update(0.1, 0.1);
        }
    } finally {
        Math.random = originalRandom;
    }
    const disabledState = snapshot(disabled);
    const omittedState = snapshot(omitted);
    assert.equal(disabled.dragCombat, null);
    assert.equal(omitted.dragCombat, null);
    assert.equal(disabled.beginDragCombat(1, { x: 0, y: 0 }), null);
    assert.equal(
        Math.hypot(
            disabledState.position.x - omittedState.position.x,
            disabledState.position.y - omittedState.position.y
        ),
        0
    );
    assert.equal(disabledState.hp - omittedState.hp, 0);
    assert.equal(disabledState.timeWarps - omittedState.timeWarps, 0);
    assert.equal(disabledState.impulseCount - omittedState.impulseCount, 0);
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    const enemy = simulation.getOpponent(player);
    assert.equal(simulation.dragCombat.getSnapshot().enabled, true);
    beginWithVector(simulation, 7);
    simulation.dragCombat.tickInput(0.35);
    const aimingSnapshot = simulation.dragCombat.getSnapshot();
    assert.equal(aimingSnapshot.drag.aimElapsed, 0.35);
    assert.equal(aimingSnapshot.drag.maxAimSeconds, 1.2);
    assert.equal(aimingSnapshot.drag.cooldownSeconds, 2);
    assert.equal(simulation._clickActionContext.timeWarps.get(player), Infinity);
    assert.equal(impulseCount(player), 0, "move must not apply an impulse");
    simulation.cancelDragCombat(7);
    assertIdleAndClean(simulation);

    assert.deepEqual(simulation.beginDragCombat(8, { x: 20, y: 20 }), { type: "begin" });
    assert.equal(simulation.moveDragCombat(8, { x: 30, y: 20 }).active, false);
    assert.equal(simulation.releaseDragCombat(8).type, "cancel");
    assert.equal(impulseCount(player), 0, "dead-zone release must not apply an impulse");
    assertIdleAndClean(simulation);

    for (const [pointerId, current] of [
        [9, { x: -50, y: 20 }],
        [10, { x: -120, y: 20 }]
    ]) {
        clearImpulseEvents(player);
        beginWithVector(simulation, pointerId, { x: 20, y: 20 }, current);
        const launch = simulation.releaseDragCombat(pointerId);
        const impulse = impulseEvents(player);
        const expected = getDragLaunchSpeed(player.stats.baseSpeed, launch.snapshot.strength);
        assert.equal(launch.type, "launch");
        assert.equal(impulse.length, 1, "every valid release launches exactly once");
        assert.ok(Math.abs(Math.hypot(impulse[0].impulse.x, impulse[0].impulse.y) - expected) < 1e-8);
        simulation.dragCombat.tickInput(0.1);
        assert.equal(impulseCount(player), 1, "release must not be consumed again on later ticks");
        simulation.dragCombat.reset();
    }

    clearImpulseEvents(player);
    beginWithVector(simulation, 11);
    const beforeShield = simulation.dragCombat.getSnapshot().playerShot.shields;
    simulation.releaseDragCombat(11);
    const releasedSnapshot = simulation.dragCombat.getSnapshot();
    const shields = releasedSnapshot.playerShot.shields;
    assert.equal(shields.length, 1);
    assert.equal(releasedSnapshot.playerShot.shieldRemaining, 0.8);
    assert.equal(releasedSnapshot.playerShot.shieldDuration, 0.8);
    const forward = shields[0].forward;
    player.position.x += 100;
    enemy.position.y += 100;
    const mutableSnapshot = simulation.dragCombat.getSnapshot();
    mutableSnapshot.playerShot.shields[0].forward.x = 99;
    mutableSnapshot.playerShot.shields.push({ fighterId: "mutated", forward: { x: 0, y: 0 } });
    assert.deepEqual(simulation.dragCombat.getSnapshot().playerShot.shields[0].forward, forward);
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.shields.length, 1);
    assert.equal(beforeShield.length, 0);
    simulation.dragCombat.onStaticCollision(player, { surfaceKey: "wall:left" });
    simulation.dragCombat.onStaticCollision(player, { surfaceKey: "wall:left" });
    simulation.dragCombat.onStaticCollision(player, { surfaceKey: "terrain:rock" });
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.bounceCount, 2);
    const context = {
        a: player,
        b: enemy,
        contactPoint: enemy.position.clone().add(new Vector2(1, 0)),
        damageFromAToB: 10,
        damageFromBToA: 8
    };
    simulation.dragCombat.resolveFighterCollision(context, context);
    assert.equal(context.damageFromAToB, 14.5);
    assert.equal(simulation.dragCombat.shot.active, false);
}

{
    const config = createDragCombatConfig(1.5);
    const simulation = createSimulation(true, { dragCombatConfig: config });
    const player = simulation.playerBall;
    clearImpulseEvents(player);
    beginWithVector(simulation, 21);
    const launch = simulation.releaseDragCombat(21);
    const impulse = impulseEvents(player).at(-1);
    const expected = getDragLaunchSpeed(player.stats.baseSpeed, launch.snapshot.strength, config.shot);
    assert.ok(Math.abs(Math.hypot(impulse.impulse.x, impulse.impulse.y) - expected) < 1e-8);
    assert.equal(simulation.dragCombat.getSnapshot().launch.releaseSpeedMultiplier, 1.5);
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    const enemy = simulation.getOpponent(player);
    const deltas = new Map();
    for (const fighter of [player, enemy]) {
        fighter.update = (delta) => deltas.set(fighter, (deltas.get(fighter) ?? 0) + delta);
    }
    clearImpulseEvents(player);
    beginWithVector(simulation, 12);
    simulation.update(1.2, 1.2);
    assert.equal(impulseCount(player), 1, "auto-launch must happen exactly once");
    assert.equal(deltas.get(player), 1.2);
    assert.equal(deltas.get(enemy), 0.42);
    assert.equal(simulation._clickActionContext.timeWarps.size, 0, "auto-launch removes its warp in the same frame");
    simulation.update(0.1, 0.1);
    assert.equal(impulseCount(player), 1, "later ticks must not create another auto-launch impulse");
}

for (const mutatePlayer of [
    (simulation) => (simulation.playerBall = simulation.getOpponent(simulation.playerBall)),
    (simulation) => (simulation.playerBall.flags.defeated = true),
    (simulation) => (simulation.playerBall.flags.destroyed = true),
    (simulation) => (simulation.playerBall.state.swallowed = true),
    (simulation) => simulation.playerBall.participation.setMode("standby"),
    (simulation) => (simulation.revivePauseRemaining = 1)
]) {
    const simulation = createSimulation();
    const originalPlayer = simulation.playerBall;
    beginWithVector(simulation, 13);
    mutatePlayer(simulation);
    assert.equal(simulation.releaseDragCombat(13).type, "cancel");
    assert.equal(impulseCount(originalPlayer), 0);
    assert.equal(simulation._clickActionContext.timeWarps.has(originalPlayer), false);
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    beginWithVector(simulation, 14);
    simulation.resolveResult(simulation.getOpponent(player));
    assertIdleAndClean(simulation);

    const reviving = createSimulation(true, { playerLives: { playerId: player.id, total: 2 } });
    const revivePlayer = reviving.playerBall;
    beginWithVector(reviving, 15);
    assert.equal(reviving.tryConsumePlayerLife(revivePlayer), true);
    assertIdleAndClean(reviving);
    reviving.revivePauseRemaining = 0;
    assert.deepEqual(reviving.beginDragCombat(16, { x: 0, y: 0 }), { type: "begin" });
    reviving.cancelDragCombat(16);
}

{
    const simulation = createSimulation();
    let maxTimeWarps = 0;
    let maxShields = 0;
    for (let iteration = 0; iteration < 1000; iteration += 1) {
        beginWithVector(simulation, iteration);
        simulation.cancelDragCombat(iteration);
        const snapshot = simulation.dragCombat.getSnapshot();
        maxTimeWarps = Math.max(maxTimeWarps, simulation._clickActionContext.timeWarps.size);
        maxShields = Math.max(maxShields, snapshot.playerShot.shields.length);
        assertFiniteSnapshot(snapshot);
        simulation.dragCombat.reset();
        assertIdleAndClean(simulation);
        assert.equal(simulation.dragCombat.getSnapshot().lastEvent, null);
    }
    assert.ok(maxTimeWarps <= 1);
    assert.equal(maxShields, 0);
}

console.log("[drag-player-runtime] ok");
