// ── 숙련도 효과 합산 ──────────────────────────────────────────────────────────
//
// MASTERY_EFFECT_DEFS의 apply(ctx, level)을 호출하여 활성 효과를 합산한다.
// 동일 키에 대해 단순 가산하며 상한이 없다.
// 현재 캐릭터 자신의 효과는 제외한다.
// ─────────────────────────────────────────────────────────────────────────────

import { MASTERY_EFFECT_DEFS } from "./masteryDefinitions.js";

function createMasteryContext() {
    return {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 }
    };
}

/**
 * 정의 배열과 levels 맵을 받아 ctx를 반환하는 순수 집계 함수.
 * 같은 stat 키는 단순 가산하며 상한이 없다. 프로필/마스터리 정의 외
 * 커스텀 fixture 정의도 같은 합산 규칙을 쓰게 한다.
 */
export function collectEffectsFromDefinitions(definitions, levels, currentPlayerId) {
    const ctx = createMasteryContext();
    for (const def of definitions) {
        const level = levels[def.sourceFighterId] ?? 0;
        if (level <= 0) continue;
        if (def.sourceFighterId === currentPlayerId) continue;
        def.apply(ctx, level);
    }
    return ctx;
}

/**
 * 해금된 숙련도 효과 중 현재 캐릭터를 제외한 효과를 합산.
 * 각 정의의 apply(ctx, level)을 level 매개변수와 함께 호출한다.
 */
export function collectActiveEffects(profile, currentPlayerId) {
    const levels = profile?.characterMastery?.levels ?? {};
    return collectEffectsFromDefinitions(MASTERY_EFFECT_DEFS, levels, currentPlayerId);
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
