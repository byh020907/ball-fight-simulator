import { getCharacterDefinitionByAbility } from "../characters/characterRegistry.js";

const NON_CHARACTER_ABILITY_NAMES = Object.freeze({
    none: "Passive",
    hunting_melee: "Melee",
    hunting_mob: "Hunting Mob"
});

export function getAbilityDisplayName(abilityId) {
    return (
        getCharacterDefinitionByAbility(abilityId)?.abilityDisplayName ??
        NON_CHARACTER_ABILITY_NAMES[abilityId] ??
        abilityId
    );
}
