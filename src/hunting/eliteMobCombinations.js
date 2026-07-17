const DEFINITIONS = [
    ["elite-10-pursuer-charger-shooter", 10, ["pursuer", "charger", "shooter"]],
    ["elite-20-barrier-pursuer-healer-shooter", 20, ["barrier", "pursuer", "healer", "shooter"]],
    ["elite-40-barrier-chain-healer-shard", 40, ["barrier", "chain", "healer", "shard"]],
    ["elite-80-barrier-chain-healer-boomerang-laser", 80, ["barrier", "chain", "healer", "boomerang", "laser"]],
    ["elite-20-healer-healer-healer-electric", 20, ["healer", "healer", "healer", "electric"]],
    ["elite-20-barrier-barrier-barrier-healer-healer", 20, ["barrier", "barrier", "barrier", "healer", "healer"]],
    ["elite-40-splitter-splitter-splitter-healer-healer", 40, ["splitter", "splitter", "splitter", "healer", "healer"]]
];

export const ELITE_MOB_COMBINATIONS = Object.freeze(
    DEFINITIONS.map(([id, minimumFloor, monsterTypes]) =>
        Object.freeze({ id, minimumFloor, monsterTypes: Object.freeze(monsterTypes), size: monsterTypes.length })
    )
);

export function getEliteMobCombination(combinationId) {
    return ELITE_MOB_COMBINATIONS.find((combination) => combination.id === combinationId) ?? null;
}

export function getEligibleEliteMobCombinations(floor = 1) {
    return ELITE_MOB_COMBINATIONS.filter((combination) => combination.minimumFloor <= floor);
}

export function pickEliteMobCombination(floor = 1, rng = Math.random) {
    const candidates = getEligibleEliteMobCombinations(floor);
    const index = Math.floor(Math.max(0, Math.min(0.999999, rng())) * candidates.length);
    return candidates[index] ?? null;
}
