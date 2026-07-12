export const LEVEL_REWARD_EFFECT_TYPES = Object.freeze({
    STAT: "stat",
    ABILITY_TIER: "ability_tier"
});

const STAT_LABELS = Object.freeze({
    hp: "HP",
    damage: "공격",
    speed: "속도",
    skill: "스킬",
    defense: "방어력"
});

const BASE_STAT_MUTATORS = Object.freeze({
    hp(spec, value) {
        spec.stats.hp += value;
    },
    damage(spec, value) {
        spec.stats.damage += value;
    },
    speed(spec, value) {
        spec.stats.speed += value;
    },
    skill(spec, value) {
        spec.stats.skill = (spec.stats.skill ?? 0) + value;
    },
    defense(spec, value) {
        spec.stats.defense += value;
    }
});

const MAX_ABILITY_TIER = 3;

function isValidAbilityTier(tier) {
    return Number.isInteger(tier) && tier >= 1 && tier <= MAX_ABILITY_TIER;
}

const EFFECT_HANDLERS = Object.freeze({
    [LEVEL_REWARD_EFFECT_TYPES.STAT]: {
        describe(effect) {
            const label = STAT_LABELS[effect.stat];
            if (!label || !Number.isFinite(effect.value)) throw new Error(`Invalid stat reward: ${effect.stat}`);
            return `${label} +${effect.value}`;
        },
        applyToBaseSpec(spec, effect) {
            const mutate = BASE_STAT_MUTATORS[effect.stat];
            if (!mutate || !Number.isFinite(effect.value)) throw new Error(`Invalid stat reward: ${effect.stat}`);
            mutate(spec, effect.value);
        }
    },
    [LEVEL_REWARD_EFFECT_TYPES.ABILITY_TIER]: {
        describe(effect) {
            if (!isValidAbilityTier(effect.tier)) throw new Error(`Invalid ability tier reward: ${effect.tier}`);
            if (typeof effect.gameText !== "string" || !effect.gameText.trim()) {
                throw new Error(`Missing game text for ability tier reward: ${effect.tier}`);
            }
            return effect.gameText;
        },
        applyToBall(ball, effect) {
            if (!isValidAbilityTier(effect.tier)) {
                throw new Error(`Invalid ability tier reward: ${effect.tier}`);
            }
            ball.progression = {
                ...ball.progression,
                abilityTier: Math.max(ball.progression?.abilityTier ?? 0, effect.tier)
            };
        }
    }
});

export function getLevelRewardEffectHandler(effect) {
    const handler = EFFECT_HANDLERS[effect?.type];
    if (!handler) throw new Error(`Unknown level reward effect: ${effect?.type ?? "missing"}`);
    return handler;
}

export function getLevelRewardEffectText(effect) {
    return getLevelRewardEffectHandler(effect).describe(effect);
}

export function applyLevelRewardEffectsToBall(ball, effects = []) {
    effects.forEach((effect) => getLevelRewardEffectHandler(effect).applyToBall?.(ball, effect));
}

export function applyLevelRewardEffectsToBaseSpec(spec, effects = []) {
    const nextSpec = { ...spec, stats: { ...spec.stats } };
    effects.forEach((effect) => getLevelRewardEffectHandler(effect).applyToBaseSpec?.(nextSpec, effect));
    return nextSpec;
}
