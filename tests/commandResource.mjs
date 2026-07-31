import assert from "node:assert/strict";
import { CommandResource } from "../src/combat-command/index.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { createRoster } from "../src/roster.js";

function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);
}

{
    const resource = new CommandResource();
    assert.equal(resource.resetForOwner({ id: "player" }), true);
    assert.equal(resource.snapshot().amount, 1);
    assert.equal(resource.resetForOwner({ id: "player" }), false);
    resource.tick(4);
    assertClose(resource.snapshot().amount, 1.5, "8초당 1 충전의 연속 회복");
    assert.equal(resource.gainFromAbilityUse("enemy"), false);
    assert.equal(resource.gainFromAbilityUse("player"), true);
    assertClose(resource.snapshot().amount, 1.85, "focal 능력 사용 충전");
    resource.tick(100);
    assert.equal(resource.snapshot().amount, 2, "최대 충전 clamp");
    assert.equal(resource.spend(), true);
    assert.equal(resource.spend(), true);
    assert.equal(resource.spend(), false, "부족한 자원은 소비하지 않음");
    assert.equal(resource.resetForOwner({ id: "replacement" }), true);
    assert.equal(resource.snapshot().amount, 1, "owner 교체만 시작값으로 초기화");
}

function createSimulation() {
    const abilityEvents = [];
    const simulation = new BattleSimulation(
        createRoster().slice(0, 2),
        { onLog() {}, onSound() {}, onAbilityUsed: (event) => abilityEvents.push(event) },
        null,
        {
            assignActions: false,
            dragCombatEnabled: true,
            commandResourceEnabled: true
        }
    );
    simulation.setPlayerBall(simulation.fighters[0]);
    return { simulation, abilityEvents };
}

{
    const { simulation, abilityEvents } = createSimulation();
    const player = simulation.playerBall;
    const enemy = simulation.getOpponent(player);
    const resource = simulation.commandResource;
    assert.equal(resource.snapshot().amount, 1);
    assert.equal(player.ability.recordUsageMetric(), true);
    assertClose(resource.snapshot().amount, 1.35, "focal 실제 ability event는 observer와 독립적으로 충전");
    assert.equal(abilityEvents.length, 1, "observer는 기존처럼 실제 사건을 한 번 받음");
    assert.equal(enemy.ability.recordUsageMetric(), true);
    assertClose(resource.snapshot().amount, 1.35, "적 ability event는 자원을 충전하지 않음");

    assert.equal(simulation.beginDragCombat(90, { x: 0, y: 0 }).type, "begin");
    simulation.moveDragCombat(90, { x: 5, y: 0 });
    assert.equal(simulation.releaseDragCombat(90).type, "cancel");
    assertClose(resource.snapshot().amount, 1.35, "dead-zone release는 무소비");
    assert.equal(simulation.beginDragCombat(91, { x: 0, y: 0 }).type, "begin");
    assert.equal(simulation.cancelDragCombat(91).type, "cancel");
    assertClose(resource.snapshot().amount, 1.35, "pointer cancel은 무소비");

    assert.equal(simulation.beginDragCombat(1, { x: 0, y: 0 }).type, "begin");
    simulation.moveDragCombat(1, { x: -120, y: 0 });
    assert.equal(simulation.releaseDragCombat(1).type, "launch");
    assertClose(resource.snapshot().amount, 0.35, "유효 발사만 1 소비");
    simulation.dragCombat.reset();
    resource.spend(0.35);
    assert.equal(simulation.beginDragCombat(2, { x: 0, y: 0 }), null, "부족하면 begin과 예약을 거절");
    resource.gainFromAbilityUse(player.id);
    assertClose(resource.snapshot().amount, 0.35, "observer 없이도 능력 충전 가능");
    simulation.setPlayerBall(player);
    assertClose(resource.snapshot().amount, 0.35, "같은 player 재설정은 무복구");
    simulation.finished = true;
    simulation.update(1, 1);
    assertClose(resource.snapshot().amount, 0.35, "finished reset은 자원 무복구");
    simulation.finished = false;
    simulation.revivePauseRemaining = 1;
    simulation.update(1 / 60, 1 / 60);
    assertClose(resource.snapshot().amount, 0.35, "revive pause reset은 자원 무복구");
    simulation.setPlayerBall(enemy);
    assert.equal(resource.snapshot().amount, 1, "실제 owner 교체는 시작값 복구");
}

{
    const { simulation } = createSimulation();
    const resource = simulation.commandResource;
    assert.equal(simulation.beginDragCombat(3, { x: 0, y: 0 }).type, "begin");
    simulation.moveDragCombat(3, { x: -120, y: 0 });
    simulation.dragCombat.tickInput(1.2);
    assert.equal(simulation.dragCombat.getSnapshot().playerShot.active, true, "자동 발사는 유효 shot을 시작");
    assert.equal(resource.snapshot().amount, 0, "자동 발사는 정확히 한 번 소비");
    simulation.dragCombat.tickInput(1.2);
    assert.equal(resource.snapshot().amount, 0, "활성 shot 중 중복 소비 없음");
}

console.log("[command-resource] ok");
