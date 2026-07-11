export const LEVEL_REWARD_EFFECT_TYPES = Object.freeze({
    STAT: "stat",
    ABILITY_MODIFIER: "ability_modifier"
});

const STAT_LABELS = Object.freeze({
    hp: "HP",
    damage: "공격",
    speed: "속도",
    skill: "스킬",
    defense: "방어력"
});

const STAT_MUTATORS = Object.freeze({
    hp(ball, value) {
        ball.maxHp += value;
        ball.hp += value;
    },
    damage(ball, value) {
        ball.stats.baseDamage += value;
    },
    speed(ball, value) {
        ball.stats.baseSpeed += value;
    },
    skill(ball, value) {
        ball.stats.allocation ||= {};
        ball.stats.allocation.skill = (ball.stats.allocation.skill ?? 0) + value;
    },
    defense(ball, value) {
        ball.stats.baseDefense += value;
    }
});

const ABILITY_MODIFIER_OPERATIONS = Object.freeze({
    add(current, value) {
        return current + value;
    },
    multiply(current, value) {
        return current * value;
    }
});

const EFFECT_HANDLERS = Object.freeze({
    [LEVEL_REWARD_EFFECT_TYPES.STAT]: {
        describe(effect) {
            const label = STAT_LABELS[effect.stat];
            if (!label || !Number.isFinite(effect.value)) throw new Error(`Invalid stat reward: ${effect.stat}`);
            return `${label} +${effect.value}`;
        },
        applyToBall(ball, effect) {
            const mutate = STAT_MUTATORS[effect.stat];
            if (!mutate || !Number.isFinite(effect.value)) throw new Error(`Invalid stat reward: ${effect.stat}`);
            mutate(ball, effect.value);
        }
    },
    [LEVEL_REWARD_EFFECT_TYPES.ABILITY_MODIFIER]: {
        describe(effect) {
            if (!effect.abilityId || !effect.modifierId || !Number.isFinite(effect.value)) {
                throw new Error("Invalid ability modifier reward");
            }
            return `${effect.abilityId} · ${effect.modifierId} ${effect.operation === "multiply" ? "x" : "+"}${effect.value}`;
        },
        applyToBall(ball, effect) {
            const applyOperation = ABILITY_MODIFIER_OPERATIONS[effect.operation ?? "add"];
            if (!applyOperation || !effect.abilityId || !effect.modifierId || !Number.isFinite(effect.value)) {
                throw new Error("Invalid ability modifier reward");
            }
            ball.levelRewardModifiers ||= {};
            const modifiers = ball.levelRewardModifiers[effect.abilityId] ?? {};
            const initialValue = effect.operation === "multiply" ? 1 : 0;
            ball.levelRewardModifiers[effect.abilityId] = {
                ...modifiers,
                [effect.modifierId]: applyOperation(modifiers[effect.modifierId] ?? initialValue, effect.value)
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
    effects.forEach((effect) => getLevelRewardEffectHandler(effect).applyToBall(ball, effect));
}
