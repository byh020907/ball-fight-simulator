import { CHARACTER_DEFINITIONS } from "../characters/characterRegistry.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MASTERY_TIERS = REWARD_BALANCE.progression.masteryTiers;
const MASTERY_RUNTIME = REWARD_BALANCE.progression.masteryRuntime;

function formatMasteryValue(format, value) {
    if (format === "percentPoint2") return `${(value * 100).toFixed(2)}%p`;
    return `${(value * 100).toFixed(0)}%`;
}

function applyRageMastery(definition, ctx, level) {
    ctx.combatPassives.push({
        id: "rage_mastery_passive",
        cooldown: 12,
        onBeforeFighterCollisionDamage: ({ simulation, attacker, outgoingDamage }) => {
            if (outgoingDamage <= 0) return { outgoingDamage, consumed: false };
            simulation.spawnActionText(
                attacker.position.clone(),
                `숙련도 +${(definition.tierValues[level] * 100).toFixed(0)}%`,
                "#ff4444"
            );
            return {
                outgoingDamage: Math.round(outgoingDamage * (1 + definition.tierValues[level])),
                consumed: true
            };
        }
    });
}

function applyVampireMastery(definition, ctx, level) {
    ctx.combatPassives.push({
        id: "vampire_mastery_passive",
        cooldown: MASTERY_RUNTIME.vampire.cooldown,
        onAfterFighterCollisionDamage: ({ simulation, attacker, actualOutgoingDamage }) => {
            const missingHp = Math.max(0, attacker.maxHp - attacker.hp);
            if (actualOutgoingDamage <= 0 || missingHp <= 0) return { consumed: false };
            const missingHpRatio = missingHp / Math.max(1, attacker.maxHp);
            const restoreMultiplier = 1 + missingHpRatio * (MASTERY_RUNTIME.vampire.missingHpMultiplierMax - 1);
            const restored = attacker.heal(actualOutgoingDamage * definition.tierValues[level] * restoreMultiplier);
            if (restored <= 0) return { consumed: false };
            simulation.spawnActionText(attacker.position.clone(), `숙련도 +${restored} HP`, "#44cc66");
            return { consumed: true };
        }
    });
}

function createMasteryDefinition(character) {
    const metadata = character.mastery;
    const definition = {
        id: metadata.id,
        sourceFighterId: character.id,
        name: metadata.name,
        kind: metadata.kind,
        description: metadata.description,
        tierValues: MASTERY_TIERS[metadata.tierKey],
        formatValue(value) {
            return formatMasteryValue(metadata.format, value);
        },
        apply(ctx, level) {
            if (metadata.runtime === "rage") return applyRageMastery(this, ctx, level);
            if (metadata.runtime === "vampire") return applyVampireMastery(this, ctx, level);
            ctx[metadata.target][metadata.modifierKey] += this.tierValues[level];
        }
    };
    if (!definition.tierValues) throw new Error(`Missing mastery tier values for ${character.id}`);
    return Object.freeze(definition);
}

export const MASTERY_EFFECT_DEFS = Object.freeze(CHARACTER_DEFINITIONS.map(createMasteryDefinition));

export const TIER_LABELS = Object.freeze(["미해금", "BRONZE", "SILVER", "GOLD"]);

export const TIER_DESCRIPTIONS = Object.freeze({
    0: "해금 조건: {name} 난도 0 토너먼트 우승",
    1: "다음 등급 SILVER\n승급 조건: {name} 난도 1 토너먼트 우승",
    2: "다음 등급 GOLD\n승급 조건: {name} 난도 2 토너먼트 우승",
    3: "최대 등급"
});
