import { TimedEffect, Vector2 } from "./core.js";
import { applyRotationalContactDamage, calculateStaticCollisionDamage } from "./physics/contactDamage.js";

export class DashEffect {
    constructor({
        duration,
        multiplier,
        speedOverride = null,
        color,
        showRing = true,
        collisionDamage = 0,
        collisionLabel = "Dash",
        collisionSlow = null,
        untilImpact = false,
        untilWall = false
    }) {
        this.effect = new TimedEffect(duration);
        this.multiplier = multiplier;
        this.speedOverride = speedOverride;
        this.color = color;
        this.showRing = showRing;
        this.collisionDamage = collisionDamage;
        this.collisionLabel = collisionLabel;
        this.collisionSlow = collisionSlow;
        this.untilImpact = untilImpact;
        this.untilWall = untilWall;
        this.expired = false;
    }

    getSpeed(ball) {
        return this.speedOverride ?? ball.stats.baseSpeed * this.multiplier;
    }

    tick(ball, delta) {
        this.effect.tick(delta);
        if (this.effect.finished) {
            this.expired = true;
        }
    }

    onCollision(attacker, defender, simulation, contactPoint) {
        if (this.collisionDamage > 0) {
            const dmg = contactPoint
                ? applyRotationalContactDamage(this.collisionDamage, attacker, contactPoint)
                : this.collisionDamage;
            defender.takeDamage(dmg, attacker, this.collisionLabel);
        }
        if (this.collisionSlow) {
            defender.applySlow(this.collisionSlow.duration, this.collisionSlow.amount);
        }
        attacker.abilities.onDashHit(defender, this, { contactPoint });
        if (this.untilImpact) {
            this.expired = true;
        }
    }

    onWallBounce(ball, simulation) {
        if (this.untilWall) {
            ball.abilities.onDashWall(this);
            this.expired = true;
        }
    }
}

export class PeriodicDamageEffect {
    constructor({ duration, interval, ticks, damage, source, label, color = "#44cc66" }) {
        this.duration = duration;
        this.interval = interval;
        this.maximumTicks = ticks;
        this.damage = damage;
        this.source = source;
        this.label = label;
        this.color = color;
        this.elapsed = 0;
        this.tickTimer = 0;
        this.tickCount = 0;
        this.pulse = 0;
        this.finished = false;
    }

    tick(target, delta) {
        if (this.finished) return;
        const activeDelta = Math.min(delta, Math.max(0, this.duration - this.elapsed));
        this.elapsed += activeDelta;
        this.tickTimer += activeDelta;
        this.pulse = Math.max(0, this.pulse - delta);

        while (this.tickTimer + 1e-9 >= this.interval && this.tickCount < this.maximumTicks) {
            this.tickTimer -= this.interval;
            this.tickCount += 1;
            this.pulse = 0.08;
            target.takeDamage(this.damage, this.source, this.label);
        }

        this.finished = this.elapsed + 1e-9 >= this.duration || this.tickCount >= this.maximumTicks;
    }

    draw(ctx, target) {
        const progress = Math.min(1, this.elapsed / this.duration);
        const tighten = this.pulse > 0 ? this.pulse / 0.08 : 0;
        const radius = target.radius + 7 - tighten * 4;
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3 + tighten * 2;
        ctx.globalAlpha = 0.85 * (1 - progress * 0.35);
        for (const offset of [-0.28, 0.28]) {
            ctx.beginPath();
            ctx.arc(
                target.position.x,
                target.position.y,
                radius,
                Math.PI * (0.18 + offset + progress * 0.25),
                Math.PI * (1.38 + offset + progress * 0.25)
            );
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class WallSlamEffect {
    constructor({ source, duration, onRupture = null, getDamageMultiplier = null, onImpact = null }) {
        this.effect = new TimedEffect(duration);
        this.source = source;
        this.cooldown = 0;
        this.angularImpulseApplied = false;
        this.onRupture = onRupture;
        this.getDamageMultiplier = getDamageMultiplier;
        this.onImpact = onImpact;
    }

    tick(ball, delta) {
        this.effect.tick(delta);
        this.cooldown = Math.max(0, this.cooldown - delta);
        this._applyPhysicalAngularImpulse(ball);
        return this.effect.finished;
    }

    onWallBounce(ball, normal, simulation, contactPoint, preCollisionVelocity = null) {
        if (this.cooldown > 0) return;

        const impactContext = { ball, normal, simulation, contactPoint, preCollisionVelocity };
        const rawDamage = calculateStaticCollisionDamage({
            source: this.source,
            impactBody: ball,
            normal,
            contactPoint,
            preCollisionVelocity,
            damageMultiplier: simulation.getDamageMultiplier?.() ?? 1
        });
        if (rawDamage <= 0) return;

        const damageMultiplier = Math.max(0, this.getDamageMultiplier?.(impactContext) ?? 1);
        const { actualDamage } = ball.takeDamage(rawDamage * damageMultiplier, this.source, "Wall Slam");
        this.cooldown = 0.2;

        if (this.onRupture) {
            this.onRupture({ ...impactContext, rawDamage, damageMultiplier, actualDamage });
        } else {
            simulation.spawnWallImpact(
                contactPoint?.clone?.() ?? ball.position.clone(),
                normal ?? ball.velocity.clone().normalize().scale(-1),
                this.source?.color ?? ball.color
            );
            simulation.playSound("wall", 1.15);
            simulation.shakeScreen(0.24, 16);
        }
        simulation.addLog(`${ball.name} takes wall slam damage.`);
        this.onImpact?.({ ...impactContext, rawDamage, damageMultiplier, actualDamage });
    }

    onTerrainCollision(ball, normal, simulation, contactPoint, preCollisionVelocity = null) {
        this.onWallBounce(ball, normal, simulation, contactPoint, preCollisionVelocity);
    }

    _applyPhysicalAngularImpulse(ball) {
        if (this.angularImpulseApplied) return;
        if (ball.rotationEnabled === false) return;
        if (typeof ball.applyAngularImpulse !== "function") return;
        this.angularImpulseApplied = true;

        const impulse = calculateWallSlamAngularImpulse(ball);

        if (Number.isFinite(impulse) && impulse !== 0) {
            ball.applyAngularImpulse(impulse);
        }
    }
}

export function calculateWallSlamAngularImpulse(ball) {
    const speed = ball.velocity.length();
    const radius = Math.max(1, ball.radius ?? 1);
    const sign = ball.velocity.x >= 0 ? 1 : -1;
    const desiredOmega = sign * Math.min(14, Math.max(5, (speed / radius) * 1.2));
    const inverseMoment = ball._inverseMomentOfInertia;
    if (Number.isFinite(inverseMoment) && inverseMoment > 0) {
        return desiredOmega / inverseMoment;
    }
    return (ball.mass ?? 1) * radius * speed * 0.35 * sign;
}
