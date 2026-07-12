import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MASTERY_TIERS = REWARD_BALANCE.progression.masteryTiers;
const MASTERY_RUNTIME = REWARD_BALANCE.progression.masteryRuntime;

// ── 캐릭터 숙련도 효과 정의 (등급별 수치) ──────────────────────────────────
//
// 각 정의는 tierValues[0..3]를 소유하며 apply(ctx, level)에서 사용한다.
// tierValues[0] = 미해금 (항상 0), [1] = BRONZE, [2] = SILVER, [3] = GOLD
// ─────────────────────────────────────────────────────────────────────────────

export const MASTERY_EFFECT_DEFS = Object.freeze([
    {
        id: "archer_precision_training",
        sourceFighterId: "archer",
        name: "정밀 훈련",
        kind: "stat_modifier",
        description: "공격력이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.damage,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.statModifiers.damage += this.tierValues[level];
        }
    },
    {
        id: "orbit_reflective_orbit",
        sourceFighterId: "orbit",
        name: "반사 궤도",
        kind: "physics_modifier",
        description: "벽 충돌 시 반사 속도가 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.wallBounce,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.wallBounce += this.tierValues[level];
        }
    },
    {
        id: "trickster_versatility",
        sourceFighterId: "trickster",
        name: "다재다능",
        kind: "physics_modifier",
        description: "기본 속도 복원률이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.velocityRecoveryBonus,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.velocityRecoveryBonus += this.tierValues[level];
        }
    },
    {
        id: "grenade_heavy_impact",
        sourceFighterId: "grenade",
        name: "중량 충격",
        kind: "combat_modifier",
        description: "충돌로 가하는 피해가 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.outgoingCollisionDamageBonus,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.combatModifiers.outgoingCollisionDamageBonus += this.tierValues[level];
        }
    },
    {
        id: "dash_propulsion",
        sourceFighterId: "dash",
        name: "추진력",
        kind: "stat_modifier",
        description: "이동 속도가 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.speed,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.statModifiers.speed += this.tierValues[level];
        }
    },
    {
        id: "rage_bloodlust",
        sourceFighterId: "rage",
        name: "전투 욕구",
        kind: "combat_passive",
        description: "12초마다 다음 충돌 피해가 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.rageCollisionDamage,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.combatPassives.push({
                id: "rage_mastery_passive",
                cooldown: 12,
                onBeforeFighterCollisionDamage: ({ simulation, attacker, outgoingDamage }) => {
                    if (outgoingDamage <= 0) return { outgoingDamage, consumed: false };
                    simulation.spawnActionText(
                        attacker.position.clone(),
                        `숙련도 +${(this.tierValues[level] * 100).toFixed(0)}%`,
                        "#ff4444"
                    );
                    return {
                        outgoingDamage: Math.round(outgoingDamage * (1 + this.tierValues[level])),
                        consumed: true
                    };
                }
            });
        }
    },
    {
        id: "eater_robust_digestion",
        sourceFighterId: "eater",
        name: "강한 소화력",
        kind: "stat_modifier",
        description: "최대 체력이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.hp,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.statModifiers.hp += this.tierValues[level];
        }
    },
    {
        id: "bat_ball_frugal_swing",
        sourceFighterId: "bat_ball",
        name: "아껴 휘두르기",
        kind: "action_modifier",
        description: "클릭 액션 HP 비용이 {value} 감소합니다. (최저 0.1%)",
        tierValues: MASTERY_TIERS.actionHpCostReduction,
        formatValue(v) {
            return (v * 100).toFixed(2) + "%p";
        },
        apply(ctx, level) {
            ctx.actionModifiers.hpCostPercentReduction += this.tierValues[level];
            ctx.actionModifiers.minHpCostPercent = 0.001;
        }
    },
    {
        id: "hero_inspiring_presence",
        sourceFighterId: "hero",
        name: "고무적인 존재감",
        kind: "action_modifier",
        description: "스킬 쿨다운이 {value} 감소합니다.",
        tierValues: MASTERY_TIERS.abilityCooldownPercent,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.actionModifiers.cooldownPercent += this.tierValues[level];
        }
    },
    {
        id: "vampire_blood_thirst",
        sourceFighterId: "vampire",
        name: "갈증",
        kind: "combat_passive",
        description: "4초마다 다음 충돌에서 준 피해의 {value}를 회복합니다. 잃은 HP에 따라 최대 2배가 됩니다.",
        tierValues: MASTERY_TIERS.vampireHpSteal,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.combatPassives.push({
                id: "vampire_mastery_passive",
                cooldown: MASTERY_RUNTIME.vampire.cooldown,
                onAfterFighterCollisionDamage: ({ simulation, attacker, actualOutgoingDamage }) => {
                    const missingHp = Math.max(0, attacker.maxHp - attacker.hp);
                    if (actualOutgoingDamage <= 0 || missingHp <= 0) return { consumed: false };
                    const missingHpRatio = missingHp / Math.max(1, attacker.maxHp);
                    const restoreMultiplier = 1 + missingHpRatio * (MASTERY_RUNTIME.vampire.missingHpMultiplierMax - 1);
                    const restored = attacker.heal(actualOutgoingDamage * this.tierValues[level] * restoreMultiplier);
                    if (restored <= 0) return { consumed: false };
                    simulation.spawnActionText(attacker.position.clone(), `숙련도 +${restored} HP`, "#44cc66");
                    return { consumed: true };
                }
            });
        }
    },
    {
        id: "gunner_recoil_amplification",
        sourceFighterId: "gunner",
        name: "반동 증폭",
        kind: "physics_modifier",
        description: "전투원 충돌로 자신에게 전달되는 각충격이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.collisionAngularImpulse,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.collisionAngularImpulse += this.tierValues[level];
        }
    },
    {
        id: "phantom_shadow_weave",
        sourceFighterId: "phantom",
        name: "그림자 직조",
        kind: "combat_modifier",
        description: "받는 충돌 피해가 {value} 감소합니다.",
        tierValues: MASTERY_TIERS.incomingCollisionDamageReduce,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.combatModifiers.incomingCollisionDamageReduce += this.tierValues[level];
        }
    }
]);

/** 등급 레이블 */
export const TIER_LABELS = Object.freeze(["미해금", "BRONZE", "SILVER", "GOLD"]);

/** 등급별 설명 */
export const TIER_DESCRIPTIONS = Object.freeze({
    0: "해금 조건: {name} 난도 0 토너먼트 우승",
    1: "다음 등급 SILVER\n승급 조건: {name} 난도 1 토너먼트 우승",
    2: "다음 등급 GOLD\n승급 조건: {name} 난도 2 토너먼트 우승",
    3: "최대 등급"
});
