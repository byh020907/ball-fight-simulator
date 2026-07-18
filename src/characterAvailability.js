import { FIGHTER_IDS } from "./core.js";

export const CHARACTER_UNLOCK_TYPES = Object.freeze({
    HUNTING_CHAMPION: "huntingChampion"
});

export const CHARACTER_ACCESS_POLICIES = Object.freeze({
    [FIGHTER_IDS.ELEMENTALIST]: Object.freeze({
        unlockType: CHARACTER_UNLOCK_TYPES.HUNTING_CHAMPION,
        rebirthActionEligible: false
    })
});

const DEFAULT_CHARACTER_ACCESS_POLICY = Object.freeze({
    unlockType: null,
    rebirthActionEligible: true
});

export function getCharacterAccessPolicy(characterId) {
    return CHARACTER_ACCESS_POLICIES[characterId] ?? DEFAULT_CHARACTER_ACCESS_POLICY;
}

export function getHiddenCharacterIds() {
    return Object.keys(CHARACTER_ACCESS_POLICIES).filter(
        (characterId) => getCharacterAccessPolicy(characterId).unlockType !== null
    );
}

export function isHiddenCharacterId(characterId) {
    return getCharacterAccessPolicy(characterId).unlockType !== null;
}

export function isRebirthActionEligible(characterId) {
    return getCharacterAccessPolicy(characterId).rebirthActionEligible !== false;
}

export function canUnlockFromEncounter(characterId, encounterType) {
    const policy = getCharacterAccessPolicy(characterId);
    return policy.unlockType === CHARACTER_UNLOCK_TYPES.HUNTING_CHAMPION && encounterType === "champion";
}
