import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation(enabled = true) {
    const [playerSpec, enemySpec] = createRoster();
    const simulation = new BattleSimulation([playerSpec, enemySpec], { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        dragCombatEnabled: enabled
    });
    simulation.playerBall = simulation.fighters[0];
    simulation.fighters[0].position = new Vector2(240, 480);
    simulation.fighters[1].position = new Vector2(720, 480);
    simulation.fighters.forEach((fighter) => fighter.applyImpulse(fighter.velocity.clone().scale(-1)));
    return simulation;
}

const disabled = createSimulation(false);
assert.equal(disabled.dragCombat, null);
assert.equal(disabled.beginDragCombat(1, { x: 0, y: 0 }), null);

const simulation = createSimulation();
const player = simulation.playerBall;
const enemy = simulation.getOpponent(player);
assert.equal(simulation.dragCombat.getSnapshot().enabled, true);
assert.deepEqual(simulation.beginDragCombat(7, { x: 20, y: 20 }), { type: "begin" });
assert.equal(simulation._clickActionContext.timeWarps.get(player), Infinity);
assert.equal(simulation.moveDragCombat(7, { x: -120, y: 20 }).active, true);
const launch = simulation.releaseDragCombat(7);
assert.equal(launch.type, "launch");
assert.equal(simulation.dragCombat.shot.active, true);
assert.equal(simulation._clickActionContext.timeWarps.has(player), false);
assert.equal(player.velocity.length() > 0, true);

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

simulation.dragCombat.input.tick(2);
assert.deepEqual(simulation.beginDragCombat(9, { x: 0, y: 0 }), { type: "begin" });
simulation.cancelDragCombat(9);
assert.equal(simulation.dragCombat.getSnapshot().drag.state, "idle");
assert.equal(simulation._clickActionContext.timeWarps.size, 0);

const mutableSnapshot = simulation.dragCombat.getSnapshot();
mutableSnapshot.drag.vector = { vector: { x: 99, y: 99 } };
mutableSnapshot.playerShot.shields.push({ fighterId: "mutated", forward: { x: 0, y: 0 } });
assert.equal(
    simulation.dragCombat.getSnapshot().playerShot.shields.some((shield) => shield.fighterId === "mutated"),
    false
);

for (let iteration = 0; iteration < 1000; iteration += 1) {
    simulation.dragCombat.reset();
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.shields.length, 0);
    assert.equal(simulation._clickActionContext.timeWarps.size, 0);
}

console.log("[drag-player-runtime] ok");
