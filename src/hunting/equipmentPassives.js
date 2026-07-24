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

export function calculateVitalHeatTickDamage(equipmentHp) {
    return finiteNonNegative(equipmentHp) * 0.015;
}

export function calculateWallRicochetDamage(baseAttackDamage, effectiveWallBounceBonus) {
    return finiteNonNegative(baseAttackDamage) * (0.25 + finiteNonNegative(effectiveWallBounceBonus));
}

export function calculateWallHeatDamage(baseAttackDamage, effectiveWallBounceBonus) {
    return finiteNonNegative(baseAttackDamage) * (0.25 + finiteNonNegative(effectiveWallBounceBonus) * 0.5);
}

export function calculateVortexChargeDamage(baseAttackDamage, effectiveAngularImpulseBonus) {
    return finiteNonNegative(baseAttackDamage) * (0.35 + finiteNonNegative(effectiveAngularImpulseBonus) * 0.5);
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

class VitalHeatPassive extends CollisionDamagePassive {
    constructor(runtime) {
        super(runtime);
        runtime.charge.maximum = 3;
        runtime.charge.current = 1;
        this.rechargeElapsed = 0;
        this.active = false;
        this.ticksRemaining = 0;
        this.nextTickRemaining = 0;
    }

    update({ delta, simulation }) {
        const elapsed = finiteNonNegative(delta);
        this.rechargeElapsed += elapsed;
        while (this.rechargeElapsed >= 3) {
            this.rechargeElapsed -= 3;
            this.runtime.charge.gain();
        }

        let remaining = elapsed;
        let starts = this._startHeatField(simulation) ? 1 : 0;
        while (this.active && remaining > 0) {
            const step = Math.min(remaining, this.nextTickRemaining);
            remaining -= step;
            this.nextTickRemaining -= step;
            if (this.nextTickRemaining > 1e-9) break;
            this._dealTick(simulation);
            this.ticksRemaining -= 1;
            if (this.ticksRemaining > 0) {
                this.nextTickRemaining = 0.2;
                continue;
            }
            this.active = false;
            if (starts >= 2 || !this._startHeatField(simulation)) break;
            starts += 1;
        }
    }

    _startHeatField(simulation) {
        if (this.active || !this.runtime.charge.current || this._getEnemies(simulation).length === 0) return false;
        this.runtime.charge.consume();
        this.active = true;
        this.ticksRemaining = 4;
        this.nextTickRemaining = 0.2;
        return true;
    }

    _dealTick(simulation) {
        const amount = calculateVitalHeatTickDamage(this.runtime.getCombatStats()?.hp);
        for (const enemy of this._getEnemies(simulation)) this.dealDamage(enemy, amount, "홍련의 맥동");
    }

    _getEnemies(simulation) {
        return getEnemiesAtContactPoint(simulation, this.owner, this.owner.position, 150);
    }
}

class WallRicochetPassive extends CollisionDamagePassive {
    constructor(runtime) {
        super(runtime);
        runtime.charge.maximum = 2;
        this.elapsed = 0;
        this.lastBounceAt = null;
    }

    update({ delta }) {
        this.elapsed += finiteNonNegative(delta);
    }

    staticBounce() {
        if (this.lastBounceAt !== null && this.elapsed - this.lastBounceAt < 0.4) return;
        this.lastBounceAt = this.elapsed;
        this.runtime.charge.gain();
    }

    enemyCollisionResolved({ target }) {
        if (!target || !this.runtime.charge.consume()) return;
        this.dealDamage(
            target,
            calculateWallRicochetDamage(
                this.owner.getTotalAttackDamage(),
                this.runtime.getCombatStats()?.wallBounce?.effectiveBonus
            ),
            "되튀는 초승달"
        );
    }
}

class WallHeatPassive extends CollisionDamagePassive {
    constructor(runtime) {
        super(runtime);
        runtime.charge.maximum = 3;
        this.acquireCooldown = new runtime.cooldown.constructor(1);
    }

    update({ delta, simulation }) {
        this.acquireCooldown.tick(delta);
        this.runtime.cooldown.tick(delta);
        if (!this.runtime.cooldown.ready || !this.runtime.charge.current) return;
        const enemies = getEnemiesAtContactPoint(simulation, this.owner, this.owner.position, 260);
        if (enemies.length === 0 || !this.runtime.charge.consume()) return;
        this.runtime.cooldown.trigger(1);
        const amount = calculateWallHeatDamage(
            this.owner.getTotalAttackDamage(),
            this.runtime.getCombatStats()?.wallBounce?.effectiveBonus
        );
        for (const enemy of enemies) this.dealDamage(enemy, amount, "화염심장 성채");
    }

    staticBounce() {
        if (!this.acquireCooldown.ready) return;
        this.runtime.charge.gain();
        this.acquireCooldown.trigger(1);
    }
}

class VortexChargePassive extends CollisionDamagePassive {
    constructor(runtime) {
        super(runtime);
        runtime.distance = new runtime.distance.constructor(1200);
    }

    validMovement({ distance, source }) {
        this.runtime.distance.add(distance, source);
    }

    enemyCollisionResolved({ target, contactPoint, simulation }) {
        if (!target || !this.runtime.distance.consumeThreshold()) return;
        const amount = calculateVortexChargeDamage(
            this.owner.getTotalAttackDamage(),
            this.runtime.getCombatStats()?.angularImpulse?.effectiveBonus
        );
        for (const enemy of getEnemiesAtContactPoint(simulation, this.owner, contactPoint, 180)) {
            this.dealDamage(enemy, amount, "폭풍의 윤환");
        }
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
    vital_overwhelm: VitalOverwhelmPassive,
    vital_heat: VitalHeatPassive,
    wall_ricochet: WallRicochetPassive,
    wall_heat: WallHeatPassive,
    vortex_charge: VortexChargePassive
});
