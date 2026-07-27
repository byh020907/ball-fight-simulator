import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createRoster } from "../src/roster.js";
import { DRAG_COMBAT_CONFIG } from "../src/combat-drag/config.js";

function createSpecs() {
    return createRoster()
        .slice(0, 3)
        .map((spec, index) => ({ ...spec, teamId: index === 0 ? "player" : "enemy" }));
}

function createSimulation({ enabled = true } = {}) {
    return new BattleSimulation(createSpecs(), { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        dragCombatEnabled: enabled
    });
}

{
    const simulation = createSimulation();
    const player = simulation.fighters[0];
    const enemy = simulation.fighters[1];
    enemy.hp = enemy.maxHp * 0.4;
    const originalMaxHp = enemy.maxHp;
    simulation.setPlayerBall(player);
    assert.equal(enemy.maxHp, originalMaxHp * DRAG_COMBAT_CONFIG.enemy.enemyHealthMultiplier);
    assert.equal(enemy.hp / enemy.maxHp, 0.4, "current HP ratio stays intact");
    simulation.setPlayerBall(player);
    assert.equal(
        enemy.maxHp,
        originalMaxHp * DRAG_COMBAT_CONFIG.enemy.enemyHealthMultiplier,
        "same player is exact-once"
    );
    enemy.hp = enemy.maxHp;
    simulation.setPlayerBall(player);
    assert.equal(
        enemy.maxHp,
        originalMaxHp * DRAG_COMBAT_CONFIG.enemy.enemyHealthMultiplier,
        "revive cannot rebalance"
    );
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

    const fresh = createSimulation();
    const freshEnemy = fresh.fighters[1];
    const freshOriginalMaxHp = freshEnemy.maxHp;
    fresh.setPlayerBall(fresh.fighters[0]);
    assert.equal(
        freshEnemy.maxHp,
        freshOriginalMaxHp * DRAG_COMBAT_CONFIG.enemy.enemyHealthMultiplier,
        "a new hostile match receives one new adjustment"
    );
}

console.log("[drag-combat-balance] ok");
