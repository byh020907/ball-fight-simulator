import { DRAG_COMBAT_CONFIG } from "./config.js";

const MIN_ENEMY_CHARGE_RATIO = 0.35;
const ENEMY_ACCELERATION_SECONDS = 0.22;

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export function getChargeRatio(heldDuration, maxAimSeconds = DRAG_COMBAT_CONFIG.input.maxAimSeconds) {
    const duration = Number.isFinite(heldDuration) ? Math.max(0, heldDuration) : 0;
    const maximum = Number.isFinite(maxAimSeconds) && maxAimSeconds > 0 ? maxAimSeconds : 1;
    return Math.min(1, duration / maximum);
}

export function getEnemyRequiredChargeRatio(distanceToTarget, lateralSpeed, targetBaseSpeed) {
    const distanceRatio = clamp((Number(distanceToTarget) || 0) / 600, 0, 1);
    const lateralRatio = clamp(Math.abs(Number(lateralSpeed) || 0) / Math.max(1, Number(targetBaseSpeed) || 0), 0, 1);
    return clamp(distanceRatio + lateralRatio * 0.15, MIN_ENEMY_CHARGE_RATIO, 1);
}

export function getEnemyChargePlan({ now = 0, requiredChargeRatio = 0.35, maxAimSeconds = 1.2 } = {}) {
    const startTime = Number.isFinite(now) ? now : 0;
    const ratio = clamp(Number(requiredChargeRatio) || MIN_ENEMY_CHARGE_RATIO, MIN_ENEMY_CHARGE_RATIO, 1);
    const duration = Number.isFinite(maxAimSeconds) && maxAimSeconds > 0 ? maxAimSeconds : 1.2;
    return {
        startTime,
        initialRequiredChargeRatio: ratio,
        requiredChargeRatio: ratio,
        plannedEndAt: startTime + ratio * duration,
        accelerating: false,
        accelerationStartAt: null,
        accelerationStartProgress: null,
        displayProgress: 0,
        naturalRatio: 0
    };
}

export function advanceEnemyChargePlan(plan, { now = 0, requiredChargeRatio, maxAimSeconds = 1.2 } = {}) {
    if (!plan) return null;
    const time = Math.max(plan.startTime, Number.isFinite(now) ? now : plan.startTime);
    const naturalRatio = getChargeRatio(time - plan.startTime, maxAimSeconds);
    const requested = Math.min(
        plan.requiredChargeRatio,
        clamp(Number(requiredChargeRatio) || plan.requiredChargeRatio, MIN_ENEMY_CHARGE_RATIO, 1)
    );
    const remaining = plan.plannedEndAt - time;
    const mayAccelerate =
        !plan.accelerating &&
        requested < plan.initialRequiredChargeRatio &&
        naturalRatio >= requested &&
        remaining > ENEMY_ACCELERATION_SECONDS;
    const plannedEndAt = mayAccelerate
        ? Math.min(plan.plannedEndAt, time + ENEMY_ACCELERATION_SECONDS)
        : plan.plannedEndAt;
    const normalDuration = Math.max(0.001, plan.plannedEndAt - plan.startTime);
    const normalProgress = clamp((time - plan.startTime) / normalDuration, 0, 1);
    const accelerationStartAt = mayAccelerate ? time : plan.accelerationStartAt;
    const accelerationStartProgress = mayAccelerate
        ? Math.max(plan.displayProgress, normalProgress)
        : plan.accelerationStartProgress;
    const acceleratedProgress =
        accelerationStartAt === null
            ? normalProgress
            : accelerationStartProgress +
              (1 - accelerationStartProgress) *
                  clamp((time - accelerationStartAt) / Math.max(0.001, plannedEndAt - accelerationStartAt), 0, 1);
    return {
        ...plan,
        requiredChargeRatio: requested,
        plannedEndAt,
        accelerating: plan.accelerating || mayAccelerate,
        accelerationStartAt,
        accelerationStartProgress,
        displayProgress: Math.max(plan.displayProgress, acceleratedProgress),
        naturalRatio
    };
}
