// ── 숙련도 효과 합산 및 상한 적용 ─────────────────────────────────────────────
//
// MASTERY_EFFECT_DEFS의 apply(ctx, level)을 호출하여 활성 효과를 합산한다.
// 현재 캐릭터 자신의 효과는 제외한다.
// ─────────────────────────────────────────────────────────────────────────────

import { MASTERY_EFFECT_DEFS } from "./masteryDefinitions.js";
import { getCharacterMasteryLevel } from "./masteryState.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MASTERY_CAPS = REWARD_BALANCE.progression.masteryCaps;

function createMasteryContext() {
    return {
        statModifiers: { hp: 0, damage: 0, defense: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0, minHpCostPercent: 0 }
    };
}

function clampMasteryContext(ctx) {
    const clamp = (val, max) => Math.max(0, Math.min(val, max));
    for (const [stat, value] of Object.entries(ctx.statModifiers)) {
        ctx.statModifiers[stat] = clamp(value, MASTERY_CAPS[stat]);
    }
    for (const [stat, value] of Object.entries(ctx.physicsModifiers)) {
        ctx.physicsModifiers[stat] = clamp(value, MASTERY_CAPS[stat]);
    }
    for (const [stat, value] of Object.entries(ctx.combatModifiers)) {
        ctx.combatModifiers[stat] = clamp(value, MASTERY_CAPS[stat]);
    }
    ctx.actionModifiers.hpCostPercentReduction = clamp(
        ctx.actionModifiers.hpCostPercentReduction,
        MASTERY_CAPS.hpCostPercentReduction
    );
    ctx.actionModifiers.cooldownPercent = clamp(ctx.actionModifiers.cooldownPercent, MASTERY_CAPS.cooldownPercent);
    ctx.actionModifiers.minHpCostPercent = Math.max(
        MASTERY_CAPS.minHpCostPercent,
        ctx.actionModifiers.minHpCostPercent
    );
    return ctx;
}

/**
 * 해금된 숙련도 효과 중 현재 캐릭터를 제외한 효과를 합산.
 * 각 정의의 apply(ctx, level)을 level 매개변수와 함께 호출한다.
 */
export function collectActiveEffects(profile, currentPlayerId) {
    const ctx = createMasteryContext();
    const levels = profile?.characterMastery?.levels ?? {};
    for (const def of MASTERY_EFFECT_DEFS) {
        const level = levels[def.sourceFighterId] ?? 0;
        if (level <= 0) continue;
        if (def.sourceFighterId === currentPlayerId) continue;
        def.apply(ctx, level);
    }
    return clampMasteryContext(ctx);
}

/** 숙련도 합산 결과를 전투용 fighter spec에 적용한다. */
export function applyMasteryEffectsToFighterSpec(spec, masteryContext) {
    const statModifiers = masteryContext?.statModifiers ?? {};
    const stats = Object.fromEntries(
        Object.entries(spec.stats).map(([stat, value]) => [
            stat,
            Number((value * (1 + (statModifiers[stat] ?? 0))).toFixed(3))
        ])
    );
    return {
        ...spec,
        stats,
        mastery: {
            physics: { ...(masteryContext?.physicsModifiers ?? {}) },
            combat: { ...(masteryContext?.combatModifiers ?? {}) },
            action: { ...(masteryContext?.actionModifiers ?? {}) },
            passives: [...(masteryContext?.combatPassives ?? [])]
        }
    };
}
