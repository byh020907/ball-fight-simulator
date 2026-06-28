import { Projectile, Vector2 } from "../core.js";
import { DashEffect } from "../combatEffects.js";

export class SeedOrb extends Projectile {
    constructor(owner, position, velocity, life) {
        super(owner, position, velocity, 14);
        this.life = life;
    }

    update(delta, simulation) {
        if (this.tickLife(delta)) this.integrate(delta);
        simulation.keepEntityInsideArena(this);
        if (this.life <= 0) {
            this.isExpired = true;
        }

        for (const fighter of simulation.fighters) {
            if (fighter.flags.defeated) continue;
            const distance = Vector2.subtract(this.position, fighter.position).length();
            if (distance > this.radius + fighter.radius) continue;
            this._onHitEffects(fighter, simulation);
            this.isExpired = true;
            break;
        }
    }

    _onHitEffects(target, simulation) {
        const opponent = simulation.getOpponent(this.owner);
        const dashDirection = opponent
            ? Vector2.subtract(opponent.position, this.owner.position).normalize()
            : this.velocity.clone().normalize();
        this.owner.initiateDash(dashDirection, {
            duration: 1.55,
            multiplier: 2.05,
            collisionDamage: Math.round(this.owner.stats.baseDamage * 0.9),
            collisionLabel: "Seed Dash"
        });
        simulation.spawnSlash(
            this.owner.position.clone(),
            Vector2.add(this.owner.position, dashDirection.clone().scale(150)),
            this.owner.color
        );
        simulation.spawnPulse(this.position.clone(), this.owner.color);
        simulation.playSound("dash");
        simulation.addLog(`${target?.name ?? "Someone"} catches a seed and triggers ${this.owner.name}'s dash.`);
        simulation.addSparkBurst(this.position.clone(), this.owner.color);
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}
