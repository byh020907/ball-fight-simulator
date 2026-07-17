import { HUNTING_EVENT_TYPES, HUNTING_MAX_FLOOR, HUNTING_MONSTER_TYPES, HUNTING_STAGE_IDS } from "./huntingConfig.js";

const HUNTING_STAT_TAG_PATTERN = /^[a-z][a-z0-9:_-]{0,63}$/;
const MAX_TRACKED_MONSTER_TAGS = 64;
const MAX_HUNTING_COUNTER = 1_000_000_000;
const TRACKED_MONSTER_TYPES = new Set(Object.values(HUNTING_MONSTER_TYPES));
const TRACKED_STAGE_IDS = new Set(Object.values(HUNTING_STAGE_IDS));

function sanitizeCounter(value) {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(MAX_HUNTING_COUNTER, Math.floor(value));
}

function isTrackedMonsterTag(tag) {
    return typeof tag === "string" && HUNTING_STAT_TAG_PATTERN.test(tag);
}

function sanitizeMonsterKillsByTag(value) {
    if (!value || typeof value !== "object") return {};
    const counts = Object.fromEntries(
        Object.entries(value)
            .filter(([tag]) => isTrackedMonsterTag(tag))
            .slice(0, MAX_TRACKED_MONSTER_TAGS)
            .map(([tag, count]) => [tag, sanitizeCounter(count)])
    );
    if (counts["rarity:unique"] !== undefined) {
        counts["rarity:rare"] = Math.max(counts["rarity:rare"] ?? 0, counts["rarity:unique"]);
        delete counts["rarity:unique"];
    }
    if (counts["rarity:uncommon"] === undefined && counts["rarity:rare"] !== undefined) {
        counts["rarity:uncommon"] = counts["rarity:rare"];
    }
    return counts;
}

function sanitizeStageIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((stageId) => TRACKED_STAGE_IDS.has(stageId)))];
}

function sanitizeFloor(value) {
    return Math.max(1, sanitizeCounter(value));
}

function sanitizeLastReachedFloor(value) {
    if (!Number.isFinite(value) || value < 1) return null;
    return Math.min(HUNTING_MAX_FLOOR, Math.floor(value));
}

function sanitizeLastReachedFloorByStage(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
        Object.entries(value)
            .filter(([stageId]) => TRACKED_STAGE_IDS.has(stageId))
            .map(([stageId, floor]) => [stageId, sanitizeLastReachedFloor(floor)])
            .filter(([, floor]) => floor !== null)
    );
}

function createMonsterCodexRecord() {
    return { firstEncounterFloor: 0, lastEncounterFloor: 0, kills: 0, regions: {} };
}

function sanitizeMonsterCodexRegion(value) {
    if (!value || typeof value !== "object") return null;
    const firstEncounterFloor = sanitizeCounter(value.firstEncounterFloor);
    if (firstEncounterFloor < 1) return null;
    return {
        firstEncounterFloor,
        lastEncounterFloor: Math.max(firstEncounterFloor, sanitizeCounter(value.lastEncounterFloor)),
        kills: sanitizeCounter(value.kills)
    };
}

function sanitizeMonsterCodexRecord(value) {
    if (!value || typeof value !== "object") return null;
    const regions = Object.fromEntries(
        Object.entries(value.regions ?? {})
            .filter(([stageId]) => TRACKED_STAGE_IDS.has(stageId))
            .map(([stageId, region]) => [stageId, sanitizeMonsterCodexRegion(region)])
            .filter(([, region]) => region)
    );
    const regionEntries = Object.values(regions);
    const firstEncounterFloor = Math.min(
        ...[
            sanitizeCounter(value.firstEncounterFloor),
            ...regionEntries.map((region) => region.firstEncounterFloor)
        ].filter((floor) => floor > 0)
    );
    if (!Number.isFinite(firstEncounterFloor)) return null;
    const lastEncounterFloor = Math.max(
        firstEncounterFloor,
        sanitizeCounter(value.lastEncounterFloor),
        ...regionEntries.map((region) => region.lastEncounterFloor)
    );
    return {
        firstEncounterFloor,
        lastEncounterFloor,
        kills: sanitizeCounter(value.kills),
        regions
    };
}

function sanitizeMonsterCodexByType(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
        Object.entries(value)
            .filter(([type]) => TRACKED_MONSTER_TYPES.has(type))
            .map(([type, record]) => [type, sanitizeMonsterCodexRecord(record)])
            .filter(([, record]) => record)
    );
}

function collectMonsterEntries(enemySpecs = []) {
    return enemySpecs.flatMap((spec) => {
        const type = spec?.hunting?.monsterType;
        const stageId = spec?.hunting?.stageSkin;
        return TRACKED_MONSTER_TYPES.has(type) && TRACKED_STAGE_IDS.has(stageId) ? [{ type, stageId }] : [];
    });
}

function recordMonsterEncounters(records, monsterEntries, floor) {
    const next = sanitizeMonsterCodexByType(records);
    const encounterFloor = sanitizeFloor(floor);
    for (const { type, stageId } of monsterEntries) {
        const current = next[type] ?? createMonsterCodexRecord();
        const region = current.regions[stageId] ?? { firstEncounterFloor: 0, lastEncounterFloor: 0, kills: 0 };
        next[type] = {
            ...current,
            firstEncounterFloor: current.firstEncounterFloor
                ? Math.min(current.firstEncounterFloor, encounterFloor)
                : encounterFloor,
            lastEncounterFloor: Math.max(current.lastEncounterFloor, encounterFloor),
            regions: {
                ...current.regions,
                [stageId]: {
                    ...region,
                    firstEncounterFloor: region.firstEncounterFloor
                        ? Math.min(region.firstEncounterFloor, encounterFloor)
                        : encounterFloor,
                    lastEncounterFloor: Math.max(region.lastEncounterFloor, encounterFloor)
                }
            }
        };
    }
    return next;
}

function recordMonsterKills(records, monsterEntries) {
    const next = sanitizeMonsterCodexByType(records);
    for (const { type, stageId } of monsterEntries) {
        const current = next[type];
        if (!current) continue;
        const region = current.regions[stageId];
        if (!region) continue;
        next[type] = {
            ...current,
            kills: Math.min(MAX_HUNTING_COUNTER, current.kills + 1),
            regions: {
                ...current.regions,
                [stageId]: { ...region, kills: Math.min(MAX_HUNTING_COUNTER, region.kills + 1) }
            }
        };
    }
    return next;
}

function mergeMonsterCodexRecords(current, added) {
    const next = sanitizeMonsterCodexByType(current);
    for (const [type, addedRecord] of Object.entries(sanitizeMonsterCodexByType(added))) {
        const existing = next[type] ?? createMonsterCodexRecord();
        const regions = { ...existing.regions };
        for (const [stageId, addedRegion] of Object.entries(addedRecord.regions)) {
            const currentRegion = regions[stageId];
            regions[stageId] = currentRegion
                ? {
                      firstEncounterFloor: Math.min(currentRegion.firstEncounterFloor, addedRegion.firstEncounterFloor),
                      lastEncounterFloor: Math.max(currentRegion.lastEncounterFloor, addedRegion.lastEncounterFloor),
                      kills: Math.min(MAX_HUNTING_COUNTER, currentRegion.kills + addedRegion.kills)
                  }
                : { ...addedRegion };
        }
        next[type] = {
            firstEncounterFloor: existing.firstEncounterFloor
                ? Math.min(existing.firstEncounterFloor, addedRecord.firstEncounterFloor)
                : addedRecord.firstEncounterFloor,
            lastEncounterFloor: Math.max(existing.lastEncounterFloor, addedRecord.lastEncounterFloor),
            kills: Math.min(MAX_HUNTING_COUNTER, existing.kills + addedRecord.kills),
            regions
        };
    }
    return next;
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
        lastReachedFloorByStage: {},
        visitedStageIds: [],
        monsterKillsByTag: {},
        monsterCodexByType: {},
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
        lastReachedFloorByStage: sanitizeLastReachedFloorByStage(value.lastReachedFloorByStage),
        visitedStageIds: sanitizeStageIds(value.visitedStageIds),
        monsterKillsByTag: sanitizeMonsterKillsByTag(value.monsterKillsByTag),
        monsterCodexByType: sanitizeMonsterCodexByType(value.monsterCodexByType),
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
        monsterCodexByType: {},
        criticalHpCombatWins: 0,
        championVictories: 0
    };
}

export function recordHuntingStageVisit(stats, stageId) {
    const current = sanitizeHuntingStats(stats);
    if (!TRACKED_STAGE_IDS.has(stageId)) return current;
    return {
        ...current,
        visitedStageIds: [...new Set([...current.visitedStageIds, stageId])]
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

    const monsterEntries = collectMonsterEntries(enemySpecs);
    const progress = run.achievementProgress ?? createHuntingAchievementProgress();
    return {
        ...run,
        currentBattleAchievement: {
            monsterTags: collectMonsterTags(enemySpecs),
            monsterEntries,
            startHpRatio,
            isChampion: Boolean(isChampion),
            completed: false
        },
        achievementProgress: {
            ...progress,
            monsterCodexByType: recordMonsterEncounters(progress.monsterCodexByType, monsterEntries, run.floor)
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
            monsterCodexByType: recordMonsterKills(progress.monsterCodexByType, battle.monsterEntries ?? []),
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
        ...recordHuntingStageVisit(current, run?.stageId),
        monsterKillsByTag: mergeMonsterKillCounts(current.monsterKillsByTag, progress.monsterKillsByTag),
        monsterCodexByType: mergeMonsterCodexRecords(current.monsterCodexByType, progress.monsterCodexByType),
        criticalHpCombatWins: current.criticalHpCombatWins + sanitizeCounter(progress.criticalHpCombatWins),
        championVictories: current.championVictories + sanitizeCounter(progress.championVictories),
        securedChestCount: current.securedChestCount + Math.max(0, run?.securedLoot?.chests?.length ?? 0),
        bestPortalRetreatFloor: isPortalRetreat
            ? Math.max(current.bestPortalRetreatFloor, sanitizeCounter(run.floor))
            : current.bestPortalRetreatFloor,
        clearedStageIds
    };
}

export function getHuntingMonsterTypeKillCount(stats, type) {
    return sanitizeMonsterCodexByType(stats?.monsterCodexByType)[type]?.kills ?? 0;
}

export function getHuntingMonsterEncounteredTypeCount(stats) {
    return Object.keys(sanitizeMonsterCodexByType(stats?.monsterCodexByType)).length;
}
