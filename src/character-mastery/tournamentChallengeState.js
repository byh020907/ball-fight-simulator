import { VALID_CHARACTER_IDS } from "../playerProfile.js";

const MAX_TOURNAMENT_CHALLENGE_LEVEL = 3;
const TOURNAMENT_OPPONENT_EXPERIENCE_LEVEL_BY_CHALLENGE = Object.freeze([null, 3, 6, 9]);

function ensureTournamentChallengeState(profile) {
    profile.tournamentChallenge ||= { levels: {} };
    profile.tournamentChallenge.levels ||= {};
    return profile.tournamentChallenge;
}

/** 캐릭터가 현재 진행 중인 토너먼트 도전 단계 (0~3) */
export function getCharacterChallengeLevel(profile, characterId) {
    if (!VALID_CHARACTER_IDS.includes(characterId)) return 0;
    const level = profile?.tournamentChallenge?.levels?.[characterId];
    if (typeof level !== "number" || !Number.isFinite(level)) return 0;
    return Math.max(0, Math.min(MAX_TOURNAMENT_CHALLENGE_LEVEL, Math.floor(level)));
}

/** 현재 도전 단계에 맞는 토너먼트 AI 시작 경험치 레벨을 반환한다. */
export function getTournamentOpponentExperienceLevel(profile, characterId) {
    return TOURNAMENT_OPPONENT_EXPERIENCE_LEVEL_BY_CHALLENGE[getCharacterChallengeLevel(profile, characterId)] ?? null;
}

/** 토너먼트 우승 뒤 다음 도전 단계를 올린다. */
export function advanceTournamentChallenge(profile, { characterId, playerWon }) {
    if (!playerWon) return { changed: false, reason: "lost" };
    if (!VALID_CHARACTER_IDS.includes(characterId)) return { changed: false, reason: "invalid_character" };

    const previousLevel = getCharacterChallengeLevel(profile, characterId);
    if (previousLevel >= MAX_TOURNAMENT_CHALLENGE_LEVEL) return { changed: false, reason: "max_level" };

    const state = ensureTournamentChallengeState(profile);
    const newLevel = previousLevel + 1;
    state.levels[characterId] = newLevel;
    return { changed: true, characterId, previousLevel, newLevel };
}

/** 환생한 캐릭터의 토너먼트 도전 단계를 첫 도전으로 되돌린다. */
export function resetTournamentChallenge(profile, characterId) {
    if (!VALID_CHARACTER_IDS.includes(characterId)) return { changed: false, reason: "invalid_character" };

    const previousLevel = getCharacterChallengeLevel(profile, characterId);
    if (previousLevel === 0) return { changed: false, previousLevel, newLevel: 0 };

    const state = ensureTournamentChallengeState(profile);
    delete state.levels[characterId];
    return { changed: true, characterId, previousLevel, newLevel: 0 };
}
