export const ELEMENTAL_WET_STATUS_CONFIG = Object.freeze({
    maximumStacks: 3,
    defenseReductionRatioPerStack: 0.2,
    minimumDefenseReductionPerStack: 1
});

function getStackExpiries(target) {
    target.state ||= {};
    if (!Array.isArray(target.state.elementalWetStackExpiries)) target.state.elementalWetStackExpiries = [];
    return target.state.elementalWetStackExpiries;
}

export function pruneElementalWetStacks(target, elapsed) {
    if (!target) return [];
    const activeExpiries = getStackExpiries(target)
        .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > elapsed)
        .sort((left, right) => left - right);
    target.state.elementalWetStackExpiries = activeExpiries;
    target.state.elementalWetUntil = activeExpiries.at(-1) ?? 0;
    return activeExpiries;
}

export function addElementalWetStack(target, elapsed, duration) {
    if (!target) return 0;
    const activeExpiries = pruneElementalWetStacks(target, elapsed);
    const expiresAt = elapsed + Math.max(0, duration);
    if (activeExpiries.length >= ELEMENTAL_WET_STATUS_CONFIG.maximumStacks) activeExpiries.shift();
    activeExpiries.push(expiresAt);
    activeExpiries.sort((left, right) => left - right);
    target.state.elementalWetStackExpiries = activeExpiries;
    target.state.elementalWetUntil = activeExpiries.at(-1) ?? 0;
    return activeExpiries.length;
}

export function getActiveElementalWetStackCount(target, elapsed) {
    return pruneElementalWetStacks(target, elapsed).length;
}

export function getElementalWetDefenseReduction(target, totalDefense, elapsed) {
    const stackCount = getActiveElementalWetStackCount(target, elapsed);
    if (stackCount <= 0 || totalDefense <= 0) return 0;
    const reductionPerStack = Math.max(
        ELEMENTAL_WET_STATUS_CONFIG.minimumDefenseReductionPerStack,
        Math.round(totalDefense * ELEMENTAL_WET_STATUS_CONFIG.defenseReductionRatioPerStack)
    );
    return Math.min(totalDefense, reductionPerStack * stackCount);
}

export function clearElementalWetStacks(target) {
    if (!target) return;
    target.state ||= {};
    target.state.elementalWetStackExpiries = [];
    target.state.elementalWetUntil = 0;
}
