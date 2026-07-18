import { CHARACTER_DEFINITIONS, getCharacterDefinition } from "./characters/characterRegistry.js";

export const CHARACTER_UNLOCK_TYPES = Object.freeze({
    HUNTING_CHAMPION: "huntingChampion"
});

const DEFAULT_CHARACTER_ACCESS_POLICY = Object.freeze({
    unlockType: null,
    rebirthActionEligible: true
});

export function getCharacterAccessPolicy(characterId) {
    const definition = getCharacterDefinition(characterId);
    if (!definition) return DEFAULT_CHARACTER_ACCESS_POLICY;
    return Object.freeze({
        unlockType: definition.availability.unlockType,
        rebirthActionEligible: definition.rebirth.actionEligible
    });
}

export function getHiddenCharacterIds() {
    return CHARACTER_DEFINITIONS.filter((definition) => definition.availability.unlockType !== null).map(
        (definition) => definition.id
    );
}

export function isHiddenCharacterId(characterId) {
    return getCharacterAccessPolicy(characterId).unlockType !== null;
}

export function isRebirthActionEligible(characterId) {
    return getCharacterAccessPolicy(characterId).rebirthActionEligible !== false;
}

export function isRebirthActionAvailable(profile, characterId) {
    if (!isRebirthActionEligible(characterId)) return false;
    return !isHiddenCharacterId(characterId) || Boolean(profile?.unlockedCharacterIds?.includes(characterId));
}

export function canUnlockFromEncounter(characterId, encounterType) {
    const policy = getCharacterAccessPolicy(characterId);
    return policy.unlockType === CHARACTER_UNLOCK_TYPES.HUNTING_CHAMPION && encounterType === "champion";
}
