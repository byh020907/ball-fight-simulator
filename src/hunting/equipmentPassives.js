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

export function calculateAbilityCritDamage(baseAttackDamage, equipmentCriticalChance) {
    return (
        finiteNonNegative(baseAttackDamage) *
        (0.25 + clamp(finiteNonNegative(equipmentCriticalChance) / 100, 0, 1) * 0.5)
    );
}

export function calculatePursuitFlurryDamage(baseAttackDamage) {
    return finiteNonNegative(baseAttackDamage) * 0.25;
}

export function calculateMassShockwaveDamage(baseAttackDamage, effectiveMassBonus) {
    return finiteNonNegative(baseAttackDamage) * (0.2 + finiteNonNegative(effectiveMassBonus));
}

export function calculateAbilityEchoDamage(baseAttackDamage) {
    return finiteNonNegative(baseAttackDamage) * 0.5;
}

export function getEnemiesAtContactPoint(simulation, owner, contactPoint, radius) {
    if (!simulation?.getEnemiesOf || !contactPoint) return [];
    const radiusSquared = finiteNonNegative(radius) ** 2;
    return simulation.getEnemiesOf(owner).filter((target) => {
        const dx = (target.position?.x ?? Infinity) - contactPoint.x;
        const dy = (target.position?.y ?? Infinity) - contactPoint.y;
        return dx * dx + dy * dy <= radiusSquared;
    });
}

export function isActiveHostileTarget(simulation, owner, target) {
    return Boolean(
        target &&
        !target.flags?.defeated &&
        !target.flags?.destroyed &&
        !target.state?.swallowed &&
        !target.isExpired &&
        simulation?.isHostile?.(owner, target)
    );
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

class AbilityCritPassive extends CollisionDamagePassive {
    abilityUsed() {
        this.runtime.window.open(4);
    }

    update({ delta }) {
        this.runtime.window.tick(delta);
    }

    enemyCollisionResolved({ target, contactPoint, simulation }) {
        if (!this.runtime.window.active || !target) return;
        this.runtime.window.close();
        const amount = calculateAbilityCritDamage(
            this.owner.getTotalAttackDamage(),
            this.runtime.getCombatStats()?.criticalChance
        );
        for (const enemy of getEnemiesAtContactPoint(simulation, this.owner, contactPoint, 120)) {
            this.dealDamage(enemy, amount, "별을 꿰는 서약");
        }
    }
}

class PursuitFlurryPassive extends CollisionDamagePassive {
    update({ delta }) {
        this.runtime.window.tick(delta);
        this.runtime.cooldown.tick(delta);
    }

    enemyCollisionResolved({ target }) {
        if (!target || !this.runtime.cooldown.ready) return;
        if (!this.runtime.window.active) {
            this.runtime.window.open(1.5);
            return;
        }
        this.runtime.window.close();
        this.runtime.cooldown.trigger(1.5);
        const amount = calculatePursuitFlurryDamage(this.owner.getTotalAttackDamage());
        this.dealDamage(target, amount, "쌍익의 질풍 좌참격");
        this.dealDamage(target, amount, "쌍익의 질풍 우참격");
    }
}

class MassShockwavePassive extends CollisionDamagePassive {
    update({ delta }) {
        this.runtime.cooldown.tick(delta);
    }

    enemyCollisionResolved({ contactPoint, isCritical, simulation }) {
        if (!isCritical || !this.runtime.cooldown.ready) return;
        this.runtime.cooldown.trigger(1.5);
        const amount = calculateMassShockwaveDamage(
            this.owner.getTotalAttackDamage(),
            this.runtime.getCombatStats()?.mass?.effectiveBonus
        );
        for (const enemy of getEnemiesAtContactPoint(simulation, this.owner, contactPoint, 180)) {
            this.dealDamage(enemy, amount, "낙성의 파문");
        }
    }
}

class AbilityEchoPassive extends CollisionDamagePassive {
    abilityUsed() {
        this.runtime.charge.gain();
    }

    update({ delta, simulation }) {
        this.runtime.delayedActions.tick(delta, ({ target }) => {
            if (!isActiveHostileTarget(simulation, this.owner, target)) return;
            this.dealDamage(target, calculateAbilityEchoDamage(this.owner.getTotalAttackDamage()), "쌍성의 메아리");
        });
    }

    enemyCollisionResolved({ target }) {
        if (!target || !this.runtime.charge.consume()) return;
        this.runtime.delayedActions.schedule(0.12, { target });
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
    ability_crit: AbilityCritPassive,
    pursuit_flurry: PursuitFlurryPassive,
    defense_conversion: DefenseConversionPassive,
    mass_execution: MassExecutionPassive,
    mass_shockwave: MassShockwavePassive,
    speed_angular: SpeedAngularPassive,
    ability_echo: AbilityEchoPassive,
    vital_overwhelm: VitalOverwhelmPassive
});
