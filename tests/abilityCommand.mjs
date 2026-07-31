import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Ability } from "../src/abilities/ability.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

class CommandTestAbility extends Ability {
    constructor(owner, simulation, mode = "default-shot", suppressDefaultCollision = true) {
        super(owner, simulation, 1, { abilityId: "command_test" });
        this.mode = mode;
        this.suppressDefaultCollision = suppressDefaultCollision;
        this.ends = [];
        this.collisions = 0;
    }

    prepareCommand(intent) {
        return { ...intent, predictedTerminal: { x: 12, y: 34 } };
    }

    resolveCommandLaunch() {
        return { mode: this.mode };
    }

    resolveCommandCollision() {
        return { handled: this.suppressDefaultCollision, runDefaultOnCollision: !this.suppressDefaultCollision };
    }

    onCommandEnd(event) {
        this.ends.push(event.reason);
    }

    onCollision() {
        this.collisions += 1;
    }
}

class TrajectoryCaptureAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 1, { abilityId: "trajectory_capture" });
        this.prepared = null;
    }

    prepareCommand(intent) {
        this.prepared = intent;
        return intent;
    }
}

function createSimulation({
    abilityCommandEnabled = true,
    mode = "default-shot",
    suppressDefaultCollision = true
} = {}) {
    const simulation = new BattleSimulation(createRoster().slice(0, 2), { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        dragCombatEnabled: true,
        abilityCommandEnabled
    });
    simulation.setPlayerBall(simulation.fighters[0]);
    simulation.fighters[0].position = new Vector2(240, 480);
    simulation.fighters[1].position = new Vector2(720, 480);
    const ability = new CommandTestAbility(simulation.playerBall, simulation, mode, suppressDefaultCollision);
    simulation.playerBall.abilities.setPrimary(ability);
    return { simulation, ability };
}

function launch(simulation, pointerId = 1) {
    assert.deepEqual(simulation.beginDragCombat(pointerId, { x: 20, y: 20 }), { type: "begin" });
    assert.equal(simulation.moveDragCombat(pointerId, { x: -120, y: 20 }).active, true);
    return simulation.releaseDragCombat(pointerId);
}

function impulseCount(fighter) {
    return fighter.physicsDebug.toArray().filter((event) => event.type === "impulse").length;
}

{
    const { simulation } = createSimulation({ abilityCommandEnabled: false, mode: "replace-shot" });
    const player = simulation.playerBall;
    player.physicsDebug.clear();
    launch(simulation);
    assert.equal(impulseCount(player), 1, "플래그 off는 기본 발사를 유지한다");
    assert.equal(simulation.dragCombat.getSnapshot().commandSequence, 0);
}

{
    const { simulation } = createSimulation();
    const ability = new TrajectoryCaptureAbility(simulation.playerBall, simulation);
    simulation.playerBall.abilities.setPrimary(ability);
    launch(simulation, 90);
    const returned = simulation.dragCombat.getSnapshot().activeCommand;
    assert.ok(returned.pathSegments.length > 0, "release trajectory must snapshot planned segments");
    assert.ok(returned.predictedTerminal, "release trajectory must snapshot a terminal point");
    returned.pathSegments[0].x = -999;
    returned.bouncePoints.push({ x: -1, y: -1 });
    returned.predictedTerminal.x = -999;
    assert.notEqual(ability.prepared.pathSegments[0].x, -999, "returned command snapshot must not mutate intent");
    assert.equal(
        ability.prepared.bouncePoints.some((point) => point.x === -1),
        false
    );
    assert.notEqual(ability.prepared.predictedTerminal.x, -999);
}

{
    const disabled = createSimulation({ abilityCommandEnabled: false });
    const enabled = createSimulation();
    disabled.simulation.playerBall.physicsDebug.clear();
    enabled.simulation.playerBall.physicsDebug.clear();
    launch(disabled.simulation, 10);
    launch(enabled.simulation, 10);
    assert.equal(impulseCount(disabled.simulation.playerBall), 1);
    assert.equal(impulseCount(enabled.simulation.playerBall), 1, "no-op ability command은 기존 발사와 동일하다");
    assert.equal(disabled.simulation.dragCombat.getSnapshot().playerShot.active, true);
    assert.equal(enabled.simulation.dragCombat.getSnapshot().playerShot.active, true);
}

for (const mode of ["replace-shot", "payload-only"]) {
    const { simulation } = createSimulation({ mode });
    const player = simulation.playerBall;
    player.physicsDebug.clear();
    launch(simulation);
    const snapshot = simulation.dragCombat.getSnapshot();
    assert.equal(impulseCount(player), 0, `${mode}는 generic impulse를 중복 실행하지 않는다`);
    assert.equal(snapshot.playerShot.active, false, `${mode}는 generic shot을 시작하지 않는다`);
    assert.equal(snapshot.commandSequence, 1);
    assert.equal(snapshot.activeCommand.sequence, 1);
    assert.deepEqual(snapshot.activeCommand.predictedTerminal, { x: 12, y: 34 });
}

{
    const { simulation, ability } = createSimulation();
    assert.deepEqual(simulation.beginDragCombat(2, { x: 20, y: 20 }), { type: "begin" });
    assert.equal(simulation.moveDragCombat(2, { x: 30, y: 20 }).active, false);
    assert.equal(simulation.releaseDragCombat(2).type, "cancel", "dead-zone release는 발사가 아니다");
    assert.equal(simulation.dragCombat.getSnapshot().commandSequence, 0, "dead-zone은 sequence를 증가시키지 않는다");
    assert.deepEqual(simulation.beginDragCombat(3, { x: 20, y: 20 }), { type: "begin" });
    assert.equal(simulation.cancelDragCombat(3).type, "cancel");
    assert.equal(simulation.dragCombat.getSnapshot().commandSequence, 0, "취소는 sequence를 증가시키지 않는다");
    assert.equal(simulation.cancelDragCombat(99), null, "무효 pointer는 sequence를 증가시키지 않는다");
    launch(simulation, 4);
    assert.equal(simulation.dragCombat.getSnapshot().commandSequence, 1);
    simulation.elapsed = 3.1;
    simulation.dragCombat.tickInput(0);
    assert.equal(simulation.dragCombat.getSnapshot().activeCommand, null, "3초 뒤 intent가 만료된다");
    assert.deepEqual(ability.ends, ["expired"]);
}

{
    const { simulation, ability } = createSimulation({ mode: "payload-only" });
    launch(simulation, 5);
    assert.equal(simulation.dragCombat.getSnapshot().commandSequence, 1);
    launch(simulation, 6);
    assert.equal(simulation.dragCombat.getSnapshot().commandSequence, 2);
    assert.deepEqual(ability.ends, ["replaced"], "새 유효 커맨드는 이전 intent를 한 번만 교체 종료한다");
}

{
    const { simulation, ability } = createSimulation({ mode: "payload-only" });
    launch(simulation, 7);
    ability.setCooldownRemaining(0);
    ability.resetCooldown();
    assert.equal(simulation.dragCombat.getSnapshot().activeCommand, null, "primary ability cycle은 intent를 종료한다");
    assert.deepEqual(ability.ends, ["ability-cycle"]);
}

{
    const { simulation, ability } = createSimulation({ mode: "payload-only" });
    launch(simulation, 8);
    simulation.dragCombat.reset();
    assert.equal(simulation.dragCombat.getSnapshot().activeCommand, null, "리셋은 활성 intent를 정리한다");
    assert.deepEqual(ability.ends, ["reset"]);
}

{
    const { simulation, ability } = createSimulation({ suppressDefaultCollision: false });
    const player = simulation.playerBall;
    const enemy = simulation.getOpponent(player);
    launch(simulation, 4);
    const context = {
        a: player,
        b: enemy,
        contactPoint: new Vector2(400, 480),
        damageFromAToB: 10,
        damageFromBToA: 8,
        hostile: true,
        collisionReplaced: false,
        targetHpRatioBeforeA: 1,
        targetHpRatioBeforeB: 1,
        damageResultToA: null,
        damageResultToB: null
    };
    simulation.dragCombat.applyResolvedFighterCollision(
        context,
        { playerShot: { type: "plain-hit", bounceCount: 0 } },
        { damageFromAToB: 10, damageFromBToA: 8 }
    );
    simulation.afterFighterPhysicsCollision(context);
    assert.equal(ability.collisions, 1, "no-op command collision은 기존 onCollision을 정확히 한 번 실행한다");
}

{
    const { simulation, ability } = createSimulation();
    const player = simulation.playerBall;
    const enemy = simulation.getOpponent(player);
    launch(simulation, 3);
    const context = {
        a: player,
        b: enemy,
        contactPoint: new Vector2(400, 480),
        damageFromAToB: 10,
        damageFromBToA: 8,
        hostile: true,
        collisionReplaced: false,
        targetHpRatioBeforeA: 1,
        targetHpRatioBeforeB: 1,
        damageResultToA: null,
        damageResultToB: null
    };
    simulation.dragCombat.applyResolvedFighterCollision(
        context,
        { playerShot: { type: "plain-hit", bounceCount: 0 } },
        { damageFromAToB: 10, damageFromBToA: 8 }
    );
    assert.equal(context.commandCollisionDefaults.get(player), false);
    simulation.afterFighterPhysicsCollision(context);
    assert.equal(ability.collisions, 0, "커맨드 충돌은 기본 onCollision을 억제할 수 있다");
    assert.equal(simulation.dragCombat.getSnapshot().activeCommand, null);
}

console.log("[ability-command] ok");
