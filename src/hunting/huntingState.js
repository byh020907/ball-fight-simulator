import { HUNTING_MAX_FLOOR, HUNTING_STAGE_IDS, HUNTING_STAGES, HUNTING_STAT_KEYS } from "./huntingConfig.js";
import { applyDefeatPreservation, createEmptyHuntingLoot, mergeHuntingLoot } from "./huntingRewards.js";
import { getNextHuntingStageId, rollHuntingFloorOutcome } from "./huntingEncounters.js";
import { HUNTING_EVENT_TYPES } from "./huntingConfig.js";

function cloneLoot(loot = createEmptyHuntingLoot()) {
    return {
        shards: Math.max(0, Math.floor(loot.shards ?? 0)),
        chests: [...(loot.chests ?? [])],
        xp: Math.max(0, Math.floor(loot.xp ?? 0))
    };
}

function createRunId(characterId, now) {
    return `hunt-${characterId}-${now}`;
}

export function canEnterHunting(profile, characterId) {
    const wins = profile?.collection?.characters?.[characterId]?.tournamentWins ?? 0;
    return wins > 0;
}

export function getEligibleHuntingCharacters(profile, roster = []) {
    return roster.filter((fighter) => canEnterHunting(profile, fighter.id));
}

export function createHuntingRun({
    characterId,
    stageId = HUNTING_STAGE_IDS.CAVE,
    now = Date.now(),
    maxFloor = HUNTING_MAX_FLOOR
} = {}) {
    if (!characterId) {
        throw new Error("characterId is required to start a hunting run");
    }

    return {
        id: createRunId(characterId, now),
        mode: "hunting",
        status: "active",
        characterId,
        stageId,
        floor: 0,
        maxFloor,
        carriedHp: null,
        statModifiers: [],
        pendingLoot: createEmptyHuntingLoot(),
        securedLoot: createEmptyHuntingLoot(),
        lastEvent: null,
        lastEncounter: null,
        history: [],
        startedAt: now,
        endedAt: null
    };
}

export function getUnlockedHuntingStageIds(profile) {
    const knownIds = new Set(HUNTING_STAGES.map((stage) => stage.id));
    const unlocked = Array.isArray(profile?.hunting?.unlockedStageIds)
        ? profile.hunting.unlockedStageIds.filter((id) => knownIds.has(id))
        : [];
    return unlocked.length > 0 ? [...new Set(unlocked)] : [HUNTING_STAGE_IDS.CAVE];
}

export function getSelectedHuntingStageId(profile) {
    const unlocked = getUnlockedHuntingStageIds(profile);
    const selected = profile?.hunting?.selectedStageId;
    return unlocked.includes(selected) ? selected : unlocked[unlocked.length - 1];
}

export function canRetreatFromHuntingRun(run) {
    return run?.status === "active" && run.lastEvent?.type === HUNTING_EVENT_TYPES.PORTAL;
}

export function completeHuntingStage(profile, stageId = HUNTING_STAGE_IDS.CAVE) {
    if (!profile?.hunting) return { unlockedStageId: null };
    const unlocked = getUnlockedHuntingStageIds(profile);
    const nextStageId = getNextHuntingStageId(stageId);
    if (nextStageId && !unlocked.includes(nextStageId)) {
        profile.hunting.unlockedStageIds = [...unlocked, nextStageId];
        profile.hunting.selectedStageId = nextStageId;
        return { unlockedStageId: nextStageId };
    }
    profile.hunting.unlockedStageIds = unlocked;
    profile.hunting.selectedStageId = stageId;
    return { unlockedStageId: null };
}

function sanitizeStatMultiplier(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0.1, Math.min(3, value));
}

function sanitizeEffectFloors(value) {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(5, Math.floor(value)));
}

function sanitizeHuntingStatModifier(modifier) {
    if (!modifier || typeof modifier !== "object") return null;
    if (!HUNTING_STAT_KEYS.includes(modifier.stat)) return null;
    return {
        source: modifier.source ?? "hunting_event",
        stat: modifier.stat,
        multiplier: sanitizeStatMultiplier(modifier.multiplier, 1),
        remainingFloors: sanitizeEffectFloors(modifier.remainingFloors ?? modifier.floors)
    };
}

export function applyHuntingStatModifiersToSpec(spec, modifiers = []) {
    const active = modifiers.map(sanitizeHuntingStatModifier).filter(Boolean);
    if (!spec || active.length === 0) return spec;

    const stats = { ...(spec.stats ?? {}) };
    for (const modifier of active) {
        if (!Number.isFinite(stats[modifier.stat])) continue;
        const scaled = stats[modifier.stat] * modifier.multiplier;
        stats[modifier.stat] = modifier.stat === "defense" ? Number(scaled.toFixed(3)) : Math.round(scaled);
    }

    return {
        ...spec,
        stats,
        hunting: {
            ...(spec.hunting ?? {}),
            statModifiers: active
        }
    };
}

export function consumeHuntingStatModifierFloor(run) {
    if (!run || run.status !== "active") return run;
    const statModifiers = (run.statModifiers ?? [])
        .map(sanitizeHuntingStatModifier)
        .filter(Boolean)
        .map((modifier) => ({
            ...modifier,
            remainingFloors: modifier.remainingFloors - 1
        }))
        .filter((modifier) => modifier.remainingFloors > 0);
    return {
        ...run,
        statModifiers
    };
}

export function recordHuntingFloorResult(
    run,
    { hpRemain = null, maxHp = null, loot = createEmptyHuntingLoot(), consumeStatModifiers = true } = {}
) {
    if (!run || run.status !== "active") return run;
    const consumed = consumeStatModifiers ? consumeHuntingStatModifierFloor(run) : run;
    return {
        ...run,
        statModifiers: consumed.statModifiers,
        carriedHp: hpRemain === null ? run.carriedHp : Math.max(0, hpRemain),
        carriedMaxHp: maxHp === null ? run.carriedMaxHp : Math.max(0, maxHp),
        pendingLoot: mergeHuntingLoot(run.pendingLoot, loot),
        history: [
            ...run.history,
            {
                type: "floor_clear",
                floor: run.floor,
                hpRemain,
                maxHp,
                loot: cloneLoot(loot)
            }
        ]
    };
}

export function advanceHuntingRun(run, { rng = Math.random } = {}) {
    if (!run || run.status !== "active") return run;
    if (run.floor >= run.maxFloor) {
        return retreatHuntingRun(run, { reason: "max_floor_clear" });
    }

    const nextFloor = Math.min(run.maxFloor, run.floor + 1);
    const encounter = rollHuntingFloorOutcome(nextFloor, rng);
    const event = encounter.type === "event" ? encounter.event : null;
    return {
        ...run,
        floor: nextFloor,
        lastEvent: event,
        lastEncounter: encounter,
        history: [
            ...run.history,
            {
                type: "advance",
                floor: nextFloor,
                encounter
            }
        ]
    };
}

export function applyHuntingEventRecovery(run, { amount = 0 } = {}) {
    if (!run || run.status !== "active") return run;
    const maxHp = run.carriedMaxHp ?? run.carriedHp ?? 0;
    const recoveredHp = Math.min(maxHp, Math.max(0, (run.carriedHp ?? maxHp) + Math.max(0, amount)));
    return {
        ...run,
        carriedHp: recoveredHp,
        history: [
            ...run.history,
            {
                type: "event_recovery",
                floor: run.floor,
                amount,
                hpRemain: recoveredHp
            }
        ]
    };
}

export function applyHuntingCursedAltar(run, { trade = null } = {}) {
    if (!run || run.status !== "active" || !trade) return run;
    const gainModifier = sanitizeHuntingStatModifier({
        source: "cursed_altar",
        stat: trade.gainStat,
        multiplier: trade.gainMultiplier,
        floors: trade.floors
    });
    const loseModifier = sanitizeHuntingStatModifier({
        source: "cursed_altar",
        stat: trade.loseStat,
        multiplier: trade.loseMultiplier,
        floors: trade.floors
    });
    const modifiers = [gainModifier, loseModifier].filter(Boolean);
    if (modifiers.length === 0) return run;

    return {
        ...run,
        statModifiers: [...(run.statModifiers ?? []), ...modifiers],
        history: [
            ...run.history,
            {
                type: "event_cursed_altar",
                floor: run.floor,
                trade: {
                    gainStat: trade.gainStat,
                    loseStat: trade.loseStat,
                    gainMultiplier: trade.gainMultiplier,
                    loseMultiplier: trade.loseMultiplier,
                    floors: trade.floors
                }
            }
        ]
    };
}

export function retreatHuntingRun(run, { reason = "retreat", now = Date.now() } = {}) {
    if (!run || run.status !== "active") return run;
    return {
        ...run,
        status: "retreated",
        securedLoot: mergeHuntingLoot(run.securedLoot, run.pendingLoot),
        pendingLoot: createEmptyHuntingLoot(),
        endedAt: now,
        history: [
            ...run.history,
            {
                type: "retreat",
                floor: run.floor,
                reason
            }
        ]
    };
}

export function defeatHuntingRun(run, { rng = Math.random, now = Date.now() } = {}) {
    if (!run || run.status !== "active") return run;
    const preservation = applyDefeatPreservation(run.pendingLoot, rng);
    return {
        ...run,
        status: "defeated",
        securedLoot: mergeHuntingLoot(run.securedLoot, preservation.preservedLoot),
        pendingLoot: createEmptyHuntingLoot(),
        defeatLosses: preservation.lostLoot,
        endedAt: now,
        history: [
            ...run.history,
            {
                type: "defeat",
                floor: run.floor,
                preservedLoot: cloneLoot(preservation.preservedLoot),
                lostLoot: cloneLoot(preservation.lostLoot)
            }
        ]
    };
}
