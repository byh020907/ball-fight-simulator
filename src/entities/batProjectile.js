import { CombatEntity, Projectile, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "../effects/effectVisibility.js";

const BAT_RADIUS = 10;
const BAT_LIFE = 4.0;
const MAX_SPEED_MULT = 1.5;
const BASE_BITE_DAMAGE_MULTIPLIER = 0.2;
const REPEAT_BITE_DAMAGE_MULTIPLIER = 0.05;
const BITE_LIFESTEAL_RATE = 0.7;
const BITE_COOLDOWN = 1;
const BITE_RECOIL_SPEED = 240;
const HOMING_LOCK_DURATION = 0.15;
const LIFE_BURST_RADIUS = 65;
const LIFE_BURST_DAMAGE_MULTIPLIER = 0.05;
const EXPIRATION_WARNING_DURATION = 0.28;

// Boids weights (px/s/s accelerations, frame-rate independent)
const COHESION_WEIGHT = 5;
const ALIGNMENT_WEIGHT = 8;
const SEPARATION_WEIGHT = 30;
const SEPARATION_RADIUS = 24;
const TARGET_ATTRACTION_WEIGHT = 10;

// Flutter
const FLUTTER_FREQ = 28;
const FLUTTER_AMP = 6;

class BloodBiteEffect extends CombatEntity {
    constructor(position, normal) {
        super(position.clone(), new Vector2(), 12);
        this.normal = normal.clone();
        this.angle = Math.atan2(normal.y, normal.x);
        this.life = 0.28;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const alpha = Math.max(0, 1 - this.lifeProgress);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ed2856";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.6);
        ctx.beginPath();
        ctx.arc(0, 0, 8, -0.95, 0.95);
        ctx.stroke();
        ctx.fillStyle = "#a90f36";
        for (const [x, y, radius] of [
            [7, -5, 2],
            [11, 1, 1.5],
            [6, 6, 1.2]
        ]) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class BloodBatBurstEffect extends CombatEntity {
    constructor(position) {
        super(position.clone(), new Vector2(), LIFE_BURST_RADIUS);
        this.life = 0.42;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#8d1235";
        for (const angle of [-1.15, -0.3, 0.55, 1.4, 2.25]) {
            const distance = 8 + progress * 42;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(-2, -2);
            ctx.lineTo(-8, -6);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-8, 6);
            ctx.lineTo(-2, 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.strokeStyle = "#d51f4c";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2);
        ctx.beginPath();
        ctx.arc(0, 0, 10 + progress * 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

export class BatProjectile extends Projectile {
    constructor(owner, position, velocity, flock, options = {}) {
        super(owner, position, velocity, BAT_RADIUS);
        this.life = options.life ?? BAT_LIFE;
        this.maxLife = this.life;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.time = 0;
        this._flock = flock;
        this._ability = options.ability ?? null;
        this._repeatBite = Boolean(options.repeatBite);
        this._lifeBurst = Boolean(options.lifeBurst);
        this._lastBiteAt = new WeakMap();
        this._homingLockedUntil = 0;
        this._lifetimeBurstTriggered = false;
    }

    get isHomingLocked() {
        return this.time < this._homingLockedUntil;
    }

    update(delta, simulation) {
        if (this.isExpired) return;
        this.time += delta;
        const target = this._findTarget(simulation);

        if (!this.isHomingLocked) {
            this._applyGuidance(delta, target);
        }
        this._integrateFlutter(delta);
        simulation.keepEntityInsideArena(this);
        if (!this._lifecycleCheck(delta, simulation)) {
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
        this._hitCheck(simulation);
    }

    _applyGuidance(delta, target) {
        const nextVelocity = this.velocity.clone().add(this._computeBoidsForce(delta));
        if (target && !target.flags.defeated) {
            const toTarget = Vector2.subtract(target.position, this.position).normalize();
            nextVelocity.add(toTarget.scale(TARGET_ATTRACTION_WEIGHT * 60 * delta));
        }
        const maxSpeed = this.owner.stats.baseSpeed * MAX_SPEED_MULT;
        if (nextVelocity.length() > maxSpeed) nextVelocity.normalize().scale(maxSpeed);
        this.applyImpulse(Vector2.subtract(nextVelocity, this.velocity));
    }

    _integrateFlutter(delta) {
        const flutter = Math.sin(this.time * FLUTTER_FREQ) * FLUTTER_AMP * delta;
        this.position.add(this.velocity.clone().scale(delta));
        const perpendicular = new Vector2(-this.velocity.y, this.velocity.x).normalize();
        this.position.add(perpendicular.scale(flutter));
    }

    _computeBoidsForce(delta) {
        if (!this._flock || this._flock.length < 2) return new Vector2(0, 0);

        let cohesion = new Vector2(0, 0);
        let alignment = new Vector2(0, 0);
        let separation = new Vector2(0, 0);
        let neighborCount = 0;

        for (const other of this._flock) {
            if (other === this || other.isExpired || other.isExpired === undefined) continue;
            const difference = Vector2.subtract(other.position, this.position);
            const distance = difference.length();
            if (distance > 150) continue;

            neighborCount++;
            cohesion.add(other.position);
            alignment.add(other.velocity);

            if (distance < SEPARATION_RADIUS && distance > 0.1) {
                separation.subtract(
                    difference
                        .clone()
                        .normalize()
                        .scale(1 / distance)
                );
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

    _hitCheck(simulation) {
        const targets = simulation.getEnemiesOf?.(this.owner) ?? [];
        for (const target of targets) {
            if (target.flags.defeated || !this._isTouching(target) || !this._canBite(target)) continue;
            this._bite(target, simulation);
            if (!this._repeatBite) {
                this.isExpired = true;
                return;
            }
        }
    }

    _isTouching(target) {
        return Vector2.subtract(this.position, target.position).length() <= target.radius + this.radius;
    }

    _canBite(target) {
        return this.time - (this._lastBiteAt.get(target) ?? -Infinity) >= BITE_COOLDOWN;
    }

    _bite(target, simulation) {
        this._lastBiteAt.set(target, this.time);
        const normal = this._getContactNormal(target);
        const contactPoint = Vector2.add(target.position, normal.clone().scale(target.radius));
        const damageResult = this._dealBiteDamage(target, simulation);
        this._spawnBiteFeedback(contactPoint, normal, simulation);
        simulation.playSound("hit");
        simulation.addLog(
            `${this.owner.name}'s bat drains ${target.name} for ${damageResult.actualDamage} and heals ${damageResult.healedAmount}.`
        );

        if (!this._repeatBite) return;
        this.applyImpulse(normal.clone().scale(BITE_RECOIL_SPEED));
        this._homingLockedUntil = this.time + HOMING_LOCK_DURATION;
        if (damageResult.actualDamage > 0) {
            this._ability?.onBatBite(target, contactPoint);
        }
    }

    _getContactNormal(target) {
        const normal = Vector2.subtract(this.position, target.position);
        if (normal.length() > 0.001) return normal.normalize();
        if (this.velocity.length() > 0.001) return this.velocity.clone().normalize().scale(-1);
        return Vector2.subtract(this.owner.position, target.position).normalize();
    }

    _dealBiteDamage(target, simulation) {
        const rawDamage = this._getHitDamage();
        if (this._ability) {
            return this._ability.dealVampireDamage(target, rawDamage, this._getHitLabel(), { projectile: this });
        }
        const finalDamage =
            target.actionContext?.onProjectileDamage?.(
                rawDamage,
                this,
                this.owner,
                this._getHitLabel(),
                simulation,
                target
            ) ?? rawDamage;
        const { actualDamage } = target.takeDamage(finalDamage, this.owner, this._getHitLabel());
        const healedAmount = actualDamage > 0 ? this.owner.heal(actualDamage * BITE_LIFESTEAL_RATE) : 0;
        return { actualDamage, healedAmount };
    }

    _spawnBiteFeedback(contactPoint, normal, simulation) {
        simulation.entities.push(new BloodBiteEffect(contactPoint, normal));
        simulation.spawnParticleBurst(contactPoint, "#b5123f", {
            count: 5,
            speed: 90,
            radiusMin: 1,
            radiusMax: 2,
            gravity: 240,
            direction: normal,
            spread: Math.PI * 0.65
        });
    }

    _getHitDamage() {
        const multiplier = this._repeatBite ? REPEAT_BITE_DAMAGE_MULTIPLIER : BASE_BITE_DAMAGE_MULTIPLIER;
        return this.owner.stats.baseDamage * multiplier;
    }

    _getHitLabel() {
        return "Bat Bite";
    }

    _onExpired(simulation) {
        if (!this._lifeBurst || this._lifetimeBurstTriggered) return;
        this._lifetimeBurstTriggered = true;
        const center = this.position.clone();
        for (const target of simulation.getEnemiesOf(this.owner)) {
            const distance = Vector2.subtract(target.position, center).length();
            if (distance > LIFE_BURST_RADIUS + target.radius) continue;
            this._ability?.dealVampireDamage(
                target,
                this.owner.stats.baseDamage * LIFE_BURST_DAMAGE_MULTIPLIER,
                "Bat Life Burst"
            );
        }
        simulation.entities.push(new BloodBatBurstEffect(center));
        simulation.spawnParticleBurst(center, "#8d1235", {
            count: 9,
            speed: 125,
            radiusMin: 1,
            radiusMax: 3,
            gravity: 180
        });
    }

    draw(ctx) {
        this._drawRecoilTrail(ctx);
        this._drawBat(ctx);
    }

    _drawRecoilTrail(ctx) {
        if (!this.isHomingLocked || this.velocity.length() <= 0) return;
        const direction = this.velocity.clone().normalize();
        ctx.save();
        ctx.strokeStyle = "rgba(181, 18, 63, 0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(this.position.x - direction.x * 8, this.position.y - direction.y * 8);
        ctx.lineTo(this.position.x - direction.x * 32, this.position.y - direction.y * 32);
        ctx.stroke();
        ctx.restore();
    }

    _drawBat(ctx) {
        const expirationProgress = this._lifeBurst
            ? Math.max(0, Math.min(1, 1 - this.life / EXPIRATION_WARNING_DURATION))
            : 0;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        const contraction = 1 - expirationProgress * 0.42;
        ctx.scale(contraction, contraction);
        this._drawExpirationMist(ctx, expirationProgress);
        this._drawWings(ctx, expirationProgress);
        this._drawBody(ctx, expirationProgress);
        this._drawEyes(ctx);
        ctx.restore();
    }

    _drawExpirationMist(ctx, progress) {
        if (progress <= 0) return;
        ctx.fillStyle = `rgba(151, 18, 52, ${progress * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 0, 12 + progress * 8, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawWings(ctx, expirationProgress) {
        const flap = Math.sin(this.time * 20);
        const wingScale = (0.5 + Math.abs(flap) * 0.5) * (1 - expirationProgress * 0.8);
        const wingLift = Math.sin(this.time * 20) * 3 * (1 - expirationProgress);
        ctx.fillStyle = "#331122";
        ctx.beginPath();
        ctx.moveTo(wingLift, -3);
        ctx.quadraticCurveTo(-wingScale * 12 - 3, -9 * wingScale - 3, -3, -16 * wingScale);
        ctx.quadraticCurveTo(wingLift + 2, -10 * wingScale, wingLift, -3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-wingLift, 3);
        ctx.quadraticCurveTo(wingScale * 12 + 3, 9 * wingScale + 3, 3, 16 * wingScale);
        ctx.quadraticCurveTo(-wingLift - 2, 10 * wingScale, -wingLift, 3);
        ctx.fill();
    }

    _drawBody(ctx, expirationProgress) {
        ctx.fillStyle = expirationProgress > 0 ? "#7d1836" : "#442233";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.owner.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    _drawEyes(ctx) {
        const glow = Math.sin(this.time * 8) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 60, 80, ${glow})`;
        for (const y of [-1.8, 1.8]) {
            ctx.beginPath();
            ctx.arc(5.5, y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = "#ffccdd";
        for (const y of [-1.8, 1.8]) {
            ctx.beginPath();
            ctx.arc(5.5, y, 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
