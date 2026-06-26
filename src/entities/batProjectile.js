import { Projectile, Vector2 } from "../core.js";

export class BatProjectile extends Projectile {
    constructor(owner, position, velocity) {
        super(owner, position, velocity, 7);
        this.life = 1.5;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.time = 0;
        this._perp = new Vector2(-velocity.y, velocity.x).normalize();
    }

    update(delta, simulation) {
        this.time += delta;
        const swoop = Math.sin(this.time * 10) * 40;
        this.position.add(Vector2.add(this.velocity.clone().scale(delta), this._perp.clone().scale(swoop * delta)));
        simulation.keepEntityInsideArena(this);
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
            simulation.spawnParticleBurst(this.position.clone(), "#441122", {
                count: 6,
                speed: 100,
                radiusMin: 1,
                radiusMax: 3,
                gravity: 200
            });
            return;
        }
        this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        this._projectileHitCheck(simulation);
    }

    _findTarget(simulation) {
        return simulation.getOpponent(this.owner);
    }

    _getHitDamage() {
        return Math.round(this.owner.baseDamage * 0.35);
    }

    _getHitLabel() {
        return "Bat Bite";
    }

    _onHitEffects(target, simulation) {
        const healAmount = Math.round(this._getHitDamage() * 0.7);
        this.owner.heal(healAmount);
        simulation.spawnActionText(this.owner.position.clone(), `+${healAmount} HP`, "#44ff44");
        simulation.spawnExplosion(this.position.clone(), "#cc3355");
        simulation.playSound("hit");
        simulation.addLog(
            `${this.owner.name}'s bat drains ${target.name} for ${this._getHitDamage()} and heals ${healAmount}.`
        );
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        const wingAngle = Math.sin(this.time * 20) * 0.6 + 0.3;
        const flap = Math.sin(this.time * 20);

        // Wing shadow (lower wings)
        ctx.fillStyle = "#331122";
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.quadraticCurveTo(-6 - Math.abs(flap) * 4, -wingAngle * 8, -12, -2);
        ctx.quadraticCurveTo(-8, 0, -2, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.quadraticCurveTo(6 + Math.abs(flap) * 4, -wingAngle * 8, 12, -2);
        ctx.quadraticCurveTo(8, 0, 2, 0);
        ctx.fill();

        // Body
        ctx.fillStyle = "#442233";
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner body (owner color tint)
        ctx.fillStyle = this.owner.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Eyes (glowing red)
        const glow = Math.sin(this.time * 8) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 60, 80, ${glow})`;
        ctx.beginPath();
        ctx.arc(2.5, -1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-2.5, -1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye pupils (white core)
        ctx.fillStyle = "#ffccdd";
        ctx.beginPath();
        ctx.arc(2.5, -1, 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-2.5, -1, 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
