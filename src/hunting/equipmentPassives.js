function finiteNonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export function calculateDefenseConversionAttackBonus(equipmentDefense) {
    return Math.round((finiteNonNegative(equipmentDefense) / 24) * 2) / 2;
}

export function calculateMassExecutionDamage(baseAttackDamage, effectiveMassBonus) {
    return finiteNonNegative(baseAttackDamage) * (0.5 + finiteNonNegative(effectiveMassBonus));
}

export function calculateSpeedAngularDamage(baseAttackDamage, speedIncreaseRatio) {
    return finiteNonNegative(baseAttackDamage) * finiteNonNegative(speedIncreaseRatio) * 0.35;
}

export function calculateVitalOverwhelmDamage(equipmentHp, currentHp, maximumHp) {
    const hpRatio = maximumHp > 0 ? clamp(finiteNonNegative(currentHp) / maximumHp, 0, 1) : 0;
    return Number((finiteNonNegative(equipmentHp) * (0.01 + hpRatio * 0.015)).toFixed(6));
}

class DefenseConversionPassive {
    constructor(runtime) {
        this.runtime = runtime;
    }

    getAttackDamageBonus() {
        return calculateDefenseConversionAttackBonus(this.runtime.getCombatStats()?.defense);
    }
}

class CollisionDamagePassive {
    constructor(runtime) {
        this.runtime = runtime;
    }

    get owner() {
        return this.runtime.owner;
    }

    dealDamage(target, amount, label) {
        if (amount <= 0) return null;
        return this.owner.combatEquipment?.dealEquipmentDamage(target, amount, label, {
            sourceTemplateId: this.runtime.templateId
        });
    }
}

class MassExecutionPassive extends CollisionDamagePassive {
    enemyCollisionResolved({ target, targetHpRatioBefore, isCritical }) {
        if (!isCritical || targetHpRatioBefore > 0.35) return;
        const amount = calculateMassExecutionDamage(
            this.owner.getTotalAttackDamage(),
            this.runtime.getCombatStats()?.mass?.effectiveBonus
        );
        this.dealDamage(target, amount, "종언의 추락");
    }
}

class SpeedAngularPassive extends CollisionDamagePassive {
    enemyCollisionResolved({ target }) {
        const amount = calculateSpeedAngularDamage(
            this.owner.getTotalAttackDamage(),
            this.runtime.getCombatStats()?.speed?.increaseRatio
        );
        this.dealDamage(target, amount, "천공의 나선");
    }
}

class VitalOverwhelmPassive extends CollisionDamagePassive {
    enemyCollisionResolved({ target }) {
        const amount = calculateVitalOverwhelmDamage(
            this.runtime.getCombatStats()?.hp,
            this.owner.hp,
            this.owner.maxHp
        );
        this.dealDamage(target, amount, "적룡의 심갑");
    }
}

export const EQUIPMENT_PASSIVE_FACTORIES = Object.freeze({
    defense_conversion: DefenseConversionPassive,
    mass_execution: MassExecutionPassive,
    speed_angular: SpeedAngularPassive,
    vital_overwhelm: VitalOverwhelmPassive
});
