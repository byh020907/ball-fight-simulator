const DISPLAY_HP_PRECISION = 1e-9;

function getFiniteHp(value, fallback = 0) {
    if (Number.isFinite(value)) return value;
    return Number.isFinite(fallback) ? fallback : 0;
}

/**
 * Returns a user-facing hunting HP value without changing the raw battle value.
 * A living ball with a fractional positive HP must never look defeated in the UI.
 */
export function getHuntingDisplayHp(value, fallback = 0) {
    const safeHp = Math.max(0, getFiniteHp(value, fallback));
    if (safeHp === 0) return 0;

    const nearestInteger = Math.round(safeHp);
    if (nearestInteger > 0 && Math.abs(safeHp - nearestInteger) < DISPLAY_HP_PRECISION) {
        return nearestInteger;
    }
    return Math.ceil(safeHp);
}

export function getHuntingDisplayHealth(run) {
    const health = getHuntingRunHealth(run);
    const rawMaxHp = getFiniteHp(health.maxHp, health.hp);
    const rawHp = getFiniteHp(health.hp, rawMaxHp);
    const maxHp = getHuntingDisplayHp(rawMaxHp);
    return {
        hp: Math.min(maxHp, getHuntingDisplayHp(rawHp)),
        maxHp
    };
}
import { getHuntingRunHealth } from "./huntingState.js";
