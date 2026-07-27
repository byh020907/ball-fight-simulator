export function createTournamentRoster(roster, playerId, rng = Math.random, size = 8) {
    const playerSpec = roster.find((fighter) => fighter.id === playerId);
    if (!playerSpec) return [];

    const others = roster.filter((fighter) => fighter.id !== playerId);
    const shuffledOthers = [...others];
    for (let index = shuffledOthers.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(rng() * (index + 1));
        [shuffledOthers[index], shuffledOthers[swapIndex]] = [shuffledOthers[swapIndex], shuffledOthers[index]];
    }
    const selectedOthers = roster.length <= size ? shuffledOthers : shuffledOthers.slice(0, size - 1);

    return [{ ...playerSpec, isPlayer: true }, ...selectedOthers.map((fighter) => ({ ...fighter, isPlayer: false }))];
}
