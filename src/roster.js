import { CHARACTER_DEFINITIONS } from "./characters/characterRegistry.js";
import { BASE_SPEED_MULTIPLIER } from "./characters/definitions/definitionFactory.js";

export { BASE_SPEED_MULTIPLIER };

export function createRoster() {
    return CHARACTER_DEFINITIONS.map((definition) => ({
        ...definition.roster,
        stats: { ...definition.roster.stats }
    }));
}
