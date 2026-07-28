import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createRoster } from "../src/roster.js";
import { DRAG_COMBAT_CONFIG, getDragEnemyHealthMultiplier } from "../src/combat-drag/config.js";

function createSpecs(enemyCount = 2) {
    return createRoster()
        .slice(0, enemyCount + 1)
        .map((spec, index) => ({ ...spec, teamId: index === 0 ? "player" : "enemy" }));
}

function createSimulation({ enabled = true, enemyCount = 2 } = {}) {
    return new BattleSimulation(createSpecs(enemyCount), { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        dragCombatEnabled: enabled
    });
}

{
    const tournament = new BattleSimulation(createSpecs(1), { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        dragCombatEnabled: true,
        dragEnemyHealthScalingEnabled: false
    });
    assert.equal(tournament.width, 1200, "drag combat should use the expanded default arena");
    assert.deepEqual(
        tournament.fighters.map((fighter) => fighter.position.x),
        [300, 900],
        "one-on-one fighters should start across half of the expanded arena"
    );
    const enemy = tournament.fighters[1];
    const originalMaxHp = enemy.maxHp;
    tournament.setPlayerBall(tournament.fighters[0]);
    assert.equal(enemy.maxHp, originalMaxHp, "tournament-style drag combat keeps the opponent's full HP");
}

{
    const simulation = createSimulation();
    assert.deepEqual(
        simulation.fighters.map((fighter) => fighter.position.x),
        [300, 900, 900],
        "one-versus-many teams should retain the same widened horizontal formation"
    );
    const player = simulation.fighters[0];
    const enemy = simulation.fighters[1];
    enemy.hp = enemy.maxHp * 0.4;
    const originalMaxHp = enemy.maxHp;
    const expectedMultiplier = getDragEnemyHealthMultiplier(1, 2);
    simulation.setPlayerBall(player);
    assert.equal(enemy.maxHp, originalMaxHp * expectedMultiplier);
    assert.ok(Math.abs(enemy.hp / enemy.maxHp - 0.4) < 1e-12, "current HP ratio stays intact");
    simulation.setPlayerBall(player);
    assert.equal(enemy.maxHp, originalMaxHp * expectedMultiplier, "same player is exact-once");
    enemy.hp = enemy.maxHp;
    simulation.setPlayerBall(player);
    assert.equal(enemy.maxHp, originalMaxHp * expectedMultiplier, "revive cannot rebalance");
}

{
    const simulation = createSimulation();
    const player = simulation.fighters[0];
    const ally = { ...player, teamId: player.teamId };
    simulation.setPlayerBall(player);
    const enemyMaxHp = simulation.fighters[1].maxHp;
    simulation.setPlayerBall(ally);
    assert.equal(simulation.fighters[1].maxHp, enemyMaxHp, "same-team swap cannot rebalance");
}

{
    const disabled = createSimulation({ enabled: false });
    const enemy = disabled.fighters[1];
    const originalMaxHp = enemy.maxHp;
    disabled.setPlayerBall(disabled.fighters[0]);
    assert.equal(enemy.maxHp, originalMaxHp, "disabled drag combat leaves baseline intact");

    const fresh = createSimulation({ enemyCount: 1 });
    const freshEnemy = fresh.fighters[1];
    const freshOriginalMaxHp = freshEnemy.maxHp;
    fresh.setPlayerBall(fresh.fighters[0]);
    assert.equal(
        freshEnemy.maxHp,
        freshOriginalMaxHp * DRAG_COMBAT_CONFIG.enemy.enemyHealthMultiplier,
        "a new hostile match receives one new adjustment"
    );
}

assert.equal(getDragEnemyHealthMultiplier(1, 1), 0.88, "one-on-one uses the base hostile HP multiplier");
assert.equal(
    getDragEnemyHealthMultiplier(1, 3),
    0.88 * (1 / 3) ** 3,
    "outnumbering cannot multiply the hostile team's HP burden linearly"
);

console.log("[drag-combat-balance] ok");
