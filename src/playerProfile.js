// ── 플레이어 프로필 저장/복원 ───────────────────────────────────────────────
//
// localStorage 키: bfs:player-profile:v1
// 이 모듈만 localStorage에 직접 접근합니다.
// 다른 모듈은 loadPlayerProfile() / savePlayerProfile()을 호출합니다.
// ─────────────────────────────────────────────────────────────────────────────

import { HUNTING_STAGES } from "./hunting/huntingConfig.js";
import { createDefaultHuntingStats, sanitizeHuntingStats } from "./hunting/huntingAchievementProgress.js";
import { FIGHTER_IDS } from "./characters/characterRegistry.js";
import { getHiddenCharacterIds } from "./characterAvailability.js";
import { createDefaultEquipmentInventory, sanitizeEquipmentInventory } from "./hunting/equipmentInventory.js";
import {
    REBIRTH_BASE_STAT_KEYS,
    isValidRebirthCardId,
    normalizeRebirthOfferMaterial,
    REBIRTH_MAX_CARD_RANK,
    REBIRTH_OFFER_SIZE
} from "./rebirth/rebirthCards.js";
import { createDefaultRebirthArea, migrateRebirthArea, REBIRTH_SCHEMA_VERSION } from "./rebirth/rebirthMigrations.js";

export const PLAYER_PROFILE_STORAGE_KEY = "bfs:player-profile:v1";
export const SESSION_STORAGE_VERSION_KEY = "bfs:session-version";

export const PROFILE_LIMITS = Object.freeze({
    MAX_COUNTER: 1_000_000_000,
    MAX_TIMESTAMP: 8_640_000_000_000_000
});

export const PROFILE_VERSION = 12;

const debugProfileSession = {
    active: false,
    profile: null,
    persistentProfile: null
};

export function resetStaleSessionStorage(storage = globalThis.sessionStorage) {
    if (!storage || storage.getItem(SESSION_STORAGE_VERSION_KEY) === String(PROFILE_VERSION)) return false;

    for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith("bfs:")) storage.removeItem(key);
    }
    storage.setItem(SESSION_STORAGE_VERSION_KEY, String(PROFILE_VERSION));
    return true;
}

function cloneSanitizedProfile(profile) {
    return sanitizePlayerProfile(profile);
}

function replaceProfileContents(target, source) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, source);
    return target;
}

export function isDebugProfileSessionActive() {
    return debugProfileSession.active;
}

export function beginDebugProfileSession(profile) {
    if (debugProfileSession.active && debugProfileSession.profile) return debugProfileSession.profile;
    debugProfileSession.persistentProfile = cloneSanitizedProfile(profile);
    debugProfileSession.profile = cloneSanitizedProfile(debugProfileSession.persistentProfile);
    debugProfileSession.active = true;
    return debugProfileSession.profile;
}

export function endDebugProfileSession() {
    const persistentProfile = debugProfileSession.persistentProfile
        ? cloneSanitizedProfile(debugProfileSession.persistentProfile)
        : createDefaultPlayerProfile();
    debugProfileSession.active = false;
    debugProfileSession.profile = null;
    debugProfileSession.persistentProfile = null;
    return persistentProfile;
}

// ── 기본 프로필 ─────────────────────────────────────────────────────────────

export function createDefaultPlayerProfile() {
    return {
        version: PROFILE_VERSION,
        unlockedCharacterIds: [],
        characterMastery: {
            levels: {}
        },
        tournamentChallenge: {
            levels: {}
        },
        experience: {
            currentXp: 0,
            byCharacter: {}
        },
        equipment: {
            ...createDefaultEquipmentInventory()
        },
        hunting: {
            shards: 0,
            blueprints: {},
            unlockedStageIds: ["cave"],
            selectedStageId: "cave",
            lastCompanionIds: [],
            dailyShop: {},
            stats: createDefaultHuntingStats(),
            unlockedCharacterIds: []
        },
        collection: {
            characters: {},
            achievements: {},
            careerStats: {
                playerMatchesCompleted: 0,
                playerTournamentsCompleted: 0,
                currentTournamentWinStreak: 0,
                bestTournamentWinStreak: 0,
                usedActionIds: [],
                actionSuccessCounts: {},
                processedTournamentReportIds: []
            }
        },
        rebirth: createDefaultRebirthArea()
    };
}

// ── ID 레지스트리 ────────────────────────────────────────────────────────────
// 실제 해금만 유효한 ID로 처리 (화이트리스트)

export const VALID_CHARACTER_IDS = Object.freeze(Object.values(FIGHTER_IDS));
export const HIDDEN_CHARACTER_IDS = Object.freeze(getHiddenCharacterIds());

export const MASTERY_EFFECT_IDS = Object.freeze(VALID_CHARACTER_IDS);

function sanitizeUnlockedCharacterIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value)].filter((id) => HIDDEN_CHARACTER_IDS.includes(id));
}

export function isCharacterUnlocked(profile, characterId) {
    return !HIDDEN_CHARACTER_IDS.includes(characterId) || Boolean(profile?.unlockedCharacterIds?.includes(characterId));
}

export function unlockHiddenCharacter(profile, characterId) {
    if (!HIDDEN_CHARACTER_IDS.includes(characterId)) return false;
    const ids = sanitizeUnlockedCharacterIds(profile.unlockedCharacterIds);
    if (ids.includes(characterId)) return false;
    profile.unlockedCharacterIds = [...ids, characterId];
    return true;
}

// ── 보정 ────────────────────────────────────────────────────────────────────

function sanitizeNumber(value, fallback = 0) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
    return Math.min(value, PROFILE_LIMITS.MAX_COUNTER);
}

function sanitizeTimestamp(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
    if (value > PROFILE_LIMITS.MAX_TIMESTAMP) return null;
    return value;
}

function sanitizeCharacterRecord(record) {
    if (!record || typeof record !== "object") return null;
    return {
        tournamentsCompleted: sanitizeNumber(record.tournamentsCompleted),
        tournamentWins: sanitizeNumber(record.tournamentWins),
        matchWins: sanitizeNumber(record.matchWins),
        bestPlacement: [1, 2, 3, 5].includes(record.bestPlacement) ? record.bestPlacement : null,
        totalDamageDealt: sanitizeNumber(record.totalDamageDealt),
        comebackMatchWins: sanitizeNumber(record.comebackMatchWins),
        firstTournamentAt: sanitizeTimestamp(record.firstTournamentAt),
        lastTournamentAt: sanitizeTimestamp(record.lastTournamentAt)
    };
}

function sanitizeCharacters(obj) {
    if (!obj || typeof obj !== "object") return {};
    const result = {};
    for (const id of VALID_CHARACTER_IDS) {
        const record = obj[id];
        if (record) {
            const cleaned = sanitizeCharacterRecord(record);
            if (cleaned) result[id] = cleaned;
        }
    }
    return result;
}

function sanitizeAchievements(obj) {
    if (!obj || typeof obj !== "object") return {};
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === "object") {
            result[key] = {
                unlockedAt: sanitizeTimestamp(value.unlockedAt)
            };
        }
    }
    return result;
}

function sanitizeCharacterExperienceMap(obj) {
    if (!obj || typeof obj !== "object") return {};
    const result = {};
    for (const id of VALID_CHARACTER_IDS) {
        const record = obj[id];
        if (!record || typeof record !== "object") continue;
        const currentXp = sanitizeNumber(record.currentXp ?? record.totalXp);
        if (currentXp > 0) {
            result[id] = { currentXp };
        }
    }
    return result;
}

function sanitizeHuntingBlueprints(obj) {
    if (!obj || typeof obj !== "object") return {};
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([key]) => typeof key === "string" && key.length > 0)
            .map(([key, value]) => [
                key,
                {
                    discovered: Boolean(value?.discovered),
                    unlocked: Boolean(value?.unlocked)
                }
            ])
    );
}

function sanitizeHuntingStageIds(value) {
    const validIds = HUNTING_STAGES.map((stage) => stage.id);
    const ids = Array.isArray(value) ? value.filter((id) => validIds.includes(id)) : [];
    return ids.length > 0 ? [...new Set(ids)] : [validIds[0]];
}

function sanitizeHuntingUnlockedCharacterIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value)].filter((id) => VALID_CHARACTER_IDS.includes(id));
}

function sanitizeHuntingCompanionIds(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .filter((characterId) => VALID_CHARACTER_IDS.includes(characterId))
        .filter((characterId) => {
            if (seen.has(characterId)) return false;
            seen.add(characterId);
            return true;
        })
        .slice(0, 2);
}

function sanitizeHunting(obj) {
    const defaults = createDefaultPlayerProfile().hunting;
    if (!obj || typeof obj !== "object") return defaults;
    const unlockedStageIds = sanitizeHuntingStageIds(obj.unlockedStageIds);
    const selectedStageId = unlockedStageIds.includes(obj.selectedStageId)
        ? obj.selectedStageId
        : unlockedStageIds[unlockedStageIds.length - 1];
    return {
        shards: sanitizeNumber(obj.shards),
        blueprints: sanitizeHuntingBlueprints(obj.blueprints),
        unlockedStageIds,
        selectedStageId,
        lastCompanionIds: sanitizeHuntingCompanionIds(obj.lastCompanionIds),
        dailyShop: typeof obj.dailyShop === "object" && obj.dailyShop ? obj.dailyShop : {},
        stats: sanitizeHuntingStats(obj.stats),
        unlockedCharacterIds: sanitizeHuntingUnlockedCharacterIds(obj.unlockedCharacterIds)
    };
}

function sumCharacterExperience(byCharacter) {
    return Object.values(byCharacter).reduce((sum, record) => sum + sanitizeNumber(record?.currentXp), 0);
}

function sanitizeExperience(obj) {
    if (!obj || typeof obj !== "object") return { currentXp: 0, byCharacter: {} };
    const byCharacter = sanitizeCharacterExperienceMap(obj.byCharacter ?? obj.characters);
    const characterTotal = sumCharacterExperience(byCharacter);
    return {
        currentXp: characterTotal || sanitizeNumber(obj.currentXp ?? obj.totalXp),
        byCharacter
    };
}

function sanitizeCareerStats(obj) {
    if (!obj || typeof obj !== "object") {
        return createDefaultPlayerProfile().collection.careerStats;
    }
    return {
        playerMatchesCompleted: sanitizeNumber(obj.playerMatchesCompleted),
        playerTournamentsCompleted: sanitizeNumber(obj.playerTournamentsCompleted),
        currentTournamentWinStreak: sanitizeNumber(obj.currentTournamentWinStreak),
        bestTournamentWinStreak: Math.max(
            sanitizeNumber(obj.currentTournamentWinStreak),
            sanitizeNumber(obj.bestTournamentWinStreak)
        ),
        usedActionIds: Array.isArray(obj.usedActionIds)
            ? [...new Set(obj.usedActionIds.filter((id) => typeof id === "string" && id.length > 0))]
            : [],
        actionSuccessCounts:
            obj.actionSuccessCounts && typeof obj.actionSuccessCounts === "object"
                ? Object.fromEntries(Object.entries(obj.actionSuccessCounts).map(([k, v]) => [k, sanitizeNumber(v)]))
                : {},
        processedTournamentReportIds: Array.isArray(obj.processedTournamentReportIds)
            ? obj.processedTournamentReportIds.filter((id) => typeof id === "string" && id.length > 0).slice(-64)
            : []
    };
}

function sanitizeCharacterMastery(obj) {
    if (!obj || typeof obj !== "object") return { levels: {} };
    // v1 → v2: unlockedIds → levels
    if (Array.isArray(obj.unlockedIds)) {
        const levels = {};
        for (const id of obj.unlockedIds) {
            if (MASTERY_EFFECT_IDS.includes(id)) levels[id] = 1;
        }
        return { levels };
    }
    // v2: levels 객체
    const rawLevels = obj.levels;
    if (!rawLevels || typeof rawLevels !== "object") return { levels: {} };
    const levels = {};
    for (const id of MASTERY_EFFECT_IDS) {
        const val = rawLevels[id];
        if (val !== undefined && typeof val === "number" && Number.isFinite(val)) {
            levels[id] = Math.max(0, Math.min(3, Math.floor(val)));
        }
    }
    return { levels };
}

function sanitizeTournamentChallenge(obj) {
    if (!obj || typeof obj !== "object" || !obj.levels || typeof obj.levels !== "object") {
        return { levels: {} };
    }
    const levels = {};
    for (const id of VALID_CHARACTER_IDS) {
        const value = obj.levels[id];
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        const level = Math.max(0, Math.min(3, Math.floor(value)));
        if (level > 0) levels[id] = level;
    }
    return { levels };
}

function sanitizeEquipment(obj) {
    return sanitizeEquipmentInventory(obj);
}

function sanitizeRebirthCharacterState(characterId, value) {
    if (!value || typeof value !== "object") return null;
    const statBonuses = Object.fromEntries(
        REBIRTH_BASE_STAT_KEYS.map((stat) => [stat, sanitizeNumber(value.statBonuses?.[stat])])
    );
    const cardRanks = Object.fromEntries(
        Object.entries(value.cardRanks ?? {})
            .filter(([cardId]) => isValidRebirthCardId(characterId, cardId))
            .map(([cardId, rank]) => [
                cardId,
                Math.max(0, Math.min(REBIRTH_MAX_CARD_RANK, Math.floor(sanitizeNumber(rank))))
            ])
            .filter(([, rank]) => rank > 0)
    );
    const equippedCardIds = [...new Set(value.equippedCardIds ?? [])]
        .filter((cardId) => cardRanks[cardId] > 0)
        .slice(0, Object.keys(cardRanks).length);
    const pendingOfferCards = (Array.isArray(value.pendingOfferCards) ? value.pendingOfferCards : [])
        .map((card) => normalizeRebirthOfferMaterial(characterId, card))
        .filter(Boolean)
        .filter((card, index, cards) => cards.findIndex((candidate) => candidate.id === card.id) === index)
        .slice(0, REBIRTH_OFFER_SIZE);
    return {
        rebirthCount: Math.floor(sanitizeNumber(value.rebirthCount)),
        statBonuses,
        cardRanks,
        equippedCardIds,
        pendingOfferCards,
        pendingOfferNeedsRegeneration: Boolean(value.pendingOfferNeedsRegeneration)
    };
}

function sanitizeRebirth(obj) {
    const migrated = migrateRebirthArea(obj);
    if (!migrated || typeof migrated !== "object") return createDefaultRebirthArea();
    const byCharacter = {};
    for (const characterId of VALID_CHARACTER_IDS) {
        const state = sanitizeRebirthCharacterState(characterId, migrated.byCharacter?.[characterId]);
        if (state) byCharacter[characterId] = state;
    }
    return { schemaVersion: REBIRTH_SCHEMA_VERSION, byCharacter };
}

export function sanitizePlayerProfile(raw) {
    if (!raw || typeof raw !== "object") return createDefaultPlayerProfile();
    return {
        version: PROFILE_VERSION,
        unlockedCharacterIds: sanitizeUnlockedCharacterIds(raw.unlockedCharacterIds),
        characterMastery: sanitizeCharacterMastery(raw.characterMastery ?? raw.characterLinks),
        tournamentChallenge: sanitizeTournamentChallenge(raw.tournamentChallenge),
        experience: sanitizeExperience(raw.experience),
        equipment: sanitizeEquipment(raw.equipment),
        hunting: sanitizeHunting(raw.hunting),
        collection: {
            characters: sanitizeCharacters(raw.collection?.characters),
            achievements: sanitizeAchievements(raw.collection?.achievements),
            careerStats: sanitizeCareerStats(raw.collection?.careerStats)
        },
        rebirth: sanitizeRebirth(raw.rebirth)
    };
}

// ── 마이그레이션 ─────────────────────────────────────────────────────────────

export function migratePlayerProfile(raw) {
    if (!raw || typeof raw !== "object") return createDefaultPlayerProfile();
    if (raw.version !== PROFILE_VERSION) return createDefaultPlayerProfile();
    return sanitizePlayerProfile(raw);
}

export function migrateLegacyExperienceToCharacter(profile, preferredCharacterId) {
    const legacyXp = sanitizeNumber(profile?.experience?.currentXp);
    const byCharacter = profile?.experience?.byCharacter ?? {};
    if (legacyXp <= 0 || Object.keys(byCharacter).length > 0) {
        return null;
    }

    const records = profile?.collection?.characters ?? {};
    const inferred = VALID_CHARACTER_IDS.map((id) => ({ id, record: records[id] }))
        .filter(({ record }) => record && typeof record === "object")
        .sort((a, b) => {
            const bRecent = b.record.lastTournamentAt ?? b.record.firstTournamentAt ?? 0;
            const aRecent = a.record.lastTournamentAt ?? a.record.firstTournamentAt ?? 0;
            if (bRecent !== aRecent) return bRecent - aRecent;
            const bPlayed = (b.record.tournamentsCompleted ?? 0) + (b.record.matchWins ?? 0);
            const aPlayed = (a.record.tournamentsCompleted ?? 0) + (a.record.matchWins ?? 0);
            if (bPlayed !== aPlayed) return bPlayed - aPlayed;
            return (b.record.totalDamageDealt ?? 0) - (a.record.totalDamageDealt ?? 0);
        })[0]?.id;
    const fallback = VALID_CHARACTER_IDS.includes(preferredCharacterId) ? preferredCharacterId : VALID_CHARACTER_IDS[0];
    const characterId = inferred ?? fallback;

    profile.experience = {
        currentXp: legacyXp,
        byCharacter: {
            [characterId]: { currentXp: legacyXp }
        }
    };
    return characterId;
}

// ── 저장/로드 ────────────────────────────────────────────────────────────────

export function loadPlayerProfile() {
    if (debugProfileSession.active && debugProfileSession.profile) return debugProfileSession.profile;
    try {
        resetStaleSessionStorage();
        const raw = localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
        if (!raw) return createDefaultPlayerProfile();
        const parsed = JSON.parse(raw);
        const profile = migratePlayerProfile(parsed);
        if (parsed.version !== PROFILE_VERSION) savePlayerProfile(profile);
        return profile;
    } catch {
        // 파싱 실패, 접근 거부 등 → 기본 프로필로 복구
        return createDefaultPlayerProfile();
    }
}

export function savePlayerProfile(profile) {
    try {
        const cleaned = sanitizePlayerProfile(profile);
        if (debugProfileSession.active) {
            const sessionProfile = debugProfileSession.profile ?? profile;
            debugProfileSession.profile = replaceProfileContents(sessionProfile, cleaned);
            return true;
        }
        localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(cleaned));
        return true;
    } catch {
        // QuotaExceededError, 접근 거부 등 → 저장 실패, 메모리 상태 유지
        return false;
    }
}

// ── 내보내기/가져오기 ─────────────────────────────────────────────────────────

export function exportPlayerProfile(profile) {
    return JSON.stringify(sanitizePlayerProfile(profile), null, 2);
}

export function importPlayerProfile(text) {
    try {
        const parsed = JSON.parse(text);
        return migratePlayerProfile(parsed);
    } catch {
        return null;
    }
}

// ── 캐릭터 기록 조회/갱신 ────────────────────────────────────────────────────

export function getCharacterRecord(profile, characterId) {
    if (!profile.collection.characters[characterId]) {
        profile.collection.characters[characterId] = createDefaultCharacterRecord();
    }
    return profile.collection.characters[characterId];
}

function createDefaultCharacterRecord() {
    return {
        tournamentsCompleted: 0,
        tournamentWins: 0,
        matchWins: 0,
        bestPlacement: null,
        totalDamageDealt: 0,
        comebackMatchWins: 0,
        firstTournamentAt: null,
        lastTournamentAt: null
    };
}

export function ensureCharacterRecords(profile) {
    for (const id of VALID_CHARACTER_IDS) {
        if (!profile.collection.characters[id]) {
            profile.collection.characters[id] = createDefaultCharacterRecord();
        }
    }
}

// ── 연계 해금 ────────────────────────────────────────────────────────────────

export function unlockCharacterMastery(profile, characterId) {
    // v2: 레거시 호환용 — advanceCharacterMastery 사용 권장
    return false;
}
