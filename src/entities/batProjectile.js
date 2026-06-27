import { Projectile, Vector2 } from "../core.js";

const BAT_RADIUS = 10;
const BAT_LIFE = 4.0;
const MAX_SPEED_MULT = 1.5;

// Boids weights (px/s/s accelerations, frame-rate independent)
const COHESION_WEIGHT = 5;
const ALIGNMENT_WEIGHT = 8;
const SEPARATION_WEIGHT = 30;
const SEPARATION_RADIUS = 24;
const TARGET_ATTRACTION_WEIGHT = 10;

// Flutter
const FLUTTER_FREQ = 28;
const FLUTTER_AMP = 6;

export class BatProjectile extends Projectile {
    constructor(owner, position, velocity, flock) {
        super(owner, position, velocity, BAT_RADIUS);
        this.life = BAT_LIFE;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.time = 0;
        this._flock = flock;
    }

    update(delta, simulation) {
        this.time += delta;

        const target = this._findTarget(simulation);

        // Boids forces
        const boidsForce = this._computeBoidsForce(delta);
        this.velocity.add(boidsForce);

        // target attraction
        if (target && !target.isDefeated) {
            const toTarget = Vector2.subtract(target.position, this.position).normalize();
            this.velocity.add(toTarget.clone().scale(TARGET_ATTRACTION_WEIGHT * 60 * delta));
            const maxSpeed = this.owner.baseSpeed * MAX_SPEED_MULT;
            if (this.velocity.length() > maxSpeed) {
                this.velocity.normalize().scale(maxSpeed);
            }
        }

        // flutter oscillation
        const flutter = Math.sin(this.time * FLUTTER_FREQ) * FLUTTER_AMP * delta;
        const forward = this.velocity.clone().scale(delta);
        this.position.add(forward);
        const perp = new Vector2(-this.velocity.y, this.velocity.x).normalize();
        this.position.add(perp.scale(flutter));

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
        if (target && !target.isDefeated) {
            this.angle = Math.atan2(target.position.y - this.position.y, target.position.x - this.position.x);
        } else {
            this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        }
        this._projectileHitCheck(simulation);
    }

    _computeBoidsForce(delta) {
        if (!this._flock || this._flock.length < 2) return new Vector2(0, 0);

        let cohesion = new Vector2(0, 0);
        let alignment = new Vector2(0, 0);
        let separation = new Vector2(0, 0);
        let neighborCount = 0;

        for (const other of this._flock) {
            if (other === this || other.isExpired || other.isExpired === undefined) continue;
            const diff = Vector2.subtract(other.position, this.position);
            const dist = diff.length();
            if (dist > 150) continue; // ignore far boids

            neighborCount++;
            cohesion.add(other.position);
            alignment.add(other.velocity);

            if (dist < SEPARATION_RADIUS && dist > 0.1) {
                const repulse = diff
                    .clone()
                    .normalize()
                    .scale(1 / dist);
                separation.subtract(repulse);
            }
        }

        if (neighborCount === 0) return new Vector2(0, 0);

        cohesion.scale(1 / neighborCount);
        cohesion.subtract(this.position);
        cohesion.normalize().scale(COHESION_WEIGHT * 60 * delta);

        alignment.scale(1 / neighborCount);
        alignment.normalize().scale(ALIGNMENT_WEIGHT * 60 * delta);

        separation.scale(SEPARATION_WEIGHT * 60 * delta);

        return Vector2.add(Vector2.add(cohesion, alignment), separation);
    }

    _findTarget(simulation) {
        return simulation.getOpponent(this.owner);
    }

    _getHitDamage() {
        return Math.round(this.owner.baseDamage * 0.2);
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
        const ws = 0.5 + Math.abs(flap) * 0.5;
        const wl = Math.sin(this.time * 20) * 3;

        // ── Left wing (extends upward, perpendicular to body) ──
        ctx.fillStyle = "#331122";
        ctx.beginPath();
        ctx.moveTo(wl, -3);
        ctx.quadraticCurveTo(-ws * 12 - 3, -9 * ws - 3, -3, -16 * ws);
        ctx.quadraticCurveTo(wl + 2, -10 * ws, wl, -3);
        ctx.fill();

        // ── Right wing (extends downward, perpendicular to body) ──
        ctx.beginPath();
        ctx.moveTo(-wl, 3);
        ctx.quadraticCurveTo(ws * 12 + 3, 9 * ws + 3, 3, 16 * ws);
        ctx.quadraticCurveTo(-wl - 2, 10 * ws, -wl, 3);
        ctx.fill();

        // ── Body ──
        ctx.fillStyle = "#442233";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.owner.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // ── Eyes at front (positive X = forward) ──
        const glow = Math.sin(this.time * 8) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 60, 80, ${glow})`;
        ctx.beginPath();
        ctx.arc(5.5, -1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5.5, 1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffccdd";
        ctx.beginPath();
        ctx.arc(5.5, -1.8, 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5.5, 1.8, 0.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
