import { getLevelRequirement } from "../experience/experienceConfig.js";
import { getCharacterExperienceSummary } from "../experience/experienceService.js";
import { applyTournamentReport, createTournamentReport } from "../collection/index.js";
import { createRoster } from "../roster.js";

const CHARACTER_IDS = new Set(createRoster().map((fighter) => fighter.id));
const MAX_DEBUG_REBIRTH_COUNT = 999;

function isKnownCharacter(characterId) {
    return CHARACTER_IDS.has(characterId);
}

function ensureExperience(profile) {
    profile.experience ||= { currentXp: 0, byCharacter: {} };
    profile.experience.byCharacter ||= {};
    return profile.experience;
}

function sumCharacterXp(byCharacter) {
    return Object.values(byCharacter).reduce((sum, record) => sum + Math.max(0, record?.currentXp ?? 0), 0);
}

function ensureRebirthState(profile, characterId) {
    profile.rebirth ||= { byCharacter: {} };
    profile.rebirth.byCharacter ||= {};
    const current = profile.rebirth.byCharacter[characterId] ?? {};
    const state = {
        rebirthCount: Math.max(0, Math.floor(current.rebirthCount ?? 0)),
        statBonuses: { ...(current.statBonuses ?? {}) },
        cardRanks: { ...(current.cardRanks ?? {}) },
        equippedCardIds: [...(current.equippedCardIds ?? [])],
        pendingOfferCards: [...(current.pendingOfferCards ?? [])]
    };
    profile.rebirth.byCharacter[characterId] = state;
    return state;
}

export function setDeveloperCharacterToMaxLevel(profile, characterId) {
    if (!profile || !isKnownCharacter(characterId)) return { ok: false, error: "unknown_character" };
    const experience = ensureExperience(profile);
    experience.byCharacter[characterId] = { currentXp: getLevelRequirement(10) };
    experience.currentXp = sumCharacterXp(experience.byCharacter);
    return { ok: true, experience: getCharacterExperienceSummary(profile, characterId) };
}

export function setDeveloperRebirthCount(profile, characterId, rebirthCount) {
    if (!profile || !isKnownCharacter(characterId)) return { ok: false, error: "unknown_character" };
    const state = ensureRebirthState(profile, characterId);
    state.rebirthCount = Math.max(0, Math.min(MAX_DEBUG_REBIRTH_COUNT, Math.floor(Number(rebirthCount) || 0)));
    return { ok: true, rebirthCount: state.rebirthCount };
}

export function recordDeveloperTournamentWin(profile, characterId) {
    if (!profile || !isKnownCharacter(characterId)) return { ok: false, error: "unknown_character" };
    if (!profile.collection?.characters || !profile.collection?.careerStats) {
        return { ok: false, error: "invalid_profile" };
    }

    const report = createTournamentReport();
    report.playerFighterId = characterId;
    report.playerWon = true;
    report.placement = 1;
    const result = applyTournamentReport(profile, report);
    if (result.alreadyProcessed) return { ok: false, error: "duplicate_report" };

    return {
        ok: true,
        record: profile.collection.characters[characterId],
        report
    };
}
