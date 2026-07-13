import { HUNTING_EVENT_TYPES, HUNTING_STAGE_IDS } from "./huntingConfig.js";

const HUNTING_STAT_TAG_PATTERN = /^[a-z][a-z0-9:_-]{0,63}$/;
const MAX_TRACKED_MONSTER_TAGS = 64;
const MAX_HUNTING_COUNTER = 1_000_000_000;

function sanitizeCounter(value) {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(MAX_HUNTING_COUNTER, Math.floor(value));
}

function isTrackedMonsterTag(tag) {
    return typeof tag === "string" && HUNTING_STAT_TAG_PATTERN.test(tag);
}

function sanitizeMonsterKillsByTag(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
        Object.entries(value)
            .filter(([tag]) => isTrackedMonsterTag(tag))
            .slice(0, MAX_TRACKED_MONSTER_TAGS)
            .map(([tag, count]) => [tag, sanitizeCounter(count)])
    );
}

function addMonsterTags(monsterKillsByTag, tags) {
    const next = { ...monsterKillsByTag };
    for (const tag of tags) {
        next[tag] = Math.min(MAX_HUNTING_COUNTER, (next[tag] ?? 0) + 1);
    }
    return next;
}

function mergeMonsterKillCounts(current, added) {
    const next = { ...current };
    for (const [tag, count] of Object.entries(added ?? {})) {
        if (!isTrackedMonsterTag(tag)) continue;
        next[tag] = Math.min(MAX_HUNTING_COUNTER, (next[tag] ?? 0) + sanitizeCounter(count));
    }
    return next;
}

function collectMonsterTags(enemySpecs = []) {
    return enemySpecs.flatMap((spec) => {
        const tags = spec?.hunting?.monsterTags;
        if (!Array.isArray(tags)) return [];
        return [...new Set(tags.filter(isTrackedMonsterTag))];
    });
}

export function createDefaultHuntingStats() {
    return {
        runsStarted: 0,
        runsRetreated: 0,
        runsDefeated: 0,
        deepestFloor: 0,
        monsterKillsByTag: {},
        criticalHpCombatWins: 0,
        championVictories: 0,
        securedChestCount: 0,
        bestPortalRetreatFloor: 0,
        clearedStageIds: []
    };
}

export function sanitizeHuntingStats(value) {
    const defaults = createDefaultHuntingStats();
    if (!value || typeof value !== "object") return defaults;

    const validStageIds = new Set(Object.values(HUNTING_STAGE_IDS));
    return {
        runsStarted: sanitizeCounter(value.runsStarted),
        runsRetreated: sanitizeCounter(value.runsRetreated),
        runsDefeated: sanitizeCounter(value.runsDefeated),
        deepestFloor: sanitizeCounter(value.deepestFloor),
        monsterKillsByTag: sanitizeMonsterKillsByTag(value.monsterKillsByTag),
        criticalHpCombatWins: sanitizeCounter(value.criticalHpCombatWins),
        championVictories: sanitizeCounter(value.championVictories),
        securedChestCount: sanitizeCounter(value.securedChestCount),
        bestPortalRetreatFloor: sanitizeCounter(value.bestPortalRetreatFloor),
        clearedStageIds: Array.isArray(value.clearedStageIds)
            ? [...new Set(value.clearedStageIds.filter((stageId) => validStageIds.has(stageId)))]
            : []
    };
}

export function createHuntingAchievementProgress() {
    return {
        monsterKillsByTag: {},
        criticalHpCombatWins: 0,
        championVictories: 0
    };
}

export function recordHuntingBattleStart(
    run,
    { enemySpecs = [], hpRemain = null, maxHp = null, isChampion = false } = {}
) {
    if (!run || run.status !== "active") return run;

    const safeMaxHp = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : run.carriedMaxHp;
    const safeHpRemain = Number.isFinite(hpRemain) ? hpRemain : run.carriedHp;
    const startHpRatio =
        safeMaxHp > 0 && Number.isFinite(safeHpRemain) ? Math.max(0, Math.min(1, safeHpRemain / safeMaxHp)) : 1;

    return {
        ...run,
        currentBattleAchievement: {
            monsterTags: collectMonsterTags(enemySpecs),
            startHpRatio,
            isChampion: Boolean(isChampion),
            completed: false
        }
    };
}

export function recordHuntingBattleVictory(run) {
    const battle = run?.currentBattleAchievement;
    if (!run || !battle || battle.completed) return run;

    const progress = run.achievementProgress ?? createHuntingAchievementProgress();
    return {
        ...run,
        currentBattleAchievement: { ...battle, completed: true },
        achievementProgress: {
            monsterKillsByTag: addMonsterTags(progress.monsterKillsByTag ?? {}, battle.monsterTags ?? []),
            criticalHpCombatWins: sanitizeCounter(progress.criticalHpCombatWins) + (battle.startHpRatio <= 0.2 ? 1 : 0),
            championVictories: sanitizeCounter(progress.championVictories) + (battle.isChampion ? 1 : 0)
        }
    };
}

export function applyHuntingRunAchievementProgress(stats, run) {
    const current = sanitizeHuntingStats(stats);
    const progress = run?.achievementProgress ?? createHuntingAchievementProgress();
    const isPortalRetreat = run?.endedReason === "retreat" && run?.lastEvent?.type === HUNTING_EVENT_TYPES.PORTAL;
    const clearedStageIds =
        run?.endedReason === "stage_clear" && Object.values(HUNTING_STAGE_IDS).includes(run.stageId)
            ? [...new Set([...current.clearedStageIds, run.stageId])]
            : current.clearedStageIds;

    return {
        ...current,
        monsterKillsByTag: mergeMonsterKillCounts(current.monsterKillsByTag, progress.monsterKillsByTag),
        criticalHpCombatWins: current.criticalHpCombatWins + sanitizeCounter(progress.criticalHpCombatWins),
        championVictories: current.championVictories + sanitizeCounter(progress.championVictories),
        securedChestCount: current.securedChestCount + Math.max(0, run?.securedLoot?.chests?.length ?? 0),
        bestPortalRetreatFloor: isPortalRetreat
            ? Math.max(current.bestPortalRetreatFloor, sanitizeCounter(run.floor))
            : current.bestPortalRetreatFloor,
        clearedStageIds
    };
}
