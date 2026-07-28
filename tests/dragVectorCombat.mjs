import assert from "node:assert/strict";
import { ArenaCamera } from "../src/camera.js";
import {
    clampDragReleaseSpeedMultiplier,
    createDragCombatConfig,
    DragInputState,
    DRAG_RELEASE_SPEED_TUNING,
    EnemyAttackQueue,
    advanceEnemyChargePlan,
    getChargeRatio,
    getEnemyChargePlan,
    getEnemyRequiredChargeRatio,
    getDragLaunchSpeed,
    PlayerShotState,
    predictTrajectory
} from "../src/combat-drag/index.js";
import { DRAG_COMBAT_CONFIG } from "../src/combat-drag/config.js";
import {
    DRAG_RELEASE_PREVIEW_CONFIG,
    DragReleasePreviewController,
    DragReleasePreviewScene
} from "../src/developer/dragReleasePreview.js";
import {
    getRicochetDamageMultiplier,
    getSlingshotVector,
    isShieldFront,
    reflectDirection,
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
assert.deepEqual(drag.begin(2, { x: 0, y: 0 }), { type: "begin" });
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
const reflectedSlowShot = new PlayerShotState();
reflectedSlowShot.begin("p");
assert.equal(reflectedSlowShot.tick(0.1, 80), null);
assert.equal(reflectedSlowShot.bounce("wall", 0.1), true);
assert.equal(reflectedSlowShot.tick(0.1, 80), null);
assert.equal(reflectedSlowShot.tick(0.1, 80).type, "slow-stop");
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
lockedDrag.begin(1, { x: 0, y: 0 });
lockedDrag.move(1, { x: -140, y: 0 });
const autoLaunch = lockedDrag.tick(1.2);
assert.equal(autoLaunch.type, "launch");
assert.deepEqual(lockedDrag.begin(2, { x: 0, y: 0 }), { type: "begin" });
assert.equal(lockedDrag.cancel(2).type, "cancel");
const invalidAutoDrag = new DragInputState();
invalidAutoDrag.begin(1, { x: 0, y: 0 });
assert.equal(invalidAutoDrag.tick(1.2), null);
assert.equal(invalidAutoDrag.tick(1.2), null);
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
const counterShot = new PlayerShotState();
counterShot.begin("p", new Map([["e", { x: 1, y: 0 }]]));
assert.equal(
    counterShot.collide({ fighterId: "e", relation: "enemy", targetToContact: { x: 1, y: 0 } }).type,
    "shield-counter"
);
const timeoutShot = new PlayerShotState();
timeoutShot.begin("p");
assert.equal(timeoutShot.tick(2.4, 100).type, "timeout");
assert.equal(timeoutShot.tick(1, 100), null);
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
const immutableOrigin = Object.freeze({ x: 0, y: 0 });
const immutableDirection = Object.freeze({ x: 1, y: 0 });
const reflectedTrajectory = predictTrajectory({
    origin: immutableOrigin,
    direction: immutableDirection,
    maxDistance: 10,
    castRay: ({ origin, direction }) => ({
        type: "static",
        point: { x: origin.x + direction.x, y: origin.y + direction.y },
        distance: 1,
        normal: { x: -direction.x, y: -direction.y },
        surfaceKey: `surface-${origin.x}`
    })
});
assert.equal(reflectedTrajectory.bounces.length, 3);
assert.equal(reflectedTrajectory.segments.length, 4);
assert.deepEqual(immutableOrigin, { x: 0, y: 0 });
assert.deepEqual(immutableDirection, { x: 1, y: 0 });
const invalidTrajectory = predictTrajectory({
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    maxDistance: 3,
    castRay: () => ({ type: "static", point: { x: Number.NaN, y: 0 }, distance: 1, normal: { x: -1, y: 0 } })
});
assert.equal(invalidTrajectory.segments.length, 1);
const repeatedPointTrajectory = predictTrajectory({
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    maxDistance: 10,
    castRay: () => ({ type: "static", point: { x: 1, y: 0 }, distance: 1, normal: { x: -1, y: 0 } })
});
assert.equal(repeatedPointTrajectory.segments.length <= 4, true);
assert.equal(repeatedPointTrajectory.bounces.length <= 3, true);
const roundRobinQueue = new EnemyAttackQueue();
assert.equal(roundRobinQueue.tick(0, ["a", "b", "c"]).attackerId, "a");
assert.equal(roundRobinQueue.tick(0, ["b", "c"]).attackerId, "b");
assert.equal(roundRobinQueue.tick(1, ["b", "c"], 1).type, "launch");
assert.equal(roundRobinQueue.resolveFlight("hit", ["c"]).attackerId, "c");
for (let index = 0; index < 10000; index += 1) {
    const probeDrag = new DragInputState();
    probeDrag.begin(index, { x: 0, y: 0 });
    probeDrag.move(index, { x: -140, y: 0 });
    assert.equal(probeDrag.release(index)?.type, "launch");
    assert.equal(probeDrag.release(index), null);
    assert.equal(probeDrag.tick(0), null);
    const probeShot = new PlayerShotState();
    probeShot.begin("p");
    assert.equal(probeShot.bounce(`surface-${index % 3}`, index), true);
    assert.equal(probeShot.tick(2.4, 100).type, "timeout");
    assert.equal(probeShot.active, false);
    assert.equal(probeShot.shieldForwards.size, 0);
    assert.equal(probeShot.bounceCount, 0);
    assert.equal(probeShot.recentSurface, null);
    const probePath = predictTrajectory({
        origin: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        maxDistance: 4,
        castRay: () => null
    });
    assert.equal(probePath.segments.length <= 4 && probePath.bounces.length <= 3, true);
    assert.equal(
        probePath.segments.every(
            (segment) =>
                Number.isFinite(segment.origin.x) &&
                Number.isFinite(segment.origin.y) &&
                Number.isFinite(segment.end.x) &&
                Number.isFinite(segment.end.y) &&
                Number.isFinite(Math.hypot(segment.end.x - segment.origin.x, segment.end.y - segment.origin.y))
        ),
        true
    );
    assert.equal(
        probePath.bounces.every((bounce) => Number.isFinite(bounce.point.x) && Number.isFinite(bounce.point.y)),
        true
    );
    const probeQueue = new EnemyAttackQueue();
    probeQueue.tick(0, ["a", "b"]);
    assert.equal(probeQueue.idOrder.length <= 2, true);
    probeQueue.reset();
    assert.equal(probeQueue.idOrder.length, 0);
    assert.equal(Number.isFinite(probeQueue.cursor) && Number.isFinite(probeQueue.elapsed), true);
}

assert.deepEqual(DRAG_COMBAT_CONFIG.input, {
    deadZonePx: 24,
    maxPullPx: 140,
    maxAimSeconds: 1.2
});
assert.deepEqual(DRAG_COMBAT_CONFIG.shot, {
    minSpeedRatio: 1.65,
    maxSpeedRatio: 4.8,
    releaseSpeedMultiplier: 1,
    shotMaxSeconds: 2.4,
    shotSlowSpeed: 90,
    shotSlowBaseSpeedRatio: 0.3,
    shotSlowSeconds: 0.18,
    bounceDebounceSeconds: 0.08
});
assert.deepEqual(DRAG_RELEASE_SPEED_TUNING, {
    defaultMultiplier: 1,
    minMultiplier: 0.6,
    maxMultiplier: 1.8,
    step: 0.05
});
assert.equal(clampDragReleaseSpeedMultiplier(Number.NaN), 1);
assert.equal(clampDragReleaseSpeedMultiplier(0), 0.6);
assert.equal(clampDragReleaseSpeedMultiplier(99), 1.8);
assert.equal(createDragCombatConfig(1.45).shot.releaseSpeedMultiplier, 1.45);
assert.equal(getDragLaunchSpeed(100, 0), 165);
assert.equal(getDragLaunchSpeed(100, 1), 480);
assert.ok(Math.abs(getDragLaunchSpeed(100, 0.5, createDragCombatConfig(1.4).shot) - 451.5) < 1e-8);
assert.equal(getChargeRatio(0.6), 0.5);
assert.equal(getEnemyRequiredChargeRatio(600, 0, 400), 1);
assert.equal(getEnemyRequiredChargeRatio(0, 0, 400), 0.35);
assert.equal(getEnemyRequiredChargeRatio(300, 400, 400), 0.65);
const originalPlan = getEnemyChargePlan({ requiredChargeRatio: 1 });
const approachingPlan = advanceEnemyChargePlan(originalPlan, { now: 0.3, requiredChargeRatio: 0.35 });
assert.equal(approachingPlan.plannedEndAt, 1.2, "lower requirement waits until natural charge is sufficient");
const acceleratedPlan = advanceEnemyChargePlan(approachingPlan, { now: 0.42, requiredChargeRatio: 0.35 });
assert.equal(acceleratedPlan.accelerating, true);
assert.ok(Math.abs(acceleratedPlan.plannedEndAt - 0.64) < 1e-8);
const acceleratedLater = advanceEnemyChargePlan(acceleratedPlan, { now: 0.53, requiredChargeRatio: 0.8 });
assert.equal(acceleratedLater.plannedEndAt, acceleratedPlan.plannedEndAt, "planned end never moves later");
assert.ok(acceleratedLater.displayProgress >= acceleratedPlan.displayProgress, "display progress never reverses");
assert.ok(acceleratedLater.naturalRatio < 1, "visual acceleration does not jump actual charge to full");
const latePlan = advanceEnemyChargePlan(originalPlan, { now: 1, requiredChargeRatio: 0.35 });
assert.equal(latePlan.accelerating, false);
assert.equal(latePlan.plannedEndAt, 1.2, "the final 0.22 second visual window is not shortened");

const previewFighter = {
    id: "preview-trickster",
    name: "Trickster Ball",
    color: "#d99cff",
    baseSpeed: 480,
    baseRadius: 46,
    mass: 1.02,
    level: 7
};
const releasePreview = new DragReleasePreviewScene(1, previewFighter);
const previewStart = { ...DRAG_RELEASE_PREVIEW_CONFIG.start };
assert.deepEqual(releasePreview.getSnapshot().fighter, previewFighter);
assert.equal(releasePreview.begin(31, previewStart).type, "begin");
releasePreview.move(31, { x: previewStart.x - DRAG_COMBAT_CONFIG.input.maxPullPx, y: previewStart.y });
for (let step = 0; step < 12; step += 1) releasePreview.update(1 / 20);
const previewLaunch = releasePreview.release(31);
assert.equal(previewLaunch.type, "launch");
assert.ok(Math.abs(previewLaunch.chargeRatio - 0.5) < 1e-8);
assert.equal(previewLaunch.speed, getDragLaunchSpeed(previewFighter.baseSpeed, 0.5));
for (let step = 0; step < 12; step += 1) releasePreview.update(1 / 20);
assert.ok(releasePreview.getSnapshot().bounceCount >= 1, "preview should expose wall-reflected release movement");
releasePreview.setReleaseSpeedMultiplier(1.8);
releasePreview.reset();
assert.equal(releasePreview.begin(32, previewStart).type, "begin");
releasePreview.move(32, { x: previewStart.x - DRAG_COMBAT_CONFIG.input.maxPullPx, y: previewStart.y });
for (let step = 0; step < 24; step += 1) releasePreview.update(1 / 20);
assert.equal(
    releasePreview.getSnapshot().lastLaunch.speed,
    getDragLaunchSpeed(previewFighter.baseSpeed, 1, createDragCombatConfig(1.8).shot)
);
const movingDrawLabels = [];
const movingDrawContext = new Proxy(
    {
        fillText: (label) => movingDrawLabels.push(label)
    },
    {
        get: (target, property) => target[property] ?? (() => {})
    }
);
releasePreview.draw(movingDrawContext);
assert.equal(
    movingDrawLabels.some((label) => label.includes(previewFighter.name)),
    false,
    "moving preview ball should not be covered by its information panel"
);
releasePreview.reset();
const idleDrawLabels = [];
const idleDrawContext = new Proxy(
    {
        fillText: (label) => idleDrawLabels.push(label)
    },
    {
        get: (target, property) => target[property] ?? (() => {})
    }
);
releasePreview.draw(idleDrawContext);
assert.ok(
    idleDrawLabels.some((label) => label.includes(previewFighter.name)),
    "idle preview should restore the selected fighter information panel"
);

const previewListeners = new Map();
let cancelledPreviewFrame = null;
let previewObserverDisconnected = false;
class PreviewResizeObserver {
    observe() {}
    disconnect() {
        previewObserverDisconnected = true;
    }
}
const previewCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({}),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }),
    addEventListener: (type, handler) => previewListeners.set(type, handler),
    removeEventListener: (type, handler) => {
        if (previewListeners.get(type) === handler) previewListeners.delete(type);
    }
};
const releasePreviewController = new DragReleasePreviewController({
    requestFrame: () => 77,
    cancelFrame: (frameId) => {
        cancelledPreviewFrame = frameId;
    },
    ResizeObserverClass: PreviewResizeObserver
});
assert.equal(releasePreviewController.start(previewCanvas, { value: 1.2, fighter: previewFighter }).ok, true);
assert.equal(releasePreviewController.scene.getSnapshot().fighter.id, previewFighter.id);
assert.deepEqual(
    [...previewListeners.keys()],
    ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]
);
releasePreviewController.stop();
assert.equal(previewListeners.size, 0);
assert.equal(cancelledPreviewFrame, 77);
assert.equal(previewObserverDisconnected, true);
assert.deepEqual(DRAG_COMBAT_CONFIG.shield, {
    durationSeconds: 0.8,
    frontIncomingMultiplier: 1.5,
    frontRecoilSpeedRatio: 1.6,
    frontInputLockSeconds: 0.27,
    ricochetOneMultiplier: 1,
    ricochetTwoMultiplier: 1.45,
    ricochetThreeOrMoreMultiplier: 1.9,
    ricochetThreeOrMoreStaggerSeconds: 0.45
});
assert.deepEqual(DRAG_COMBAT_CONFIG.enemy, {
    windupSeconds: 1,
    flightMaxSeconds: 1.8,
    attackDamageMultiplier: 1.35,
    enemyHealthMultiplier: 0.88,
    enemyGroupHealthExponent: 3
});

const immutableStart = Object.freeze({ x: 4, y: 5 });
const immutableCurrent = Object.freeze({ x: 74, y: 5 });
const immutableConfig = Object.freeze({ deadZonePx: 24, maxPullPx: 140 });
const oppositeShot = getSlingshotVector(immutableStart, immutableCurrent, immutableConfig);
assert.deepEqual({ x: oppositeShot.vector.x, y: oppositeShot.vector.y }, { x: -1, y: 0 });
assert.deepEqual(immutableStart, { x: 4, y: 5 });
assert.deepEqual(immutableCurrent, { x: 74, y: 5 });
assert.deepEqual(immutableConfig, { deadZonePx: 24, maxPullPx: 140 });
for (const invalidPoint of [null, { x: Number.NaN, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 0 }]) {
    assert.equal(getSlingshotVector(invalidPoint, { x: 0, y: 0 }).active, false);
}
assert.equal(getSlingshotVector({ x: 0, y: 0 }, { x: 1, y: 0 }, { deadZonePx: 24, maxPullPx: 24 }).active, false);
const nonfiniteOffsetPoint = screenToWorld({ x: 1, y: 1 }, { scale: 1, offsetX: Number.NaN, offsetY: 0 });
assert.deepEqual({ x: nonfiniteOffsetPoint.x, y: nonfiniteOffsetPoint.y }, { x: 0, y: 0 });
const roundTripCamera = new ArenaCamera();
const roundTripCanvas = { width: 400, height: 300 };
const roundTripSimulation = { width: 200, height: 100, camera: { zoom: 1 } };
const roundTripView = roundTripCamera.getViewTransform(roundTripCanvas, roundTripSimulation);
const roundTripWorld = { x: 80, y: 40 };
const roundTripScreen = {
    x: roundTripWorld.x * roundTripView.scale + roundTripView.offsetX,
    y: roundTripWorld.y * roundTripView.scale + roundTripView.offsetY
};
assert.deepEqual(roundTripCamera.screenToWorld(roundTripScreen, roundTripCanvas, roundTripSimulation), roundTripWorld);

assert.equal(isShieldFront({ x: 1, y: 0 }, { x: 1, y: 0 }), true);
assert.equal(isShieldFront({ x: 1, y: 0 }, { x: 0, y: 1 }), true);
assert.equal(isShieldFront({ x: 1, y: 0 }, { x: -1, y: 0 }), false);
assert.equal(isShieldFront({ x: 0, y: 0 }, { x: 1, y: 0 }), false);
const reflectionDirection = Object.freeze({ x: 1, y: -1 });
const reflectionNormal = Object.freeze({ x: 0, y: 1 });
const reflection = reflectDirection(reflectionDirection, reflectionNormal);
assert.deepEqual({ x: reflection.x, y: reflection.y }, { x: 1, y: 1 });
assert.equal(Number.isFinite(reflection.x) && Number.isFinite(reflection.y), true);
assert.deepEqual(reflectionDirection, { x: 1, y: -1 });
assert.deepEqual(reflectionNormal, { x: 0, y: 1 });
assert.deepEqual(
    { x: reflectDirection({ x: 1, y: 0 }, { x: 0, y: 0 }).x, y: reflectDirection({ x: 1, y: 0 }, { x: 0, y: 0 }).y },
    { x: 0, y: 0 }
);

const stateDrag = new DragInputState();
assert.deepEqual(stateDrag.begin(7, { x: 0, y: 0 }), { type: "begin" });
assert.equal(stateDrag.move(8, { x: -140, y: 0 }), null);
assert.equal(stateDrag.release(8), null);
assert.equal(stateDrag.move(7, { x: -140, y: 0 }).active, true);
assert.equal(stateDrag.release(7).type, "launch");
assert.deepEqual(stateDrag.begin(9, { x: 0, y: 0 }), { type: "begin" });
assert.equal(stateDrag.cancel(9).type, "cancel");
stateDrag.reset();
assert.deepEqual(
    {
        state: stateDrag.state,
        pointerId: stateDrag.pointerId,
        start: stateDrag.start,
        current: stateDrag.current
    },
    { state: "idle", pointerId: null, start: null, current: null }
);

const detailedCounterShot = new PlayerShotState();
detailedCounterShot.begin("p", new Map([["e", { x: 1, y: 0 }]]));
assert.deepEqual(detailedCounterShot.collide({ fighterId: "e", relation: "enemy", targetToContact: { x: 1, y: 0 } }), {
    type: "shield-counter",
    outgoingMultiplier: 0,
    incomingMultiplier: 1.5,
    recoilSpeedRatio: 1.6,
    inputLockSeconds: 0.27,
    bounceCount: 0
});
assert.equal(detailedCounterShot.active, false);
assert.equal(detailedCounterShot.shieldForwards.size, 0);
const expiringShieldShot = new PlayerShotState();
expiringShieldShot.begin("p", new Map([["e", { x: 1, y: 0 }]]));
assert.equal(expiringShieldShot.tick(0.79, 200, 100), null);
assert.equal(expiringShieldShot.shieldForwards.size, 1);
assert.equal(expiringShieldShot.tick(0.01, 200, 100), null);
assert.equal(expiringShieldShot.shieldForwards.size, 0);
assert.equal(expiringShieldShot.active, true, "shield expiry must not end the player's shot");
for (const [count, multiplier, stagger] of [
    [1, 1, 0],
    [2, 1.45, 0],
    [3, 1.9, 0.45],
    [4, 1.9, 0.45]
]) {
    const rearShot = new PlayerShotState();
    rearShot.begin("p");
    for (let bounce = 0; bounce < count; bounce += 1) rearShot.bounce(`rear-${bounce}`, bounce);
    const result = rearShot.collide({ fighterId: "e", relation: "enemy", targetToContact: { x: -1, y: 0 } });
    assert.deepEqual(
        { damageMultiplier: result.damageMultiplier, staggerSeconds: result.staggerSeconds },
        { damageMultiplier: multiplier, staggerSeconds: stagger }
    );
    assert.equal(rearShot.active, false);
    assert.equal(rearShot.recentSurface, null);
}
const resetSlowShot = new PlayerShotState();
resetSlowShot.begin("p");
assert.equal(resetSlowShot.tick(0.1, 90), null);
assert.equal(resetSlowShot.tick(0.1, 91), null);
assert.equal(resetSlowShot.tick(0.1, 90), null);
assert.equal(resetSlowShot.tick(0.1, 90).type, "slow-stop");
assert.equal(resetSlowShot.active, false);
assert.equal(timeoutShot.active, false);

function reflectedPath(count) {
    let calls = 0;
    return predictTrajectory({
        origin: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        maxDistance: 20,
        castRay: ({ origin, direction }) => {
            if (calls++ >= count) return null;
            return {
                type: "static",
                point: { x: origin.x + direction.x, y: origin.y },
                distance: 1,
                normal: { x: -direction.x, y: 0 }
            };
        }
    });
}
for (const count of [1, 2, 3]) {
    const path = reflectedPath(count);
    assert.equal(path.bounces.length, count);
    assert.equal(path.segments.length, count + 1);
}
for (const invalidHit of [
    { type: "static", point: { x: 1, y: 0 }, distance: 0, normal: { x: -1, y: 0 } },
    { type: "static", point: { x: 1, y: 0 }, distance: Number.NaN, normal: { x: -1, y: 0 } },
    { type: "static", point: { x: 1, y: 0 }, distance: 1, normal: { x: Number.NaN, y: 0 } }
]) {
    const path = predictTrajectory({
        origin: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        maxDistance: 2,
        castRay: () => invalidHit
    });
    assert.equal(path.segments.length, 1);
    assert.equal(path.bounces.length, 0);
}
const frozenCollision = Object.freeze({
    type: "fighter",
    point: Object.freeze({ x: 1, y: 0 }),
    distance: 1,
    fighterId: "e"
});
assert.equal(
    predictTrajectory({
        origin: immutableOrigin,
        direction: immutableDirection,
        maxDistance: 2,
        castRay: () => frozenCollision
    }).terminal.fighterId,
    "e"
);
assert.deepEqual(frozenCollision, { type: "fighter", point: { x: 1, y: 0 }, distance: 1, fighterId: "e" });

for (const reason of ["first-character", "slow", "timeout"]) {
    const reasonQueue = new EnemyAttackQueue();
    reasonQueue.tick(0, ["a", "b"]);
    reasonQueue.tick(1, ["a", "b"], 1);
    assert.deepEqual(reasonQueue.resolveFlight(reason, ["a", "b"]), {
        type: "windup",
        attackerId: "b",
        after: reason
    });
}
const emptyQueue = new EnemyAttackQueue();
emptyQueue.tick(0, ["a"]);
emptyQueue.tick(0, [], 0);
assert.deepEqual(
    {
        state: emptyQueue.state,
        attackerId: emptyQueue.attackerId,
        idOrder: emptyQueue.idOrder,
        cursor: emptyQueue.cursor,
        elapsed: emptyQueue.elapsed,
        lastResult: emptyQueue.lastResult
    },
    {
        state: "idle",
        attackerId: null,
        idOrder: [],
        cursor: 0,
        elapsed: 0,
        lastResult: null
    }
);
console.log("[drag-vector-combat] ok");
