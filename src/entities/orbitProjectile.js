import { Projectile, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "../effects/effectVisibility.js";
import { createSteeringRebaseState } from "../physics/steeringRebase.js";

const CONVERGENCE_DURATION = 0.15;
const EXPLOSION_RADIUS = 70;

function shortestAngleDelta(from, to) {
    let delta = to - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
}

function smoothstep(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
}

export class OrbitProjectile extends Projectile {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(owner, position, direction, size, options = {}) {
        super(owner, position, new Vector2(0, 0), 11);
        this.dir = direction.clone().normalize();
        this.life = owner.ability?.getLevelUpgrade?.().explosiveVolley ? 2.4 : 1.2;
        this.angle = Math.atan2(this.dir.y, this.dir.x);
        this.size = size;
        this.elapsed = 0;
        this.accelDuration = 1;
        this.maxSpeed = owner.stats.baseSpeed * 5;
        this.slotIndex = options.slotIndex ?? null;
        this.volleyId = options.volleyId ?? null;
        this.hasHit = false;
        this.wasCaught = false;
        this.convergence = null;
        this.trail = [];
        this._staticCollisionOptions = {
            onStaticCollision: (context) => this._rebaseConvergenceAfterStaticCollision(context)
        };
    }

    update(delta, simulation) {
        this.elapsed += delta;
        const progress = Math.min(1, this.elapsed / this.accelDuration);
        const speed = progress * this.maxSpeed;
        const plannedDirection = this._getPlannedDirection(delta);
        this.applyImpulse(plannedDirection.clone().scale(speed).subtract(this.velocity));

        this._integrateAndClamp(delta, simulation);
        if (this.velocity.length() > 0) {
            this.dir = this.velocity.clone().normalize();
            this.angle = Math.atan2(this.dir.y, this.dir.x);
        }
        this._recordTrail();

        if (!this._lifecycleCheck(delta, simulation)) return;
        this._hitCheck(simulation);
        if (!this.isExpired) this._catchCheck(simulation);
    }

    beginSynchronizedConvergence(fixedPoint) {
        if (this.isExpired || this.hasHit || this.convergence) return false;
        const startDirection = this.velocity.length() > 0 ? this.velocity.clone().normalize() : this.dir.clone();
        const targetDirection = Vector2.subtract(fixedPoint, this.position).normalize();
        this.convergence = {
            elapsed: 0,
            duration: CONVERGENCE_DURATION,
            fixedPoint: fixedPoint.clone(),
            startAngle: Math.atan2(startDirection.y, startDirection.x),
            targetAngle: Math.atan2(targetDirection.y, targetDirection.x)
        };
        return true;
    }

    getStaticCollisionOptions() {
        return this._staticCollisionOptions;
    }

    _rebaseConvergenceAfterStaticCollision(context) {
        if (!this.convergence || (!context.wall && !context.terrain)) return;

        const rebase = createSteeringRebaseState({
            fixedTarget: this.convergence.fixedPoint,
            currentPosition: this.position,
            reflectedVelocity: context.postCollisionVelocity,
            duration: this.convergence.duration ?? CONVERGENCE_DURATION
        });
        this.convergence = {
            ...this.convergence,
            ...rebase
        };
    }

    _getPlannedDirection(delta) {
        if (!this.convergence) return this.dir.clone();
        const duration = this.convergence.duration ?? CONVERGENCE_DURATION;
        this.convergence.elapsed = Math.min(duration, this.convergence.elapsed + delta);
        const progress = smoothstep(this.convergence.elapsed / duration);
        const angle =
            this.convergence.startAngle +
            shortestAngleDelta(this.convergence.startAngle, this.convergence.targetAngle) * progress;
        return Vector2.fromAngle(angle, 1);
    }

    _hitCheck(simulation) {
        const target = simulation
            .getEnemiesOf(this.owner)
            .find((enemy) => Vector2.subtract(this.position, enemy.position).length() <= enemy.radius + this.radius);
        if (!target) return;

        this.hasHit = true;
        const contactPoint = this.position.clone();
        const rawDamage = this._getHitDamage();
        this.dealDamageToTarget(target, rawDamage, this.owner, this._getHitLabel(), simulation);
        this.owner.ability?.registerProjectileHit?.(this, target, contactPoint);
        this._onHitEffects(target, simulation);
        this._explodeOnHit(simulation, contactPoint);
        this.isExpired = true;
    }

    _catchCheck(simulation) {
        if (!this.owner.ability?.getLevelUpgrade?.().bodyCatch || this.wasCaught || this.slotIndex == null) return;
        const distance = Vector2.subtract(this.position, this.owner.position).length();
        if (distance > this.radius + this.owner.radius) return;

        this.wasCaught = true;
        this.owner.ability.restoreShardFromCatch(this.slotIndex, this.position);
        simulation.spawnParticleBurst(this.position.clone(), this.owner.color, {
            count: 12,
            speed: 130,
            radiusMin: 2,
            radiusMax: 4,
            upBias: 10
        });
        this.isExpired = true;
    }

    _getHitDamage() {
        const upgrade = this.owner.ability?.getLevelUpgrade?.() ?? {};
        if (upgrade.explosiveVolley) {
            return this.owner.stats.baseDamage * (this.convergence ? 1.1 : 0.9);
        }
        return this.owner.stats.baseDamage * (this.convergence ? 1 : 0.8);
    }

    _getHitLabel() {
        return this.convergence ? "Orbit Convergence" : "Orbit Shot";
    }

    _explodeOnHit(simulation, contactPoint) {
        if (!this.owner.ability?.getLevelUpgrade?.().explosiveVolley) return;
        for (const enemy of simulation.getEnemiesOf(this.owner)) {
            if (Vector2.subtract(enemy.position, contactPoint).length() > EXPLOSION_RADIUS + enemy.radius) continue;
            enemy.takeDamage(this.owner.stats.baseDamage * 0.25, this.owner, "Orbit Burst");
        }
        simulation.spawnOrbitExplosion(contactPoint.clone(), this.owner.color, EXPLOSION_RADIUS);
    }

    _onHitEffects(target, simulation) {
        target.applyKnockback(this.velocity.clone().scale(0.4), 0.15);
        simulation.spawnSlash(this.position.clone(), target.position.clone(), this.owner.color);
        simulation.addSparkBurst(this.position.clone(), this.owner.color);
        simulation.playSound("orbit");
        simulation.addLog(`${this.owner.name}'s orbit shard strikes ${target.name}.`);
    }

    _recordTrail() {
        if (!this.convergence) return;
        this.trail.push(this.position.clone());
        if (this.trail.length > 12) this.trail.shift();
    }

    draw(ctx) {
        const s = this.size ?? 16;
        ctx.save();
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.owner.color;
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
            ctx.globalAlpha = 0.65;
            ctx.beginPath();
            this.trail.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = "#ffea00";
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
    }
}
