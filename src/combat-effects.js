import { TimedEffect } from "./core.js";

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
