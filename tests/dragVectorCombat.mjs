import assert from "node:assert/strict";
import { ArenaCamera } from "../src/camera.js";
import { DragInputState, EnemyAttackQueue, PlayerShotState, predictTrajectory } from "../src/combat-drag/index.js";
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
console.log("[drag-vector-combat] ok");
