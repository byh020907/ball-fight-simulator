import assert from "node:assert/strict";
import { ArenaCamera } from "../src/camera.js";
import { DragInputState, EnemyAttackQueue, PlayerShotState, predictTrajectory } from "../src/combat-drag/index.js";
import { DRAG_COMBAT_CONFIG } from "../src/combat-drag/config.js";
import {
    getRicochetDamageMultiplier,
    getSlingshotVector,
    isShieldFront,
    screenToWorld
} from "../src/combat-drag/vectorMath.js";

assert.equal(getSlingshotVector({ x: 0, y: 0 }, { x: 24, y: 0 }).active, false);
const pull = getSlingshotVector({ x: 0, y: 0 }, { x: -140, y: 0 });
assert.equal(pull.active, true);
assert.equal(pull.pullLength, 140);
assert.equal(pull.strength, 1);
assert.equal(getSlingshotVector({ x: 0, y: 0 }, { x: -70, y: 0 }).strength > 0.5, true);
assert.equal(getSlingshotVector({ x: 0, y: 0 }, { x: -1, y: 0 }, { deadZonePx: 24, maxPullPx: 24 }).active, false);
const worldPoint = screenToWorld({ x: 210, y: 120 }, { scale: 2, offsetX: 10, offsetY: 20 });
assert.equal(worldPoint.x, 100);
assert.equal(worldPoint.y, 50);
const cameraPoint = new ArenaCamera().screenToWorld(
    { x: 210, y: 120 },
    { width: 400, height: 200 },
    { width: 200, height: 100 }
);
assert.equal(cameraPoint.x, 105);
assert.equal(cameraPoint.y, 60);
assert.equal(isShieldFront({ x: 1, y: 0 }, { x: 0, y: 1 }), true);
assert.equal(isShieldFront({ x: 1, y: 0 }, { x: -1, y: 0 }), false);
assert.deepEqual([0, 1, 2, 3, 4].map(getRicochetDamageMultiplier), [1, 1, 1.45, 1.9, 1.9]);
const drag = new DragInputState();
drag.begin(1, { x: 0, y: 0 });
drag.move(2, { x: -140, y: 0 });
assert.equal(drag.release(2), null);
drag.move(1, { x: -140, y: 0 });
const launch = drag.release(1);
assert.equal(launch.type, "launch");
assert.equal(drag.begin(2, { x: 0, y: 0 }), null);
drag.tick(2);
drag.begin(2, { x: 0, y: 0 });
assert.equal(drag.cancel(2).type, "cancel");
const shot = new PlayerShotState();
shot.begin("p", new Map([["enemy", { x: 1, y: 0 }]]));
assert.equal(shot.bounce("wall", 0), true);
assert.equal(shot.bounce("wall", 0.04), false);
assert.equal(
    shot.collide({ fighterId: "enemy", relation: "enemy", targetToContact: { x: -1, y: 0 } }).type,
    "rear-hit"
);
shot.begin("p");
assert.equal(shot.tick(0.2, 80).type, "slow-stop");
const trajectory = predictTrajectory({
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    maxDistance: 10,
    castRay: ({ origin, direction }) => ({
        type: "static",
        point: { x: origin.x + direction.x, y: origin.y + direction.y },
        distance: 1,
        normal: { x: -1, y: 0 },
        surfaceKey: "w"
    })
});
assert.equal(trajectory.bounces.length, 3);
assert.equal(trajectory.segments.length, 4);
const queue = new EnemyAttackQueue();
assert.equal(queue.tick(0, ["a", "b"]).attackerId, "a");
assert.equal(queue.tick(1, ["a", "b"], 1).type, "launch");
assert.equal(queue.resolveFlight("hit", ["a", "b"]).attackerId, "b");
assert.equal(DRAG_COMBAT_CONFIG.enemy.attackDamageMultiplier, 1.35);
assert.deepEqual(new ArenaCamera().screenToWorld({ x: 1, y: 1 }, { width: 1, height: 1 }, { width: 1, height: 1 }), {
    x: 1,
    y: 1
});
const guardedPoint = screenToWorld({ x: 1, y: 1 }, { scale: 0, offsetX: 0, offsetY: 0 });
assert.equal(guardedPoint.x, 0);
assert.equal(guardedPoint.y, 0);
assert.equal(getSlingshotVector(null, { x: 0, y: 0 }).active, false);
assert.equal(isShieldFront({ x: 0, y: 0 }, { x: 1, y: 0 }), false);
assert.equal(isShieldFront({ x: 1, y: 0 }, { x: 0, y: 0 }), true);
const lockedDrag = new DragInputState();
lockedDrag.lock(1);
assert.equal(lockedDrag.begin(1, { x: 0, y: 0 }), null);
lockedDrag.tick(1);
lockedDrag.begin(1, { x: 0, y: 0 });
assert.equal(lockedDrag.release(1).type, "cancel");
assert.equal(lockedDrag.cooldownRemaining, 0);
lockedDrag.begin(1, { x: 0, y: 0 });
lockedDrag.move(1, { x: -140, y: 0 });
const autoLaunch = lockedDrag.tick(1.2);
assert.equal(autoLaunch.type, "launch");
const readyAt = autoLaunch.cooldownReadyAt;
lockedDrag.tick(9);
assert.equal(autoLaunch.cooldownReadyAt, readyAt);
const cleanupShot = new PlayerShotState();
cleanupShot.begin("p", new Map([["e", { x: 1, y: 0 }]]));
cleanupShot.bounce("a", 2);
assert.equal(cleanupShot.bounce("b", 1), false);
assert.equal(cleanupShot.bounce("b", Number.NaN), false);
assert.equal(
    cleanupShot.collide({ fighterId: "e", relation: "ally", targetToContact: { x: 1, y: 0 } }).type,
    "ally-stop"
);
assert.equal(cleanupShot.shieldForwards.size, 0);
assert.equal(cleanupShot.bounceCount, 0);
assert.equal(cleanupShot.recentSurface, null);
for (const count of [0, 1, 2, 3, 4]) {
    const rear = new PlayerShotState();
    rear.begin("p");
    for (let bounce = 0; bounce < count; bounce += 1) rear.bounce(`b${bounce}`, bounce);
    const result = rear.collide({ fighterId: "e", relation: "enemy", targetToContact: { x: -1, y: 0 } });
    assert.equal(result.type, count ? "rear-hit" : "plain-hit");
}
const noHit = predictTrajectory({
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    maxDistance: 2,
    castRay: () => null
});
assert.equal(noHit.segments.length, 1);
const fighterHit = predictTrajectory({
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    maxDistance: 2,
    castRay: () => ({ type: "fighter", point: { x: 1, y: 0 }, distance: 1, fighterId: "e" })
});
assert.equal(fighterHit.terminal.fighterId, "e");
const protectedQueue = new EnemyAttackQueue();
protectedQueue.protectUntil(10);
assert.equal(protectedQueue.tick(0, ["a", "b"]).protectedLaunchNotBefore, 10);
protectedQueue.protectUntil(20);
assert.equal(protectedQueue.tick(1, ["a", "b"], 9), null);
assert.equal(protectedQueue.tick(0, ["a", "b"], 10).type, "launch");
assert.equal(protectedQueue.resolveFlight("hit", ["b", "c"]).attackerId, "b");
assert.equal(protectedQueue.idOrder.length <= 2, true);
for (let index = 0; index < 10000; index += 1) {
    const probeDrag = new DragInputState();
    probeDrag.begin(index, { x: 0, y: 0 });
    probeDrag.move(index, { x: -140, y: 0 });
    assert.equal(probeDrag.release(index)?.type, "launch");
    const probeShot = new PlayerShotState();
    probeShot.begin("p");
    assert.equal(probeShot.bounce(`surface-${index % 3}`, index), true);
    probeShot.reset();
    assert.equal(probeShot.shieldForwards.size, 0);
    const probePath = predictTrajectory({
        origin: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        maxDistance: 4,
        castRay: () => null
    });
    assert.equal(probePath.segments.length <= 4 && probePath.bounces.length <= 3, true);
    assert.equal(Number.isFinite(probePath.segments[0].end.x), true);
    const probeQueue = new EnemyAttackQueue();
    probeQueue.tick(0, ["a", "b"]);
    assert.equal(probeQueue.idOrder.length <= 2, true);
    probeQueue.reset();
    assert.equal(probeQueue.idOrder.length, 0);
}
console.log("[drag-vector-combat] ok");
