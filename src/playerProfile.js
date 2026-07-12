// ── 플레이어 프로필 저장/복원 ───────────────────────────────────────────────
//
// localStorage 키: bfs:player-profile:v1
// 이 모듈만 localStorage에 직접 접근합니다.
// 다른 모듈은 loadPlayerProfile() / savePlayerProfile()을 호출합니다.
// ─────────────────────────────────────────────────────────────────────────────

import { HUNTING_STAGES } from "./hunting/huntingConfig.js";

export const PLAYER_PROFILE_STORAGE_KEY = "bfs:player-profile:v1";
export const SESSION_STORAGE_VERSION_KEY = "bfs:session-version";

export const PROFILE_LIMITS = Object.freeze({
    MAX_COUNTER: 1_000_000_000,
    MAX_TIMESTAMP: 8_640_000_000_000_000
});

export const PROFILE_VERSION = 7;

export function resetStaleSessionStorage(storage = globalThis.sessionStorage) {
    if (!storage || storage.getItem(SESSION_STORAGE_VERSION_KEY) === String(PROFILE_VERSION)) return false;

    for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith("bfs:")) storage.removeItem(key);
    }
    storage.setItem(SESSION_STORAGE_VERSION_KEY, String(PROFILE_VERSION));
    return true;
}

// ── 기본 프로필 ─────────────────────────────────────────────────────────────

export function createDefaultPlayerProfile() {
    return {
        version: PROFILE_VERSION,
        characterMastery: {
            levels: {}
        },
        experience: {
            currentXp: 0,
            byCharacter: {}
        },
        equipment: {
            inventory: [],
            equipped: { weapon: null, armor: null, accessory1: null, accessory2: null },
            enhancementStones: 0,
            maxInventorySlots: 5
        },
        hunting: {
            shards: 0,
            chests: [],
            blueprints: {},
            unlockedStageIds: ["cave"],
            selectedStageId: "cave",
            stats: {
                runsStarted: 0,
                runsRetreated: 0,
                runsDefeated: 0,
                deepestFloor: 0
            }
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
        }
    };
}

// ── ID 레지스트리 ────────────────────────────────────────────────────────────
// 실제 해금만 유효한 ID로 처리 (화이트리스트)

export const VALID_CHARACTER_IDS = Object.freeze([
    "archer",
    "orbit",
    "trickster",
    "grenade",
    "dash",
    "rage",
    "eater",
    "bat_ball",
    "hero",
    "vampire",
    "gunner",
    "phantom"
]);

export const MASTERY_EFFECT_IDS = Object.freeze(VALID_CHARACTER_IDS);

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

function sanitizeGuaranteedEquipment(item) {
    if (!item || typeof item !== "object" || typeof item.instanceId !== "string" || item.instanceId.length === 0) {
        return null;
    }
    const rarity = ["common", "uncommon", "rare", "epic", "legendary"].includes(item.rarity) ? item.rarity : null;
    const slot = ["weapon", "armor", "accessory"].includes(item.slot) ? item.slot : null;
    const name = typeof item.name === "string" && item.name.length > 0 ? item.name : null;
    const description = typeof item.description === "string" ? item.description : "";
    const stats = Array.isArray(item.stats)
        ? item.stats
              .filter((stat) => ["hp", "damage", "defense", "speed"].includes(stat?.type))
              .map((stat) => ({
                  type: stat.type,
                  value: sanitizeNumber(stat.value),
                  min: sanitizeNumber(stat.min ?? stat.value),
                  max: sanitizeNumber(stat.max ?? stat.value)
              }))
              .filter((stat) => stat.value > 0)
        : [];
    if (!rarity || !slot || !name || stats.length === 0) return null;
    const specialOptions = Array.isArray(item.specialOptions)
        ? item.specialOptions
              .filter((option) => typeof option?.type === "string" && sanitizeNumber(option.value) > 0)
              .map((option) => ({ type: option.type, value: sanitizeNumber(option.value) }))
        : null;
    return {
        instanceId: item.instanceId,
        rarity,
        slot,
        name,
        baseName: typeof item.baseName === "string" ? item.baseName : name,
        primaryStatType: stats[0].type,
        specialOptionType: specialOptions?.[0]?.type ?? null,
        description,
        stats,
        specialOptions,
        enhanceLevel: Math.min(5, sanitizeNumber(item.enhanceLevel)),
        draw: typeof item.draw === "string" ? item.draw : slot,
        isGuaranteed: true
    };
}

function sanitizeHuntingChest(chest) {
    if (!chest || typeof chest !== "object") return null;
    const rarity = ["common", "uncommon", "rare", "epic", "legendary"].includes(chest.rarity) ? chest.rarity : "common";
    const id = typeof chest.id === "string" && chest.id.length > 0 ? chest.id : null;
    if (!id) return null;
    const guaranteedEquipment = sanitizeGuaranteedEquipment(chest.guaranteedEquipment);
    return {
        id,
        rarity,
        acquiredAt: sanitizeTimestamp(chest.acquiredAt) ?? Date.now(),
        openCost: Number.isFinite(chest.openCost) && chest.openCost >= 0 ? sanitizeNumber(chest.openCost) : null,
        rewardPreview: typeof chest.rewardPreview === "string" ? chest.rewardPreview : null,
        guaranteedEquipment
    };
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

function sanitizeHunting(obj) {
    const defaults = createDefaultPlayerProfile().hunting;
    if (!obj || typeof obj !== "object") return defaults;
    const seen = new Set();
    const chests = Array.isArray(obj.chests)
        ? obj.chests
              .map(sanitizeHuntingChest)
              .filter(Boolean)
              .filter((chest) => {
                  if (seen.has(chest.id)) return false;
                  seen.add(chest.id);
                  return true;
              })
              .slice(-200)
        : [];
    const unlockedStageIds = sanitizeHuntingStageIds(obj.unlockedStageIds);
    const selectedStageId = unlockedStageIds.includes(obj.selectedStageId)
        ? obj.selectedStageId
        : unlockedStageIds[unlockedStageIds.length - 1];
    return {
        shards: sanitizeNumber(obj.shards),
        chests,
        blueprints: sanitizeHuntingBlueprints(obj.blueprints),
        unlockedStageIds,
        selectedStageId,
        stats: {
            runsStarted: sanitizeNumber(obj.stats?.runsStarted),
            runsRetreated: sanitizeNumber(obj.stats?.runsRetreated),
            runsDefeated: sanitizeNumber(obj.stats?.runsDefeated),
            deepestFloor: sanitizeNumber(obj.stats?.deepestFloor)
        }
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

function sanitizeEquipment(obj) {
    if (!obj || typeof obj !== "object") return createDefaultPlayerProfile().equipment;
    const inventory = Array.isArray(obj.inventory)
        ? obj.inventory.filter((item) => item && typeof item.instanceId === "string").slice(-100)
        : [];
    const equipped = obj.equipped && typeof obj.equipped === "object" ? obj.equipped : {};
    return {
        inventory,
        equipped: {
            weapon: typeof equipped.weapon === "string" ? equipped.weapon : null,
            armor: typeof equipped.armor === "string" ? equipped.armor : null,
            accessory1: typeof equipped.accessory1 === "string" ? equipped.accessory1 : null,
            accessory2: typeof equipped.accessory2 === "string" ? equipped.accessory2 : null
        },
        enhancementStones: sanitizeNumber(obj.enhancementStones),
        maxInventorySlots: Math.max(5, sanitizeNumber(obj.maxInventorySlots) || 5)
    };
}

export function sanitizePlayerProfile(raw) {
    if (!raw || typeof raw !== "object") return createDefaultPlayerProfile();
    return {
        version: PROFILE_VERSION,
        characterMastery: sanitizeCharacterMastery(raw.characterMastery ?? raw.characterLinks),
        experience: sanitizeExperience(raw.experience),
        equipment: sanitizeEquipment(raw.equipment),
        hunting: sanitizeHunting(raw.hunting),
        collection: {
            characters: sanitizeCharacters(raw.collection?.characters),
            achievements: sanitizeAchievements(raw.collection?.achievements),
            careerStats: sanitizeCareerStats(raw.collection?.careerStats)
        }
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
