import { Vector2 } from "./core.js";

export const COMBAT_CONTROL_CONFIG = Object.freeze({
    sharedLockSeconds: 0.12,
    resetAfterSeconds: 1.2,
    cooldownSteps: Object.freeze([0.3, 0.45, 0.65, 0.9]),
    pressureSpeedRatio: 1.1,
    retreatSpeedRatio: 1,
    headingDurationSeconds: 0.12
});

export function createCombatControlState() {
    return {
        sharedLockRemaining: 0,
        pressure: { cooldownRemaining: 0, step: 0, idleRemaining: 0 },
        retreat: { cooldownRemaining: 0, step: 0, idleRemaining: 0 }
    };
}

export function resetCombatControlState(state) {
    Object.assign(state, createCombatControlState());
    return state;
}

export function updateCombatControlState(state, delta, config = COMBAT_CONTROL_CONFIG) {
    const elapsed = Math.max(0, delta);
    state.sharedLockRemaining = Math.max(0, state.sharedLockRemaining - elapsed);
    for (const control of [state.pressure, state.retreat]) {
        control.cooldownRemaining = Math.max(0, control.cooldownRemaining - elapsed);
        if (control.idleRemaining > 0) {
            control.idleRemaining = Math.max(0, control.idleRemaining - elapsed);
            if (control.idleRemaining === 0) control.step = 0;
        }
    }
    return state;
}

function getEffectiveBaseSpeed(fighter, simulation) {
    const modifiers = fighter.getStatModifiers?.() ?? { speed: 1 };
    const slowMultiplier = fighter.state?.slow?.amount ?? 1;
    const simulationMultiplier = simulation.getSpeedMultiplier?.(fighter) ?? 1;
    return Math.max(0, fighter.stats.baseSpeed * (modifiers.speed ?? 1) * slowMultiplier * simulationMultiplier);
}

function canUse(fighter, simulation) {
    if (!fighter || !simulation || simulation.finished) return "unavailable";
    if (fighter.flags.defeated || fighter.flags.destroyed || fighter.state?.swallowed) return "inactive";
    if (fighter.participation?.canAct === false || fighter.state?.movement) return "movement_owned";
    return null;
}

export function useNearestEnemyCombatControl(state, type, fighter, simulation, config = COMBAT_CONTROL_CONFIG) {
    const key = type === "pressure" ? "pressure" : type === "retreat" ? "retreat" : null;
    if (!key) return { applied: false, reason: "unknown_control" };
    const unavailableReason = canUse(fighter, simulation);
    if (unavailableReason) return { applied: false, reason: unavailableReason };
    const control = state[key];
    if (state.sharedLockRemaining > 0) return { applied: false, reason: "shared_lock" };
    if (control.cooldownRemaining > 0) return { applied: false, reason: "cooldown" };

    const enemy = simulation.getNearestEnemy(fighter);
    if (!enemy) return { applied: false, reason: "no_target" };
    const direction = Vector2.subtract(enemy.position, fighter.position);
    if (direction.length() <= 0) return { applied: false, reason: "overlap" };

    direction.normalize();
    if (key === "retreat") direction.scale(-1);
    const baseSpeed = getEffectiveBaseSpeed(fighter, simulation);
    const targetSpeed = baseSpeed * (key === "pressure" ? config.pressureSpeedRatio : config.retreatSpeedRatio);
    const currentSpeed = fighter.velocity.length();
    const nextSpeed = Math.max(currentSpeed, targetSpeed);
    fighter.applyImpulse(direction.clone().scale(nextSpeed).subtract(fighter.velocity));
    fighter.forceHeading?.(direction, config.headingDurationSeconds);

    const cooldown = config.cooldownSteps[Math.min(control.step, config.cooldownSteps.length - 1)];
    control.cooldownRemaining = cooldown;
    control.step = Math.min(control.step + 1, config.cooldownSteps.length - 1);
    control.idleRemaining = config.resetAfterSeconds;
    state.sharedLockRemaining = config.sharedLockSeconds;
    return { applied: true, type: key, cooldown, direction, targetSpeed, speed: fighter.velocity.length() };
}
