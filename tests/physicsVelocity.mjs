import assert from "node:assert/strict";
import { Vector2 } from "../src/core.js";
import PhysicsBody from "../src/physics/PhysicsBody.js";
import { LINEAR_VELOCITY_POLICY, resolveLinearVelocityPolicy } from "../src/physics/linearVelocityPolicy.js";

class VelocityProbeBase {
    constructor() {
        this.stats = { baseSpeed: 400 };
        this.mastery = { physics: { velocityRecoveryBonus: 0 } };
        this.state = { slow: null, speedBoost: null, movement: null, forcedHeading: null };
    }
    getStatModifiers() {
        return { speed: 1 };
    }
}

const VelocityProbe = PhysicsBody(VelocityProbeBase);

function runForOneSecond(initialSpeed, frames) {
    const body = new VelocityProbe();
    body.velocity = new Vector2(initialSpeed, 0);
    for (let frame = 0; frame < frames; frame += 1) body._applyVelocityCorrection({}, 1 / frames);
    return body.velocity.length();
}

const belowReference = resolveLinearVelocityPolicy({ currentSpeed: 200, referenceSpeed: 400, delta: 1 });
assert.equal(belowReference.mode, "recovery");
assert.ok(belowReference.nextSpeed > 399 && belowReference.nextSpeed < 400);

const aboveReference = resolveLinearVelocityPolicy({ currentSpeed: 800, referenceSpeed: 400, delta: 1 });
assert.equal(aboveReference.mode, "friction");
assert.equal(aboveReference.nextSpeed, 800 * LINEAR_VELOCITY_POLICY.frictionRetentionPerSecond);

assert.ok(Math.abs(runForOneSecond(200, 60) - runForOneSecond(200, 1)) < 1e-6);
assert.ok(Math.abs(runForOneSecond(800, 60) - runForOneSecond(800, 1)) < 1e-6);
assert.ok(runForOneSecond(800, 60) > 400 * 1.29, "high-speed momentum should decay by friction, not snap to base");
assert.ok(runForOneSecond(200, 60) < 400, "sub-reference recovery should approach without overshooting");

console.log("[physics-velocity-policy] ok");
