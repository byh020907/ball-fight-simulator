import { HUNTING_STAGE_IDS } from "./huntingConfig.js";
import { getNextHuntingStageId, rollHuntingFloorOutcome } from "./huntingEncounters.js";
import { getUnlockedHuntingStageIds, retreatHuntingRun } from "./huntingState.js";

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

export function advanceHuntingRun(run, { rng = Math.random } = {}) {
    if (!run || run.status !== "active") return run;
    if (run.floor >= run.maxFloor) {
        return retreatHuntingRun(run, { reason: "max_floor_clear" });
    }

    const nextFloor = Math.min(run.maxFloor, run.floor + 1);
    const combatReliefFloors = Math.max(0, run.combatReliefFloors ?? 0);
    const portalDeclineFloors = Math.max(0, run.portalDeclineFloors ?? 0);
    const hpRatio = run.carriedMaxHp > 0 ? (run.carriedHp ?? run.carriedMaxHp) / run.carriedMaxHp : 1.0;
    const encounter = rollHuntingFloorOutcome(nextFloor, rng, combatReliefFloors, {
        hpRatio,
        portalDeclineFloors
    });

    return {
        ...run,
        floor: nextFloor,
        combatReliefFloors: Math.max(0, combatReliefFloors - 1),
        portalDeclineFloors: Math.max(0, portalDeclineFloors - 1),
        lastEvent: encounter.type === "event" ? encounter.event : null,
        lastEncounter: encounter,
        history: [...run.history, { type: "advance", floor: nextFloor, encounter }]
    };
}
