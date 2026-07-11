export function safeFloor(floor) {
    return Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
}

export function rollIndex(length, rng) {
    return Math.floor(Math.max(0, Math.min(0.999999, rng())) * length);
}
