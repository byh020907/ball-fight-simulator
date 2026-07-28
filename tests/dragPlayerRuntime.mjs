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
        simulation.dragCombat.tickInput(0.3);
        const launch = simulation.releaseDragCombat(pointerId);
        const impulse = impulseEvents(player);
        const expected = getDragLaunchSpeed(player.stats.baseSpeed, launch.snapshot.chargeRatio);
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
    assert.equal(releasedSnapshot.playerShot.flightRemaining, 2.4);
    assert.equal(releasedSnapshot.playerShot.flightDuration, 2.4);
    assert.equal(releasedSnapshot.playerShot.endProgress, 0);
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
    assert.deepEqual(
        simulation.beginDragCombat(12, { x: 20, y: 20 }),
        { type: "queued" },
        "holding during an active shot queues the next aim"
    );
    assert.deepEqual(simulation.moveDragCombat(12, { x: -120, y: 20 }), { type: "queued" });
    assert.equal(simulation.dragCombat.getSnapshot().drag.queued, true);
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
    simulation.dragCombat.flushInputFrame();
    const resumedAim = simulation.dragCombat.getSnapshot();
    assert.equal(resumedAim.drag.queued, false);
    assert.equal(resumedAim.drag.state, "aiming");
    assert.equal(resumedAim.drag.pointerId, 12);
    assert.equal(resumedAim.drag.vector.active, true);
    assert.equal(resumedAim.drag.chargeRatio, 0, "queued holding time does not count as charge time");
    simulation.dragCombat.tickInput(0.3);
    assert.equal(simulation.dragCombat.getSnapshot().drag.chargeRatio, 0.25);
    assert.equal(simulation.cancelDragCombat(12).type, "cancel");
    assert.deepEqual(simulation.beginDragCombat(13, { x: 20, y: 20 }), { type: "begin" });
    assert.equal(simulation.cancelDragCombat(13).type, "cancel");
}

{
    const simulation = createSimulation();
    beginWithVector(simulation, 30);
    simulation.releaseDragCombat(30);
    assert.deepEqual(simulation.beginDragCombat(31, { x: 80, y: 80 }), { type: "queued" });
    simulation.moveDragCombat(31, { x: 20, y: 80 });
    assert.equal(simulation.releaseDragCombat(31).type, "cancel");
    assert.equal(simulation.dragCombat.getSnapshot().drag.queued, false);
    simulation.dragCombat.shot.reset();
    simulation.dragCombat.flushInputFrame();
    assert.equal(simulation.dragCombat.getSnapshot().drag.state, "idle", "released queued input never starts later");
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    beginWithVector(simulation, 32);
    simulation.releaseDragCombat(32);
    assert.deepEqual(simulation.beginDragCombat(33, { x: 80, y: 80 }), { type: "queued" });
    simulation.moveDragCombat(33, { x: 20, y: 80 });
    player.velocity = new Vector2(player.stats.baseSpeed * 1.25, 0);
    simulation.dragCombat.tickShot(0.18);
    assert.equal(simulation.dragCombat.getSnapshot().lastEvent.type, "slow-stop");
    simulation.dragCombat.flushInputFrame();
    const resumedAim = simulation.dragCombat.getSnapshot();
    assert.equal(resumedAim.drag.state, "aiming");
    assert.equal(resumedAim.drag.pointerId, 33);
    simulation.cancelDragCombat(33);
}

{
    const simulation = createSimulation();
    beginWithVector(simulation, 40);
    simulation.releaseDragCombat(40);
    assert.deepEqual(simulation.beginDragCombat(41, { x: 80, y: 80 }), { type: "queued" });
    simulation.moveDragCombat(41, { x: 20, y: 80 });
    simulation.dragCombat.input.lock(0.27);
    simulation.dragCombat.shot.reset();
    simulation.dragCombat.flushInputFrame();
    assert.equal(simulation.dragCombat.getSnapshot().drag.state, "idle");
    assert.equal(simulation.dragCombat.getSnapshot().drag.queued, true);
    simulation.dragCombat.tickInput(0.26);
    assert.equal(simulation.dragCombat.getSnapshot().drag.queued, true);
    simulation.dragCombat.tickInput(0.02);
    const afterLock = simulation.dragCombat.getSnapshot();
    assert.equal(afterLock.drag.state, "aiming");
    assert.equal(afterLock.drag.queued, false);
    assert.equal(afterLock.drag.vector.active, true);
    simulation.cancelDragCombat(41);
}

{
    const simulation = createSimulation();
    beginWithVector(simulation, 50);
    simulation.releaseDragCombat(50);
    assert.deepEqual(simulation.beginDragCombat(51, { x: 80, y: 80 }), { type: "queued" });
    simulation.playerBall = simulation.getOpponent(simulation.playerBall);
    simulation.dragCombat.tickInput(0);
    assert.equal(simulation.dragCombat.getSnapshot().drag.queued, false, "queued input cannot migrate to a new player");
    assert.equal(simulation.dragCombat.getSnapshot().drag.state, "idle");
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    beginWithVector(simulation, 17);
    simulation.dragCombat.tickInput(0.6);
    assert.equal(simulation._clickActionContext.timeWarps.size, 0, "time warp ends at half charge");
    assert.equal(simulation.moveDragCombat(17, { x: -80, y: -80 }).active, true);
    assert.equal(simulation._clickActionContext.timeWarps.size, 0, "later aim edits cannot restart time warp");
    assert.equal(simulation.releaseDragCombat(17).type, "launch", "release remains valid after time warp ends");
    assert.equal(impulseCount(player), 1);
}

{
    const config = createDragCombatConfig(1.5);
    const simulation = createSimulation(true, { dragCombatConfig: config });
    const player = simulation.playerBall;
    clearImpulseEvents(player);
    beginWithVector(simulation, 21);
    const launch = simulation.releaseDragCombat(21);
    const impulse = impulseEvents(player).at(-1);
    const expected = getDragLaunchSpeed(player.stats.baseSpeed, launch.snapshot.chargeRatio, config.shot);
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
    simulation.update(0.59, 0.59);
    simulation.update(0.01, 0.01);
    simulation.update(0.6, 0.6);
    assert.equal(impulseCount(player), 1, "auto-launch must happen exactly once");
    assert.equal(deltas.get(player), 1.2);
    assert.ok(Math.abs(deltas.get(enemy) - 0.8165) < 1e-8);
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
