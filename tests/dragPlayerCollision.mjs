import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

function createSimulation({ enabled = true, playerX = 240, enemyX = 720 } = {}) {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    let simulation;
    try {
        simulation = new BattleSimulation(createRoster().slice(0, 2), { onLog() {}, onSound() {} }, null, {
            assignActions: false,
            dragCombatEnabled: enabled
        });
    } finally {
        Math.random = originalRandom;
    }
    simulation.playerBall = simulation.fighters[0];
    const [player, enemy] = simulation.fighters;
    player.position = new Vector2(playerX, 480);
    enemy.position = new Vector2(enemyX, 480);
    player.velocity = new Vector2(300, 0);
    enemy.velocity = new Vector2(-120, 0);
    return simulation;
}

function launch(simulation, pointerId = 1) {
    assert.deepEqual(simulation.beginDragCombat(pointerId, { x: 20, y: 20 }), { type: "begin" });
    simulation.moveDragCombat(pointerId, { x: -120, y: 20 });
    assert.equal(simulation.releaseDragCombat(pointerId).type, "launch");
}

function collide(simulation) {
    const [player, enemy] = simulation.fighters;
    player.position = new Vector2(450, 480);
    enemy.position = new Vector2(500, 480);
    player.velocity = new Vector2(300, 0);
    enemy.velocity = new Vector2(-120, 0);
    const damageArguments = new Map();
    for (const fighter of [player, enemy]) {
        const takeDamage = fighter.takeDamage.bind(fighter);
        fighter.takeDamage = (amount, ...args) => {
            damageArguments.set(fighter, amount);
            return takeDamage(amount, ...args);
        };
    }
    const context = simulation.handleFighterCollision(player, enemy);
    return { context, damageArguments };
}

function naturalCollision(enabled) {
    return withFixedRandom(() => {
        const simulation = createSimulation({ enabled });
        const [player, enemy] = simulation.fighters;
        const { context, damageArguments } = collide(simulation);
        return {
            playerHp: player.hp,
            enemyHp: enemy.hp,
            playerDamage: damageArguments.get(enemy) ?? 0,
            enemyDamage: damageArguments.get(player) ?? 0,
            playerVelocity: player.velocity.clone(),
            enemyVelocity: enemy.velocity.clone()
        };
    });
}

function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} !== ${expected}`);
}

function withFixedRandom(callback) {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
        return callback();
    } finally {
        Math.random = originalRandom;
    }
}

{
    const disabled = withFixedRandom(() => naturalCollision(false));
    const inactive = withFixedRandom(() => naturalCollision(true));
    assert.deepEqual(inactive, disabled, "disabled and inactive shots preserve natural collision");
}

{
    const simulation = createSimulation();
    const [player, enemy] = simulation.fighters;
    enemy.teamId = player.teamId;
    launch(simulation, 40);
    const hp = [player.hp, enemy.hp];
    collide(simulation);
    assert.deepEqual([player.hp, enemy.hp], hp, "ally collision adds no damage");
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, false, "ally is first-shot stop");
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    launch(simulation, 41);
    const keys = ["wall:left", "wall:right", "wall:top", "wall:bottom"];
    for (const key of keys) simulation.notifyFighterStaticCollision(player, { surfaceKey: key });
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.bounceCount, 4);
    simulation.dragCombat.reset();
    launch(simulation, 42);
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "terrain:circle:1:2:3" });
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "terrain:circle:4:5:6" });
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.bounceCount, 2, "geometry keys stay distinct");
    simulation.dragCombat.reset();
    launch(simulation, 43);
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "wall:left" });
    simulation.dragCombat.tickShot(0.04);
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "wall:left" });
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "wall:right" });
    simulation.dragCombat.tickShot(0.04);
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "wall:left" });
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.bounceCount, 3, "debounce and re-entry");
}

{
    const simulation = createSimulation();
    const player = simulation.playerBall;
    launch(simulation, 44);
    player.velocity = new Vector2();
    simulation.dragCombat.tickShot(0.1);
    simulation.notifyFighterStaticCollision(player, { surfaceKey: "wall:left" });
    simulation.dragCombat.tickShot(0.11);
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, true, "bounce resets slow timer");
    simulation.dragCombat.tickShot(0.2);
    assert.equal(simulation.dragCombat.getSnapshot().lastEvent.type, "slow-stop");
    simulation.dragCombat.reset();
    launch(simulation, 45);
    player.velocity = new Vector2(200, 0);
    simulation.dragCombat.tickShot(2.4);
    assert.equal(simulation.dragCombat.getSnapshot().lastEvent.type, "timeout");
}

{
    const simulation = createSimulation();
    const [player, enemy] = simulation.fighters;
    launch(simulation, 46);
    player.position = enemy.position.clone();
    player.velocity = new Vector2();
    enemy.velocity = new Vector2();
    assert.doesNotThrow(() => collide(simulation));
    assert.equal(
        Object.values(simulation.dragCombat.getSnapshot()).every((value) => value !== Infinity),
        true
    );
    simulation.resolveResult(enemy);
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, false);
}

{
    const simulation = createSimulation();
    const [player, enemy] = simulation.fighters;
    launch(simulation);
    const baseline = naturalCollision(false);
    const impulsesBefore = player.physicsDebug.toArray().filter((entry) => entry.type === "impulse").length;
    const { context, damageArguments } = collide(simulation);
    const impulses = player.physicsDebug.toArray().filter((entry) => entry.type === "impulse");
    assert.equal(context.damageFromAToB, 0, "front shield blocks player damage");
    assertClose(damageArguments.get(player), baseline.enemyDamage * 1.5, "front shield amplifies enemy damage once");
    assert.equal(impulses.length - impulsesBefore, 1, "front shield recoil applies once");
    assertClose(
        Math.hypot(impulses.at(-1).impulse.x, impulses.at(-1).impulse.y),
        player.stats.baseSpeed * 1.6,
        "recoil"
    );
    assertClose(simulation.dragCombat.getSnapshot().drag.inputLockRemaining, 0.45, "input lock");
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, false);
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.shields.length, 0);
    assert.equal(enemy.hp < enemy.maxHp, false);
}

for (const [bounceCount, multiplier] of [
    [1, 1],
    [2, 1.45],
    [3, 1.9],
    [4, 1.9]
]) {
    const simulation = createSimulation({ playerX: 800, enemyX: 400 });
    const [player, enemy] = simulation.fighters;
    let slowCalls = 0;
    const applySlow = enemy.applySlow.bind(enemy);
    enemy.applySlow = (...args) => {
        slowCalls += 1;
        return applySlow(...args);
    };
    launch(simulation, bounceCount + 10);
    for (let index = 0; index < bounceCount; index += 1) {
        simulation.dragCombat.onStaticCollision(player, { surfaceKey: `wall:${index}` });
    }
    const baseline = naturalCollision(false);
    const { damageArguments } = collide(simulation);
    assertClose(damageArguments.get(enemy), baseline.playerDamage * multiplier, `rear bounce ${bounceCount}`);
    assertClose(damageArguments.get(player), baseline.enemyDamage, `incoming bounce ${bounceCount}`);
    assert.equal(slowCalls, bounceCount >= 3 ? 1 : 0);
}

{
    const simulation = createSimulation();
    const [player, enemy] = simulation.fighters;
    launch(simulation, 30);
    const hp = [player.hp, enemy.hp];
    player.abilities.beforeFighterCollision = () => ({ replaceCollision: true });
    const { context } = collide(simulation);
    assert.equal(context.collisionReplaced, true);
    assert.deepEqual([player.hp, enemy.hp], hp, "replacement owns its damage result");
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, false);
}

{
    const simulation = createSimulation();
    const [player, enemy] = simulation.fighters;
    launch(simulation, 31);
    assert.doesNotThrow(() =>
        simulation.dragCombat.resolveFighterCollision({ a: player, b: enemy, contactPoint: null, hostile: true })
    );
}

console.log("[drag-player-collision] ok");
