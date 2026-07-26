const DEFINITIONS = [
    ["elite-5-pursuer-charger-shooter", 5, ["pursuer", "charger", "shooter"]],
    ["elite-10-barrier-pursuer-healer-shooter", 10, ["barrier", "pursuer", "healer", "shooter"]],
    ["elite-20-barrier-chain-healer-shard", 20, ["barrier", "chain", "healer", "shard"]],
    ["elite-40-barrier-chain-healer-boomerang-laser", 40, ["barrier", "chain", "healer", "boomerang", "laser"]],
    ["elite-10-healer-healer-healer-electric", 10, ["healer", "healer", "healer", "electric"]],
    ["elite-10-barrier-barrier-barrier-healer-healer", 10, ["barrier", "barrier", "barrier", "healer", "healer"]],
    ["elite-20-splitter-splitter-splitter-healer-healer", 20, ["splitter", "splitter", "splitter", "healer", "healer"]]
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
