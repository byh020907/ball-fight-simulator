import { getLevelRequirement } from "../experience/experienceConfig.js";
import { getCharacterExperienceSummary } from "../experience/experienceService.js";
import { applyTournamentReport, createTournamentReport } from "../collection/index.js";
import { createHuntingChest } from "../hunting/huntingRewards.js";
import { createEquipmentInstance, equipEquipmentItem } from "../hunting/equipmentConfig.js";
import { CHARACTER_DEFINITIONS } from "../characters/characterRegistry.js";
import { isHiddenCharacterId } from "../characterAvailability.js";
import { isCharacterUnlocked, unlockHiddenCharacter } from "../playerProfile.js";

const CHARACTER_IDS = new Set(CHARACTER_DEFINITIONS.map((definition) => definition.id));
const MAX_DEBUG_REBIRTH_COUNT = 999;
const DEBUG_COLLECTION_SAMPLE_ITEMS = Object.freeze([
    { rarity: "common", slot: "weapon" },
    { rarity: "common", slot: "weapon" },
    { rarity: "common", slot: "weapon" },
    { rarity: "rare", slot: "armor" },
    { rarity: "epic", slot: "accessory" },
    { rarity: "legendary", slot: "accessory" }
]);
const DEBUG_COLLECTION_SAMPLE_CHESTS = Object.freeze(["common", "rare", "epic"]);
const DEBUG_COLLECTION_SAMPLE_SHARDS = 800;
const DEBUG_COLLECTION_SAMPLE_STONES = 99;
const DEBUG_COLLECTION_SAMPLE_INVENTORY_SLOTS = 12;

function createDebugSampleRng(seed) {
    let state = seed;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function ensureCollectionStorage(profile) {
    if (!profile?.hunting || !profile?.equipment) return null;
    profile.hunting.chests ||= [];
    profile.equipment.inventory ||= [];
    profile.equipment.equipped ||= { weapon: null, armor: null, accessory1: null, accessory2: null };
    return { hunting: profile.hunting, equipment: profile.equipment };
}

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

export function setDeveloperHiddenCharacterUnlocked(profile, characterId, unlocked) {
    if (!profile || !isHiddenCharacterId(characterId)) return { ok: false, error: "not_hidden_character" };
    profile.unlockedCharacterIds ||= [];
    if (unlocked) unlockHiddenCharacter(profile, characterId);
    else profile.unlockedCharacterIds = profile.unlockedCharacterIds.filter((id) => id !== characterId);
    return { ok: true, unlocked: isCharacterUnlocked(profile, characterId) };
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

export function seedDeveloperCollectionSample(profile, characterId) {
    if (!profile) return { ok: false, error: "invalid_profile" };
    if (!isKnownCharacter(characterId)) return { ok: false, error: "unknown_character" };
    const storage = ensureCollectionStorage(profile);
    if (!storage) return { ok: false, error: "invalid_profile" };

    const items = DEBUG_COLLECTION_SAMPLE_ITEMS.map((definition, index) =>
        createEquipmentInstance({ ...definition, rng: createDebugSampleRng(index + 1) })
    );
    const chests = DEBUG_COLLECTION_SAMPLE_CHESTS.map((rarity, index) =>
        createHuntingChest({ rarity, id: `debug-collection-${rarity}-${index}` })
    );
    storage.hunting.shards = DEBUG_COLLECTION_SAMPLE_SHARDS;
    storage.hunting.chests = chests;
    storage.equipment.inventory = items;
    storage.equipment.equipped = {
        weapon: null,
        armor: null,
        accessory1: null,
        accessory2: null
    };
    storage.equipment.enhancementStones = DEBUG_COLLECTION_SAMPLE_STONES;
    storage.equipment.maxInventorySlots = DEBUG_COLLECTION_SAMPLE_INVENTORY_SLOTS;
    setDeveloperCharacterToMaxLevel(profile, characterId);
    const equippedResults = items.slice(3).map((item) => equipEquipmentItem(profile, item.instanceId, characterId));
    if (equippedResults.some((result) => !result?.item)) return { ok: false, error: "equip_failed" };

    return {
        ok: true,
        characterId,
        itemCount: items.length,
        chestCount: chests.length,
        shards: storage.hunting.shards,
        enhancementStones: storage.equipment.enhancementStones
    };
}
