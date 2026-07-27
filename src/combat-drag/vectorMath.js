import { Vector2 } from "../core.js";
import { screenToWorld as cameraScreenToWorld } from "../camera.js";
import { DRAG_COMBAT_CONFIG } from "./config.js";

const finitePoint = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);

export function screenToWorld(point, view) {
    const world = cameraScreenToWorld(point, view);
    return new Vector2(world.x, world.y);
}

export function getSlingshotVector(start, current, config = DRAG_COMBAT_CONFIG.input) {
    if (
        !finitePoint(start) ||
        !finitePoint(current) ||
        !Number.isFinite(config?.deadZonePx) ||
        !Number.isFinite(config?.maxPullPx) ||
        config.maxPullPx <= config.deadZonePx
    ) {
        return { vector: new Vector2(), rawLength: 0, pullLength: 0, rawStrength: 0, strength: 0, active: false };
    }
    const raw = new Vector2(start.x - current.x, start.y - current.y);
    const rawLength = raw.length();
    if (rawLength <= config.deadZonePx) {
        return { vector: new Vector2(), rawLength, pullLength: 0, rawStrength: 0, strength: 0, active: false };
    }
    const pullLength = Math.min(rawLength, config.maxPullPx);
    const rawStrength = (pullLength - config.deadZonePx) / (config.maxPullPx - config.deadZonePx);
    const strength = 1 - (1 - rawStrength) ** 2;
    return { vector: raw.normalize(), rawLength, pullLength, rawStrength, strength, active: true };
}

export function reflectDirection(direction, normal) {
    if (!finitePoint(direction) || !finitePoint(normal) || Math.hypot(normal.x, normal.y) === 0) return new Vector2();
    const unitNormal = new Vector2(normal.x, normal.y).normalize();
    return new Vector2(direction.x, direction.y).subtract(
        unitNormal.scale(2 * (direction.x * unitNormal.x + direction.y * unitNormal.y))
    );
}

export function isShieldFront(shieldForward, targetToContact) {
    return (
        finitePoint(shieldForward) &&
        finitePoint(targetToContact) &&
        Math.hypot(shieldForward.x, shieldForward.y) > 0 &&
        shieldForward.x * targetToContact.x + shieldForward.y * targetToContact.y >= 0
    );
}

export function getRicochetDamageMultiplier(bounceCount) {
    if (bounceCount >= 3) return DRAG_COMBAT_CONFIG.shield.ricochetThreeOrMoreMultiplier;
    if (bounceCount === 2) return DRAG_COMBAT_CONFIG.shield.ricochetTwoMultiplier;
    return DRAG_COMBAT_CONFIG.shield.ricochetOneMultiplier;
}
