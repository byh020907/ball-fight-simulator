// ── 플레이어 프로필 저장/복원 ───────────────────────────────────────────────
//
// localStorage 키: bfs:player-profile:v1
// 이 모듈만 localStorage에 직접 접근합니다.
// 다른 모듈은 loadPlayerProfile() / savePlayerProfile()을 호출합니다.
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYER_PROFILE_STORAGE_KEY = "bfs:player-profile:v1";

export const PROFILE_LIMITS = Object.freeze({
    MAX_COUNTER: 1_000_000_000,
    MAX_TIMESTAMP: 8_640_000_000_000_000
});

export const PROFILE_VERSION = 4;

// ── 기본 프로필 ─────────────────────────────────────────────────────────────

export function createDefaultPlayerProfile() {
    return {
        version: PROFILE_VERSION,
        characterMastery: {
            levels: {}
        },
        progression: {
            challenge: {
                highestUnlockedLevel: 0,
                selectedLevel: 0
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
    "hero"
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

function sanitizeChallenge(obj) {
    if (!obj || typeof obj !== "object") return { highestUnlockedLevel: 0, selectedLevel: 0 };
    const highest = Math.max(0, sanitizeNumber(obj.highestUnlockedLevel));
    const sel = Math.max(0, Math.min(sanitizeNumber(obj.selectedLevel), highest));
    return { highestUnlockedLevel: highest, selectedLevel: sel };
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

export function sanitizePlayerProfile(raw) {
    if (!raw || typeof raw !== "object") return createDefaultPlayerProfile();
    return {
        version: PROFILE_VERSION,
        characterMastery: sanitizeCharacterMastery(raw.characterMastery ?? raw.characterLinks),
        progression: {
            challenge: sanitizeChallenge(raw.progression?.challenge)
        },
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
    // v1 (unlockedIds) → v2 (levels)는 sanitizeCharacterMastery에서 처리
    return sanitizePlayerProfile(raw);
}

// ── 저장/로드 ────────────────────────────────────────────────────────────────

export function loadPlayerProfile() {
    try {
        const raw = localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
        if (!raw) return createDefaultPlayerProfile();
        const parsed = JSON.parse(raw);
        return migratePlayerProfile(parsed);
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
