import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MASTERY_TIERS = REWARD_BALANCE.progression.masteryTiers;

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
        id: "orbit_lightweight",
        sourceFighterId: "orbit",
        name: "경량 구조",
        kind: "physics_modifier",
        description: "받는 명시적 넉백이 {value} 감소합니다.",
        tierValues: MASTERY_TIERS.incomingKnockbackReduce,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.incomingKnockbackReduce += this.tierValues[level];
        }
    },
    {
        id: "trickster_versatility",
        sourceFighterId: "trickster",
        name: "다재다능",
        kind: "allocation_modifier",
        description: "스탯 밸런서 감도가 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.balanceTolerance,
        formatValue(v) {
            return v.toFixed(1);
        },
        apply(ctx, level) {
            ctx.allocationModifiers.balanceTolerance += this.tierValues[level];
        }
    },
    {
        id: "grenade_heavy_impact",
        sourceFighterId: "grenade",
        name: "중량 충격",
        kind: "physics_modifier",
        description: "볼 충돌 시 상대에게 가하는 충격량이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.outgoingImpactBonus,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.outgoingImpactBonus += this.tierValues[level];
        }
    },
    {
        id: "dash_streamlined",
        sourceFighterId: "dash",
        name: "유선형",
        kind: "physics_modifier",
        description: "기본 속도 복귀율이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.velocityRecoveryBonus,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.velocityRecoveryBonus += this.tierValues[level];
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
                type: "periodic_collision_bonus",
                cooldown: 12,
                damageBonus: this.tierValues[level]
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
            return (v * 100).toFixed(1) + "%p";
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
        kind: "allocation_modifier",
        description: "총 배분 포인트가 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.extraStatPoints,
        formatValue(v) {
            return String(v);
        },
        apply(ctx, level) {
            ctx.allocationModifiers.extraStatPoints += this.tierValues[level];
        }
    },
    {
        id: "vampire_blood_thirst",
        sourceFighterId: "vampire",
        name: "갈증",
        kind: "combat_passive",
        description: "8초마다 다음 충돌 흡혈률이 {value} 증가합니다.",
        tierValues: MASTERY_TIERS.vampireHpSteal,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.combatPassives.push({
                id: "vampire_mastery_passive",
                type: "periodic_collision_bonus",
                cooldown: 8,
                damageBonus: 0
            });
        }
    },
    {
        id: "gunner_lucky_shot",
        sourceFighterId: "gunner",
        name: "행운",
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
        id: "phantom_shadow_weave",
        sourceFighterId: "phantom",
        name: "그림자 직조",
        kind: "physics_modifier",
        description: "받는 명시적 넉백이 {value} 감소합니다.",
        tierValues: MASTERY_TIERS.incomingKnockbackReduce,
        formatValue(v) {
            return (v * 100).toFixed(0) + "%";
        },
        apply(ctx, level) {
            ctx.physicsModifiers.incomingKnockbackReduce += this.tierValues[level];
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
