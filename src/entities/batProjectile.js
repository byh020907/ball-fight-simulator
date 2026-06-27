import { Projectile, Vector2 } from "../core.js";

const BAT_RADIUS = 12;
const BAT_LIFE = 1.8;
const HOMING_STRENGTH = 4;
const MAX_SPEED_MULT = 3.5;
const DART_INTERVAL_MIN = 0.06;
const DART_INTERVAL_MAX = 0.18;
const DART_STRENGTH = 40;
const FLUTTER_FREQ = 28;
const FLUTTER_AMP = 8;

export class BatProjectile extends Projectile {
    constructor(owner, position, velocity) {
        super(owner, position, velocity, BAT_RADIUS);
        this.life = BAT_LIFE;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.time = 0;
        this._dartTimer = 0;
        this._dartDir = new Vector2(0, 0);
        this._perp = new Vector2(-velocity.y, velocity.x).normalize();
    }

    update(delta, simulation) {
        this.time += delta;

        const target = this._findTarget(simulation);

        // random dart: sharp direction change at irregular intervals
        this._dartTimer -= delta;
        if (this._dartTimer <= 0) {
            this._dartTimer = DART_INTERVAL_MIN + Math.random() * (DART_INTERVAL_MAX - DART_INTERVAL_MIN);
            this._dartDir = new Vector2((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
        }

        // forward velocity
        const forward = this.velocity.clone().scale(delta);

        // dart impulse + flutter oscillation
        const dartDelta = this._dartDir.clone().scale(DART_STRENGTH * delta);
        const flutter = Math.sin(this.time * FLUTTER_FREQ) * FLUTTER_AMP * delta;

        this.position.add(Vector2.add(forward, dartDelta));
        this.position.add(this._perp.clone().scale(flutter));

        // homing toward target
        if (target && !target.isDefeated) {
            const toTarget = Vector2.subtract(target.position, this.position).normalize();
            this.velocity.add(toTarget.clone().scale(HOMING_STRENGTH * delta));
            const maxSpeed = this.owner.baseSpeed * MAX_SPEED_MULT;
            if (this.velocity.length() > maxSpeed) {
                this.velocity.normalize().scale(maxSpeed);
            }
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
