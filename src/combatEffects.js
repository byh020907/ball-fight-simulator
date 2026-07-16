import { TimedEffect, Vector2 } from "./core.js";
import { applyRotationalContactDamage } from "./physics/contactDamage.js";

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
        attacker.abilities.onDashHit(defender, this);
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

export class WallSlamEffect {
    constructor({ source, damage, duration, onRupture = null }) {
        this.effect = new TimedEffect(duration);
        this.source = source;
        this.damage = damage;
        this.cooldown = 0;
        this.angularImpulseApplied = false;
        this.onRupture = onRupture;
    }

    tick(ball, delta) {
        this.effect.tick(delta);
        this.cooldown = Math.max(0, this.cooldown - delta);
        this._applyPhysicalAngularImpulse(ball);
        return this.effect.finished;
    }

    onWallBounce(ball, normal, simulation, contactPoint) {
        if (this.cooldown > 0) return;

        this.cooldown = 0.18;
        ball.takeDamage(this.damage, this.source, "Wall Slam");

        if (this.onRupture) {
            this.onRupture({ normal, contactPoint });
        } else {
            simulation.spawnWallImpact(
                ball.position.clone(),
                normal ?? ball.velocity.clone().normalize().scale(-1),
                this.source?.color ?? ball.color
            );
            simulation.playSound("wall", 1.15);
            simulation.shakeScreen(0.24, 16);
        }
        simulation.addLog(`${ball.name} takes wall slam damage.`);
    }

    onTerrainCollision(ball, normal, simulation, contactPoint) {
        this.onWallBounce(ball, normal, simulation, contactPoint);
    }

    _applyPhysicalAngularImpulse(ball) {
        if (this.angularImpulseApplied) return;
        if (ball.rotationEnabled === false) return;
        if (typeof ball.applyAngularImpulse !== "function") return;
        this.angularImpulseApplied = true;

        const speed = ball.velocity.length();
        const radius = Math.max(1, ball.radius ?? 1);
        const sign = ball.velocity.x >= 0 ? 1 : -1;
        const desiredOmega = sign * Math.min(14, Math.max(5, (speed / radius) * 1.2));

        const invI = ball._inverseMomentOfInertia;
        let impulse;
        if (Number.isFinite(invI) && invI > 0) {
            impulse = desiredOmega / invI;
        } else {
            impulse = (ball.mass ?? 1) * radius * speed * 0.35 * sign;
        }

        if (Number.isFinite(impulse) && impulse !== 0) {
            ball.applyAngularImpulse(impulse);
        }
    }
}
