import { isCharacterUnlocked } from "./playerProfile.js";
import { canUnlockFromEncounter } from "./characterAvailability.js";

export const CHARACTER_ROSTER_CONTEXTS = Object.freeze({
    PLAYABLE: "playable",
    TOURNAMENT: "tournament",
    HUNTING_CHAMPION: "huntingChampion",
    HUNTING_FINAL_BOSS: "huntingFinalBoss",
    COLLECTION: "collection"
});

export function isFighterEligible(profile, fighter, context = CHARACTER_ROSTER_CONTEXTS.PLAYABLE) {
    if (isCharacterUnlocked(profile, fighter.id)) return true;
    return context === CHARACTER_ROSTER_CONTEXTS.HUNTING_CHAMPION && canUnlockFromEncounter(fighter.id, "champion");
}

export function getEligibleRoster(profile, roster, context = CHARACTER_ROSTER_CONTEXTS.PLAYABLE) {
    return roster.filter((fighter) => isFighterEligible(profile, fighter, context));
}

export function getPublicFighterIdentity(profile, fighter) {
    if (isCharacterUnlocked(profile, fighter.id)) {
        return { ...fighter, hiddenIdentity: false, sourceFighterId: fighter.id };
    }
    return {
        ...fighter,
        name: "???",
        title: "???",
        description: "사냥터의 정체불명 챔피언을 격파하면 해금됩니다",
        color: "#777777",
        face: "hidden",
        hiddenIdentity: true,
        sourceFighterId: fighter.id
    };
}

export function getEncounterFighterIdentity(profile, fighter) {
    if (isCharacterUnlocked(profile, fighter.id))
        return { ...fighter, hiddenIdentity: false, sourceFighterId: fighter.id };
    return {
        ...fighter,
        name: "???",
        title: "???",
        description: "???",
        hiddenIdentity: true,
        sourceFighterId: fighter.id
    };
}
