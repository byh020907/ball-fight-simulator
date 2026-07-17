import { HUNTING_FLOOR_OUTCOME_TYPES, HUNTING_MINIBOSS, HUNTING_STAGE_IDS } from "./huntingConfig.js";
import { getNextHuntingStageId, rollHuntingFloorOutcome } from "./huntingEncounters.js";
import { applyHuntingFloorRecovery, getUnlockedHuntingStageIds, retreatHuntingRun } from "./huntingState.js";

function normalizeMinibossChance(value) {
    return Number(Math.max(HUNTING_MINIBOSS.INITIAL_CHANCE, Math.min(HUNTING_MINIBOSS.MAX_CHANCE, value)).toFixed(3));
}

function getMinibossChance(run) {
    const chance = Number.isFinite(run?.minibossChance) ? run.minibossChance : HUNTING_MINIBOSS.INITIAL_CHANCE;
    return normalizeMinibossChance(chance);
}

function rollMinibossEncounter(encounter, chance, rng) {
    if (encounter.type !== HUNTING_FLOOR_OUTCOME_TYPES.COMBAT) {
        return { encounter, nextChance: chance };
    }

    const isMiniboss = rng() < chance;
    return {
        encounter: { ...encounter, isMiniboss },
        nextChance: normalizeMinibossChance(
            isMiniboss ? HUNTING_MINIBOSS.INITIAL_CHANCE : chance + HUNTING_MINIBOSS.MISS_CHANCE_INCREASE
        )
    };
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

export function advanceHuntingRun(run, { rng = Math.random } = {}) {
    if (!run || run.status !== "active") return run;
    if (run.floor >= run.maxFloor) {
        return retreatHuntingRun(run, { reason: "max_floor_clear" });
    }

    const nextFloor = Math.min(run.maxFloor, run.floor + 1);
    const advancedRun = applyHuntingFloorRecovery({ ...run, floor: nextFloor });
    const combatReliefFloors = Math.max(0, advancedRun.combatReliefFloors ?? 0);
    const portalDeclineFloors = Math.max(0, advancedRun.portalDeclineFloors ?? 0);
    const hpRatio =
        advancedRun.carriedMaxHp > 0
            ? (advancedRun.carriedHp ?? advancedRun.carriedMaxHp) / advancedRun.carriedMaxHp
            : 1.0;
    const rolledEncounter = rollHuntingFloorOutcome(nextFloor, rng, combatReliefFloors, {
        hpRatio,
        portalDeclineFloors
    });
    const { encounter, nextChance } = rollMinibossEncounter(rolledEncounter, getMinibossChance(run), rng);

    return {
        ...advancedRun,
        combatReliefFloors: Math.max(0, combatReliefFloors - 1),
        minibossChance: nextChance,
        portalDeclineFloors: Math.max(0, portalDeclineFloors - 1),
        lastEvent: encounter.type === "event" ? encounter.event : null,
        lastEncounter: encounter,
        history: [...advancedRun.history, { type: "advance", floor: nextFloor, encounter }]
    };
}
