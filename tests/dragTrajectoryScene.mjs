import assert from "node:assert/strict";
import { createDragTrajectoryScene } from "../src/combat-drag/index.js";

const player = { id: "p", teamId: "a", position: { x: 100, y: 100 }, radius: 10, stats: { baseSpeed: 100 } };
const snapshot = (chargeRatio = 1, vector = { x: 1, y: 0 }) => ({
    drag: { state: "aiming", chargeRatio, vector: { active: true, strength: 0, vector } }
});
const scene = (extra = {}, runtimeSnapshot = snapshot()) =>
    createDragTrajectoryScene({
        simulation: { width: 300, height: 200, playerBall: player, fighters: [player], terrain: [], ...extra },
        runtimeSnapshot
    });
assert.equal(scene({}, { drag: { state: "idle" } }).active, false);
assert.deepEqual(scene().launchVelocity, { x: 480, y: 0 });
assert.equal(scene({}, snapshot(0)).launchVelocity.x, 165);
assert.ok(Math.abs(scene({}, snapshot(0.5)).launchVelocity.x - 322.5) < 1e-8);
assert.equal(
    scene(
        {},
        {
            ...snapshot(1),
            launch: { minSpeedRatio: 1.65, maxSpeedRatio: 4.8, releaseSpeedMultiplier: 1.5, shotMaxSeconds: 2.4 }
        }
    ).launchVelocity.x,
    720
);
const withVelocity = (velocity) => ({
    ...player,
    velocity,
    position: { ...player.position },
    stats: { ...player.stats }
});
const velocityScene = (velocity) => {
    const movingPlayer = withVelocity(velocity);
    return scene({ playerBall: movingPlayer, fighters: [movingPlayer] });
};
assert.deepEqual(velocityScene({ x: 0, y: 0 }).launchVelocity, { x: 480, y: 0 });
assert.deepEqual(velocityScene({ x: 30, y: 0 }).launchVelocity, { x: 510, y: 0 });
assert.deepEqual(velocityScene({ x: -30, y: 0 }).launchVelocity, { x: 450, y: 0 });
assert.deepEqual(velocityScene({ x: 0, y: 40 }).launchVelocity, { x: 480, y: 40 });
const cancelledVelocity = velocityScene({ x: -480, y: 0 });
assert.deepEqual(cancelledVelocity.launchVelocity, { x: 0, y: 0 });
assert.equal(cancelledVelocity.segments.length, 0);
const wall = scene({ width: 150 });
assert.equal(wall.bounces.length, 3);
assert.equal(wall.segments.length, 4);
assert.equal(wall.bounces[0].surfaceKey, "wall:right");
const circle = scene({ terrain: [{ id: "rock", shape: "circle", blocking: true, x: 160, y: 100, radius: 20 }] });
assert.equal(circle.segments[0].collision.surfaceKey, "terrain:rock");
assert.equal(circle.segments[0].end.x, 130);
const polygon = scene({
    terrain: [
        {
            shape: "polygon",
            blocking: true,
            x: 160,
            y: 100,
            points: [
                { x: -10, y: -20 },
                { x: 10, y: -20 },
                { x: 10, y: 20 },
                { x: -10, y: 20 }
            ]
        }
    ]
});
assert.equal(polygon.segments[0].collision.surfaceKey.startsWith("terrain:polygon:"), true);
const enemy = { id: "e", teamId: "b", position: { x: 130, y: 100 }, radius: 10, flags: {}, state: {} };
const terminal = scene({ fighters: [player, enemy] });
assert.equal(terminal.terminal.fighterId, "e");
assert.equal(terminal.bounces.length, 0);
const shield = scene({ fighters: [player, enemy] }, snapshot(1));
assert.equal(shield.terminal.shieldResult, "front-counter");
const rearEnemy = { ...enemy, position: { x: 80, y: 100 } };
const rear = scene(
    { width: 150, fighters: [player, rearEnemy] },
    { ...snapshot(1), playerShot: { shields: [{ fighterId: "e", forward: { x: -1, y: 0 } }] } }
);
assert.equal(rear.bounces.length, 1);
assert.equal(rear.terminal.shieldResult, "rear-hit");
const ally = scene({ fighters: [player, { ...enemy, teamId: "a" }] });
assert.equal(ally.terminal.relation, "ally");
assert.equal(ally.terminal.shieldResult, "plain");
const invalid = scene({
    fighters: [
        player,
        { ...enemy, id: "x", participation: { canBeTargeted: false } },
        { ...enemy, id: "dead", flags: { defeated: true } }
    ]
});
assert.equal(
    invalid.segments.some((segment) => segment.collision?.fighterId),
    false,
    "untargetable and defeated fighters must be absent from the preview path"
);
const standby = scene({ fighters: [player, enemy], standbyFighters: [enemy] });
assert.equal(
    standby.segments.some((segment) => segment.collision?.fighterId),
    false,
    "standby fighters must be absent from the preview path"
);
for (const [name, position, vector, expectedKey] of [
    ["left", { x: 100, y: 100 }, { x: -1, y: 0 }, "wall:left"],
    ["right", { x: 100, y: 100 }, { x: 1, y: 0 }, "wall:right"],
    ["top", { x: 100, y: 100 }, { x: 0, y: -1 }, "wall:top"],
    ["bottom", { x: 100, y: 100 }, { x: 0, y: 1 }, "wall:bottom"]
]) {
    const directionalPlayer = { ...player, position };
    const result = createDragTrajectoryScene({
        simulation: {
            width: 300,
            height: 200,
            playerBall: directionalPlayer,
            fighters: [directionalPlayer],
            terrain: []
        },
        runtimeSnapshot: snapshot(1, vector)
    });
    assert.equal(result.bounces[0].surfaceKey, expectedKey, name);
}
const corner = scene({}, snapshot(1, { x: 1, y: 1 }));
assert.equal(["wall:right", "wall:bottom"].includes(corner.bounces[0].surfaceKey), true);
assert.deepEqual(
    wall.segments.map((segment) => segment.rewardTier),
    [0, 1, 2, 3]
);
assert.deepEqual(
    wall.bounces.map((bounce) => bounce.tier),
    [1, 2, 3]
);
const vertex = scene(
    {
        terrain: [
            {
                id: "vertex",
                shape: "polygon",
                blocking: true,
                x: 160,
                y: 120,
                points: [
                    { x: -10, y: -10 },
                    { x: 10, y: -10 },
                    { x: 10, y: 10 },
                    { x: -10, y: 10 }
                ]
            }
        ]
    },
    snapshot(1, { x: 1, y: 0.2 })
);
assert.equal(vertex.segments[0].collision.surfaceKey, "terrain:vertex");
assert.equal(Number.isFinite(vertex.segments[0].collision.normal.x), true);
const frozenSimulation = Object.freeze({
    width: 150,
    height: 200,
    playerBall: Object.freeze({
        ...player,
        position: Object.freeze({ ...player.position }),
        stats: Object.freeze({ ...player.stats })
    }),
    fighters: Object.freeze([player]),
    terrain: Object.freeze([])
});
assert.equal(createDragTrajectoryScene({ simulation: frozenSimulation, runtimeSnapshot: snapshot() }).active, true);
for (let index = 0; index < 10000; index += 1) {
    const result = scene({
        terrain: [
            {
                shape: "polygon",
                blocking: true,
                x: 150,
                y: 100,
                points: [
                    { x: -10, y: -10 },
                    { x: 10, y: -10 },
                    { x: 10, y: 10 },
                    { x: -10, y: 10 }
                ]
            }
        ]
    });
    assert.equal(
        result.segments.length <= 4 &&
            result.bounces.length <= 3 &&
            result.segments.every((part) => Number.isFinite(part.end.x) && Number.isFinite(part.end.y)),
        true
    );
}
console.log("[drag-trajectory-scene] ok");
