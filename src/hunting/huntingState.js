import {
    HUNTING_MAX_FLOOR,
    HUNTING_START_CHECKPOINTS,
    HUNTING_STAGE_IDS,
    HUNTING_STAGES,
    HUNTING_STAT_KEYS,
    HUNTING_COMBAT_RELIEF,
    HUNTING_MINIBOSS
} from "./huntingConfig.js";
import { applyDefeatPreservation, createEmptyHuntingLoot, mergeHuntingLoot } from "./huntingRewards.js";
import { HUNTING_EVENT_TYPES } from "./huntingConfig.js";
import { HUNTING_FLOW_CONFIG } from "./huntingFlowConfig.js";
import { createHuntingAchievementProgress } from "./huntingAchievementProgress.js";
import { isCharacterUnlocked } from "../playerProfile.js";
import {
    HUNTING_PARTY_ROLES,
    applyHuntingPartyFloorRecovery,
    createHuntingPartyState,
    getActiveHuntingPartyMember,
    getHuntingPartyMember,
    setHuntingPartyMemberHealth,
    setHuntingPartyMemberHeroCarryover
} from "./huntingPartyState.js";

export const HUNTING_RUN_PHASES = Object.freeze({
    READY: "ready",
    MOVING: "moving",
    AWAITING_EVENT: "awaiting_event",
    AWAITING_CHOICE: "awaiting_choice",
    AWAITING_MERCHANT: "awaiting_merchant",
    AWAITING_CHEST: "awaiting_chest",
    AWAITING_COMBAT_REWARD_CHEST: "awaiting_combat_reward_chest",
    AWAITING_BATTLE_PREPARATION: "awaiting_battle_preparation",
    COMBAT: "combat",
    FINISHED: "finished"
});

function cloneLoot(loot = createEmptyHuntingLoot()) {
    return {
        shards: Math.max(0, Math.floor(loot.shards ?? 0)),
        enhancementStones: Math.max(0, Math.floor(loot.enhancementStones ?? 0)),
        chests: [...(loot.chests ?? [])]
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
    return roster.filter((fighter) => isCharacterUnlocked(profile, fighter.id) && canEnterHunting(profile, fighter.id));
}

export function isHuntingPartySelectionEligible(profile, roster = [], party = {}) {
    const companionIds = Array.isArray(party.companionIds) ? party.companionIds : [];
    const selectedIds = [party.leaderId, ...companionIds, HUNTING_FLOW_CONFIG.swapEnabled ? party.swapId : null].filter(
        Boolean
    );
    const eligibleIds = new Set(getEligibleHuntingCharacters(profile, roster).map((fighter) => fighter.id));
    return (
        Boolean(party.leaderId) &&
        new Set(selectedIds).size === selectedIds.length &&
        selectedIds.every((characterId) => eligibleIds.has(characterId))
    );
}

export function selectHuntingModeCharacterId(profile, roster = [], currentCharacterId = null, rng = Math.random) {
    const eligible = getEligibleHuntingCharacters(profile, roster);
    if (eligible.some((fighter) => fighter.id === currentCharacterId)) return currentCharacterId;
    if (eligible.length === 0) return currentCharacterId;
    return eligible[Math.floor(rng() * eligible.length)]?.id ?? eligible[0].id;
}

export function createHuntingRun({
    characterId,
    companionIds = [],
    swapId = null,
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
        phase: HUNTING_RUN_PHASES.READY,
        party: createHuntingPartyState({ leaderId: characterId, companionIds, swapId }),
        stageId,
        floor: 1,
        maxFloor,
        statModifiers: [],
        pendingLoot: createEmptyHuntingLoot(),
        securedLoot: createEmptyHuntingLoot(),
        lastEvent: null,
        lastEncounter: null,
        combatReliefFloors: 0,
        minibossChance: HUNTING_MINIBOSS.INITIAL_CHANCE,
        portalDeclineFloors: 0,
        achievementProgress: createHuntingAchievementProgress(),
        currentBattleAchievement: null,
        history: [],
        startedAt: now,
        endedAt: null,
        endedReason: null
    };
}

export function getHuntingRunActiveMember(run) {
    return getActiveHuntingPartyMember(run?.party);
}

export function getHuntingRunCharacterId(run) {
    return getHuntingRunActiveMember(run)?.characterId ?? null;
}

export function getHuntingRunHealth(run, role = run?.party?.activeRole) {
    const member = getHuntingPartyMember(run?.party, role);
    return { hp: member?.hp ?? null, maxHp: member?.maxHp ?? null };
}

export function setHuntingRunMemberHealth(run, role, health) {
    if (!run?.party) return run;
    return { ...run, party: setHuntingPartyMemberHealth(run.party, role, health) };
}

export function setHuntingRunActiveHealth(run, health) {
    return setHuntingRunMemberHealth(run, run?.party?.activeRole, health);
}

export function setHuntingRunMemberHeroCarryover(run, role, carryover) {
    if (!run?.party) return run;
    return { ...run, party: setHuntingPartyMemberHeroCarryover(run.party, role, carryover) };
}

export function getHuntingAvailableStartFloors(stats, stageId) {
    const hasKnownStage = HUNTING_STAGES.some((stage) => stage.id === stageId);
    if (!hasKnownStage) return [HUNTING_START_CHECKPOINTS[0]];

    const lastReachedFloor = stats?.lastReachedFloorByStage?.[stageId];
    if (!Number.isFinite(lastReachedFloor) || lastReachedFloor < 1) return [HUNTING_START_CHECKPOINTS[0]];

    const safeLastReachedFloor = Math.min(HUNTING_MAX_FLOOR, Math.floor(lastReachedFloor));
    return HUNTING_START_CHECKPOINTS.filter((checkpoint) => checkpoint === 1 || safeLastReachedFloor >= checkpoint);
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

export function setHuntingRunPhase(run, phase) {
    if (!run || !Object.values(HUNTING_RUN_PHASES).includes(phase)) return run;
    return { ...run, phase };
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
    {
        hpRemain = null,
        maxHp = null,
        loot = createEmptyHuntingLoot(),
        consumeStatModifiers = true,
        combatCleared = false
    } = {}
) {
    if (!run || run.status !== "active") return run;
    const consumed = consumeStatModifiers ? consumeHuntingStatModifierFloor(run) : run;
    const combatReliefFloors = combatCleared ? HUNTING_COMBAT_RELIEF.INITIAL_FLOORS : (run.combatReliefFloors ?? 0);
    return {
        ...run,
        statModifiers: consumed.statModifiers,
        combatReliefFloors,
        party:
            hpRemain === null && maxHp === null
                ? run.party
                : setHuntingPartyMemberHealth(run.party, run.party.activeRole, {
                      hp: hpRemain === null ? getHuntingRunHealth(run).hp : Math.max(0, hpRemain),
                      maxHp: maxHp === null ? getHuntingRunHealth(run).maxHp : Math.max(0, maxHp)
                  }),
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

export function applyHuntingEventRecovery(run, { amount = 0 } = {}) {
    if (!run || run.status !== "active") return run;
    const { hp, maxHp: rawMaxHp } = getHuntingRunHealth(run);
    const maxHp = Number.isFinite(rawMaxHp) && rawMaxHp > 0 ? rawMaxHp : null;
    if (maxHp === null) return run;
    const recoveredHp = Math.min(maxHp, Math.max(0, (hp ?? maxHp) + Math.max(0, amount)));
    return {
        ...setHuntingRunActiveHealth(run, { hp: recoveredHp, maxHp }),
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

export function applyHuntingFloorRecovery(run) {
    if (!run || run.status !== "active") return run;
    const recoveredParty = applyHuntingPartyFloorRecovery(run.party);
    const recoveries = Object.values(HUNTING_PARTY_ROLES).flatMap((role) => {
        const before = getHuntingPartyMember(run.party, role);
        const after = getHuntingPartyMember(recoveredParty, role);
        const amount = (after?.hp ?? 0) - (before?.hp ?? 0);
        return amount > 0 ? [{ role, amount, hpRemain: after.hp }] : [];
    });
    if (recoveries.length === 0) return { ...run, party: recoveredParty };
    return {
        ...run,
        party: recoveredParty,
        history: [
            ...run.history,
            {
                type: "floor_recovery",
                floor: run.floor,
                recoveries
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
        phase: HUNTING_RUN_PHASES.FINISHED,
        securedLoot: mergeHuntingLoot(run.securedLoot, run.pendingLoot),
        pendingLoot: createEmptyHuntingLoot(),
        endedAt: now,
        endedReason: reason,
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
        phase: HUNTING_RUN_PHASES.FINISHED,
        securedLoot: mergeHuntingLoot(run.securedLoot, preservation.preservedLoot),
        pendingLoot: createEmptyHuntingLoot(),
        defeatLosses: preservation.lostLoot,
        endedAt: now,
        endedReason: "defeat",
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
