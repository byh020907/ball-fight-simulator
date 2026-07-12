// ── 숙련도 효과 합산 및 상한 적용 ─────────────────────────────────────────────
//
// MASTERY_EFFECT_DEFS의 apply(ctx, level)을 호출하여 활성 효과를 합산한다.
// 현재 캐릭터 자신의 효과는 제외한다.
// ─────────────────────────────────────────────────────────────────────────────

import { MASTERY_EFFECT_DEFS } from "./masteryDefinitions.js";
import { getCharacterMasteryLevel } from "./masteryState.js";

function createMasteryContext() {
    return {
        statModifiers: { hp: 0, damage: 0, defense: 0 },
        physicsModifiers: { incomingKnockbackReduce: 0, outgoingImpactBonus: 0, velocityRecoveryBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, minHpCostPercent: 0 }
    };
}

function clampMasteryContext(ctx) {
    const clamp = (val, max) => Math.max(0, Math.min(val, max));
    ctx.statModifiers.hp = clamp(ctx.statModifiers.hp, 0.12);
    ctx.statModifiers.damage = clamp(ctx.statModifiers.damage, 0.12);
    ctx.physicsModifiers.incomingKnockbackReduce = clamp(ctx.physicsModifiers.incomingKnockbackReduce, 0.15);
    ctx.physicsModifiers.outgoingImpactBonus = clamp(ctx.physicsModifiers.outgoingImpactBonus, 0.1);
    ctx.physicsModifiers.velocityRecoveryBonus = clamp(ctx.physicsModifiers.velocityRecoveryBonus, 0.1);
    ctx.actionModifiers.hpCostPercentReduction = clamp(ctx.actionModifiers.hpCostPercentReduction, 0.01);
    ctx.actionModifiers.minHpCostPercent = Math.max(0.001, ctx.actionModifiers.minHpCostPercent);
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
