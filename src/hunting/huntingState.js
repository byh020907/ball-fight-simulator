import { HUNTING_MAX_FLOOR } from "./huntingConfig.js";
import { applyDefeatPreservation, createEmptyHuntingLoot, mergeHuntingLoot } from "./huntingRewards.js";
import { rollHuntingEvent } from "./huntingEncounters.js";

function cloneLoot(loot = createEmptyHuntingLoot()) {
    return {
        keyShards: Math.max(0, Math.floor(loot.keyShards ?? 0)),
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

export function createHuntingRun({ characterId, now = Date.now(), maxFloor = HUNTING_MAX_FLOOR } = {}) {
    if (!characterId) {
        throw new Error("characterId is required to start a hunting run");
    }

    return {
        id: createRunId(characterId, now),
        mode: "hunting",
        status: "active",
        characterId,
        floor: 1,
        maxFloor,
        carriedHp: null,
        pendingLoot: createEmptyHuntingLoot(),
        securedLoot: createEmptyHuntingLoot(),
        lastEvent: null,
        history: [],
        startedAt: now,
        endedAt: null
    };
}

export function recordHuntingFloorResult(run, { hpRemain = null, maxHp = null, loot = createEmptyHuntingLoot() } = {}) {
    if (!run || run.status !== "active") return run;
    return {
        ...run,
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

    const nextFloor = run.floor + 1;
    const event = rollHuntingEvent(nextFloor, rng);
    return {
        ...run,
        floor: nextFloor,
        lastEvent: event,
        history: [
            ...run.history,
            {
                type: "advance",
                floor: nextFloor,
                event
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
