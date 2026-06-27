import { Projectile, Vector2 } from "../core.js";

const BAT_RADIUS = 12;
const BAT_LIFE = 1.8;
const WOBBLE_FREQ = 4;
const WOBBLE_AMP = 60;
const FLUTTER_FREQ = 22;
const FLUTTER_AMP = 20;
const HOMING_STRENGTH = 3;
const RANDOM_JITTER_INTERVAL = 0.15;

export class BatProjectile extends Projectile {
    constructor(owner, position, velocity) {
        super(owner, position, velocity, BAT_RADIUS);
        this.life = BAT_LIFE;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.time = 0;
        this._perp = new Vector2(-velocity.y, velocity.x).normalize();
        this._jitterTimer = 0;
        this._jitterOffset = 0;
    }

    update(delta, simulation) {
        this.time += delta;

        const target = this._findTarget(simulation);

        // erratic bat flight: wobble + flutter + homing + random jitter
        const wobble = Math.sin(this.time * WOBBLE_FREQ) * WOBBLE_AMP;
        const flutter = Math.sin(this.time * FLUTTER_FREQ) * FLUTTER_AMP;

        this._jitterTimer -= delta;
        if (this._jitterTimer <= 0) {
            this._jitterTimer = RANDOM_JITTER_INTERVAL;
            this._jitterOffset = (Math.random() - 0.5) * 2;
        }

        const lateralOffset = (wobble + flutter + this._jitterOffset * 15) * delta;
        this.position.add(Vector2.add(this.velocity.clone().scale(delta), this._perp.clone().scale(lateralOffset)));

        // slight homing toward target
        if (target && !target.isDefeated) {
            const toTarget = Vector2.subtract(target.position, this.position).normalize();
            this.velocity.add(toTarget.clone().scale(HOMING_STRENGTH * delta));
            const speed = this.velocity.length();
            const maxSpeed = this.owner.baseSpeed * 3.5;
            if (speed > maxSpeed) this.velocity.scale(maxSpeed / speed);
        }

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
        const flap = Math.sin(this.time * 20);
        const wingSpread = 0.5 + Math.abs(flap) * 0.5;
        const wingLift = Math.sin(this.time * 20) * 4;

        // Wing shadows (lower wings)
        ctx.fillStyle = "#331122";
        ctx.beginPath();
        ctx.moveTo(-3, wingLift);
        ctx.quadraticCurveTo(-10 * wingSpread - 4, -wingSpread * 14 - 4, -18 * wingSpread, -4);
        ctx.quadraticCurveTo(-12 * wingSpread, wingLift + 2, -3, wingLift);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(3, wingLift);
        ctx.quadraticCurveTo(10 * wingSpread + 4, -wingSpread * 14 - 4, 18 * wingSpread, -4);
        ctx.quadraticCurveTo(12 * wingSpread, wingLift + 2, 3, wingLift);
        ctx.fill();

        // Body
        ctx.fillStyle = "#442233";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner body (owner color tint)
        ctx.fillStyle = this.owner.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Eyes (glowing red)
        const glow = Math.sin(this.time * 8) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 60, 80, ${glow})`;
        ctx.beginPath();
        ctx.arc(4, -1.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-4, -1.5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye pupils (white core)
        ctx.fillStyle = "#ffccdd";
        ctx.beginPath();
        ctx.arc(4, -1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-4, -1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
