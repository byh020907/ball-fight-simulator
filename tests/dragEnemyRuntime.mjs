import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation() {
    const specs = createRoster()
        .slice(0, 4)
        .map((spec, index) => ({ ...spec, teamId: index === 0 ? "player" : "enemy" }));
    const simulation = new BattleSimulation(specs, { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        dragCombatEnabled: true
    });
    simulation.playerBall = simulation.fighters[0];
    simulation.fighters.forEach((fighter, index) => {
        fighter.position = new Vector2(200 + index * 180, 480);
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

{
    const simulation = createSimulation();
    const runtime = simulation.dragCombat;
    const [player, firstEnemy] = simulation.fighters;
    runtime.tickEnemy(0);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "windup");
    const fixed = runtime.getSnapshot().enemyQueue.fixedWindupDirection;
    player.position.y += 300;
    runtime.tickEnemy(1);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "flight");
    const impulse = firstEnemy.physicsDebug.toArray().find((event) => event.type === "impulse");
    assert.ok(impulse);
    assert.ok(
        Math.abs(Math.hypot(impulse.impulse.x, impulse.impulse.y) - Math.max(520, firstEnemy.stats.baseSpeed * 1.8)) <
            1e-8
    );
    assert.ok(Math.abs(impulse.impulse.x / Math.hypot(impulse.impulse.x, impulse.impulse.y) - fixed.x) < 1e-8);
    assert.ok(Math.abs(impulse.impulse.y / Math.hypot(impulse.impulse.x, impulse.impulse.y) - fixed.y) < 1e-8);
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
    assert.equal(afterMiss.protectedLaunchNotBefore, 2);
    runtime.tickEnemy(1.2);
    assert.equal(
        runtime.getSnapshot().enemyQueue.phase,
        "windup",
        "protection holds launch before real clock deadline"
    );
    runtime.tickInput(2);
    runtime.tickEnemy(0);
    assert.equal(runtime.getSnapshot().enemyQueue.phase, "flight");
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
    snapshot.enemyQueue.fixedWindupDirection.x = 99;
    snapshot.enemyQueue.lastResolution.attackerId = "mutated";
    assert.notEqual(runtime.getSnapshot().enemyQueue.fixedWindupDirection.x, 99);
    assert.notEqual(runtime.getSnapshot().enemyQueue.lastResolution.attackerId, "mutated");
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
        assert.equal(snapshot.enemyQueue.defenseCandidate, null);
    }
    assert.equal(maxOrder, 1);
    assert.equal(impulseCount(simulation.playerBall), 0);
}

console.log("[drag-enemy-runtime] ok");
