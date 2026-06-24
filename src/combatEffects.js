import { TimedEffect } from "./core.js";

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
        return this.speedOverride ?? ball.baseSpeed * this.multiplier;
    }

    tick(ball, delta) {
        this.effect.tick(delta);
        if (this.effect.finished) {
            this.expired = true;
        }
    }

    onCollision(attacker, defender, simulation) {
        if (this.collisionDamage > 0) {
            defender.takeDamage(this.collisionDamage, attacker, this.collisionLabel);
        }
        if (this.collisionSlow) {
            defender.applySlow(this.collisionSlow.duration, this.collisionSlow.amount);
        }
        attacker.ability?.onDashHit?.(defender, this);
        if (this.untilImpact) {
            this.expired = true;
        }
    }

    onWallBounce(ball, simulation) {
        if (this.untilWall) {
            ball.ability?.onDashWall?.(this);
            this.expired = true;
        }
    }
}

export class WallSlamEffect {
    constructor({ source, damage, duration }) {
        this.effect = new TimedEffect(duration);
        this.source = source;
        this.damage = damage;
        this.cooldown = 0;
    }

    tick(ball, delta) {
        this.effect.tick(delta);
        this.cooldown = Math.max(0, this.cooldown - delta);
        this.updateSpin(ball, delta);
        return this.effect.finished;
    }

    onWallBounce(ball, normal, simulation) {
        if (this.cooldown > 0) {
            return;
        }

        this.cooldown = 0.18;
        ball.takeDamage(this.damage, this.source, "Wall Slam");
        simulation.spawnWallImpact(
            ball.position.clone(),
            normal ?? ball.velocity.clone().normalize().scale(-1),
            this.source?.color ?? ball.color
        );
        simulation.playSound("wall", 1.15);
        simulation.shakeScreen(0.24, 16);
        simulation.addLog(`${ball.name} takes wall slam damage.`);
    }

    updateSpin(ball, delta) {
        const spinDirection = ball.velocity.x >= 0 ? 1 : -1;
        ball.spinRotation +=
            spinDirection * Math.max(8, ball.velocity.length() / Math.max(1, ball.radius)) * delta * 1.55;
    }
}
