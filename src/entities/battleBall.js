import { RENDER_LAYERS, TimedEffect, Vector2 } from "../core.js";
import { ActionContext } from "../clickActions.js";

const BASE_VELOCITY_CORRECTION_RATE = 5.5;

export class BattleBall {
    constructor(spec, position) {
        this.id = spec.id;
        this.name = spec.name;
        this.title = spec.title;
        this.description = spec.description;
        this.color = spec.color;
        this.face = spec.face ?? spec.id;
        this.maxHp = spec.stats.hp;
        this.hp = spec.stats.hp;
        this.baseDamage = spec.stats.damage;
        this.baseDefense = spec.stats.defense;
        this.baseSpeed = spec.stats.speed;
        this.baseRadius = spec.stats.radius;
        this.radius = spec.stats.radius;
        this.mass = spec.stats.mass;
        this.position = position;
        this.velocity = Vector2.fromAngle(Math.random() * Math.PI * 2, 120 + Math.random() * 90);
        this.slowEffect = null;
        this.speedBoost = null;
        this.forcedHeading = null;
        this.movementEffect = null;
        this.swallowedState = null;
        this.wallSlamState = null;
        this.flags = {};
        this.bounced = false;
        this.ability = null;
        this.isDefeated = false;
        this.isDestroyed = false;
        this.spinRotation = 0;
        this.statAllocation = spec.statAllocation ?? null;
        this.heroOrbBonuses = { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 };
        this.heroOrbCarryover = { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 };
        this.masteryPhysicsModifiers = spec.masteryPhysicsModifiers ?? {
            incomingKnockbackReduce: 0,
            outgoingImpactBonus: 0,
            velocityRecoveryBonus: 0
        };
        this.masteryActionModifiers = spec.masteryActionModifiers ?? {
            hpCostPercentReduction: 0,
            minHpCostPercent: 0
        };
        this.masteryCombatPassives = spec.masteryCombatPassives ?? [];
        this.actionContext = new ActionContext();
        this.renderScale = 1;
    }

    get renderLayer() {
        return RENDER_LAYERS.FIGHTER;
    }

    bindAbility(ability) {
        this.ability = ability;
    }

    getStatModifiers() {
        return this.ability ? this.ability.getStatModifiers() : { speed: 1, damage: 1, defense: 1, impact: 1 };
    }

    setSpeedBoost(duration, multiplier, color = this.color) {
        this.speedBoost = { effect: new TimedEffect(duration), multiplier, color };
    }

    forceHeading(direction, duration) {
        this.forcedHeading = {
            effect: new TimedEffect(duration),
            direction: direction.clone().normalize()
        };
    }

    applyKnockback(velocity, duration) {
        this.forceHeading(velocity, duration);
        this.applyImpulse(velocity);
    }

    setMovementEffect(effect) {
        this.movementEffect = effect;
    }

    clearDash() {
        this.movementEffect = null;
        this.forcedHeading = null;
        this.speedBoost = null;
    }

    freezeForResult() {
        this.applyImpulse(this.velocity.clone().scale(-1));
        this.clearDash();
        this.slowEffect = null;
        this.swallowedState = null;
        this.wallSlamState = null;
    }

    destroyForResult() {
        this.freezeForResult();
        this.isDefeated = true;
        this.isDestroyed = true;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    getAbilityUiState() {
        return this.ability?.getUiState?.() ?? { label: "Passive", progress: 1 };
    }

    initState() {
        this.bounced = false;
    }

    update(delta, simulation) {
        if (this.isDefeated) return;
        this.initState();

        if (this.swallowedState) {
            this.position = this.swallowedState.owner.position.clone();
            this.applyImpulse(this.velocity.clone().scale(-1));
            return;
        }

        const target = simulation.getOpponent(this);
        this._tickTimers(delta);
        this._tickMasteryPassives(delta);
        this.ability?.update(delta, target);
        this.radius = this.baseRadius * (this.ability?.getRadiusScale?.() ?? 1);
        this._applyVelocityCorrection(simulation, delta);
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepInsideArena(this);
        if (this.bounced) this.forcedHeading = null;
    }

    _tickMasteryPassives(delta) {
        if (!this._masteryPassiveStates) {
            this._masteryPassiveStates = this.masteryCombatPassives.map((def) => ({
                id: def.id,
                type: def.type,
                damageBonus: def.damageBonus ?? 0,
                cooldownRemaining: 0,
                cooldownDuration: def.cooldown ?? 0,
                active: false
            }));
        }
        for (const state of this._masteryPassiveStates) {
            if (state.active) continue;
            state.cooldownRemaining -= delta;
            if (state.cooldownRemaining <= 0) {
                state.active = true;
                state.cooldownRemaining = state.cooldownDuration;
            }
        }
    }

    /** 충돌 시 숙련도 패시브 적용. 충돌 핸들러에서 호출. */
    consumeMasteryCollisionBonus() {
        let bonus = 0;
        for (const state of this._masteryPassiveStates ?? []) {
            if (!state.active || state.type !== "periodic_collision_bonus") continue;
            bonus += state.damageBonus;
            state.active = false;
        }
        return bonus;
    }

    _tickTimers(delta) {
        const tick = (effect, onFinish) => {
            if (!effect) return;
            effect.tick(delta);
            if (effect.finished) onFinish();
        };
        tick(this.slowEffect, () => (this.slowEffect = null));
        tick(this.speedBoost?.effect, () => (this.speedBoost = null));
        tick(this.forcedHeading?.effect, () => (this.forcedHeading = null));
        if (this.movementEffect) {
            this.movementEffect.tick(this, delta);
            if (this.movementEffect.expired) {
                this.movementEffect = null;
                if (this.forcedHeading) this.forcedHeading = null;
            }
        }
        if (this.wallSlamState) {
            if (this.wallSlamState.tick(this, delta)) {
                this.wallSlamState = null;
            }
        }
        this.actionContext.tickTimers(this, delta);
    }

    _applyVelocityCorrection(simulation, delta) {
        const desiredVelocity = this._computeDesiredVelocity(simulation);
        const velocityBonus = 1 + (this.masteryPhysicsModifiers?.velocityRecoveryBonus ?? 0);
        const effectiveRate = BASE_VELOCITY_CORRECTION_RATE * velocityBonus;
        const correction = 1 - Math.exp(-effectiveRate * delta);
        this.applyImpulse(Vector2.subtract(desiredVelocity, this.velocity).scale(correction));
    }

    _computeDesiredVelocity(simulation) {
        const modifiers = this.getStatModifiers();
        const slowMult = this.slowEffect ? this.slowEffect.amount : 1;
        const boostMult = this.speedBoost ? this.speedBoost.multiplier : 1;
        const movementSpeed = this.movementEffect?.getSpeed(this);
        const currentDir =
            this.velocity.length() > 0
                ? this.velocity.clone().normalize()
                : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const direction = this.forcedHeading ? this.forcedHeading.direction.clone() : currentDir;
        return direction.scale(
            movementSpeed ??
                this.speedBoost?.speedOverride ??
                this.baseSpeed * modifiers.speed * slowMult * boostMult * simulation.getSpeedMultiplier(this)
        );
    }

    applyImpulse(impulse) {
        this.velocity.add(impulse);
    }

    applySlow(duration, amount) {
        this.slowEffect = new TimedEffect(duration);
        this.slowEffect.amount = amount;
    }

    takeDamage(amount, source, label = "Hit") {
        if (this.isDefeated) return { actualDamage: 0 };
        amount = this.actionContext.onDamageTaken(amount, source, label);
        const abilityDefMult = this.getStatModifiers().defense;
        const totalDefense = Math.round(this.baseDefense * abilityDefMult);
        const hpBefore = this.hp;
        const rawActual = Math.max(1, Math.round(amount - totalDefense));
        const actual = Math.min(rawActual, hpBefore);
        this.hp = Math.max(0, this.hp - actual);
        const actualDamage = hpBefore - this.hp;
        const sim = source?.simulation ?? this.simulation;
        if (sim && actualDamage > 0) {
            sim.hooks?.onDamageTaken?.(this.id, actualDamage);
            if (source) sim.hooks?.onDamageDealt?.(source.id, actualDamage);
            sim.hooks?.onHpChanged?.(this.id, this.hp, this.maxHp);
        }
        if (label !== "Wall Slam") {
            sim?.shakeScreen?.(0.16, Math.min(18, 7 + actual * 0.55));
        }
        if (label !== "Crash") {
            sim?.playSound?.("hit", Math.min(1.8, 0.7 + actual / 18));
        }
        if (actual >= 1 && sim) {
            sim.spawnDamageNumber(this.position.clone(), Math.round(actual), "#ff3333");
        }
        if (actual >= 10) {
            sim?.addLog?.(`${label} lands on ${this.name} for ${Math.round(actual)} damage.`);
        }
        if (this.hp <= 0) {
            this.isDefeated = true;
        }
        return { actualDamage };
    }

    draw(ctx) {
        if (this.isDestroyed || this.swallowedState) return;
        ctx.save();
        const scale = this.renderScale;
        if (scale !== 1) {
            ctx.translate(this.position.x, this.position.y);
            ctx.scale(scale, scale);
            ctx.translate(-this.position.x, -this.position.y);
            ctx.globalAlpha *= scale;
        }
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(3, this.radius * 0.07);
        ctx.stroke();
        this.drawFace(ctx, this.wallSlamState ? this.spinRotation : 0);
        this.ability?.draw?.(ctx);
        if (this.movementEffect?.showRing) {
            ctx.strokeStyle = this.movementEffect.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
        }
        this._drawNameplate(ctx);
        ctx.restore();
    }

    _drawNameplate(ctx) {
        if (this.isDestroyed) return;
        const y = this.position.y + this.radius + 18;
        ctx.save();
        ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#444444";
        ctx.fillText(this.name, this.position.x, y);
        ctx.restore();
    }

    drawFace(ctx, rotation = 0) {
        const r = this.radius;
        const x = this.position.x;
        const y = this.position.y;
        const time = performance.now() / 1000;
        const bob = Math.sin(time * 5 + x * 0.01) * r * 0.025;
        ctx.save();
        ctx.translate(x, y + bob);
        ctx.rotate(rotation);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#202020";
        ctx.fillStyle = "#202020";
        ctx.lineWidth = Math.max(3, r * 0.075);
        if (!this.ability?.drawFace?.(ctx, rotation, this)) {
            this._drawDefaultFace(ctx);
        }
        ctx.restore();
    }

    _drawDefaultFace(ctx) {
        const r = this.radius;
        const time = performance.now() / 1000;
        const blink = Math.sin(time * 2.6 + this.position.y * 0.01) > 0.93 ? 0.22 : 1;
        const dotEye = (ex, ey, size = 0.055) => {
            ctx.beginPath();
            ctx.ellipse(ex * r, ey * r, size * r, size * r * blink, 0, 0, Math.PI * 2);
            ctx.fill();
        };
        const arc = (cx, cy, radius, start, end) => {
            ctx.beginPath();
            ctx.arc(cx * r, cy * r, radius * r, start, end);
            ctx.stroke();
        };
        dotEye(-0.22, -0.08, 0.052);
        dotEye(0.22, -0.08, 0.052);
        arc(0, 0.16, 0.2, 0.1, Math.PI - 0.1);
    }
}
