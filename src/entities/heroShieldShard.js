import { Projectile, RENDER_LAYERS, Vector2 } from "../core.js";
import { HERO_COMBAT_CONFIG } from "../abilities/heroCombatConfig.js";
import { drawProjectileSlashVisual } from "../effects/projectileSlashVisual.js";

const TRAIL_SAMPLE_INTERVAL = 0.04;
const TRAIL_SAMPLE_LIFETIME = 0.18;
const IMPACT_TRAIL_SAMPLE_COUNT = 7;

export class HeroShieldShard extends Projectile {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(owner, position, direction, damage) {
        const velocity = direction
            .clone()
            .normalize()
            .scale(owner.stats.baseSpeed * HERO_COMBAT_CONFIG.counter.speedMultiplier);
        super(owner, position, velocity, HERO_COMBAT_CONFIG.counter.radius);
        this.damage = damage;
        this.life = HERO_COMBAT_CONFIG.counter.lifetime;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.trail = [];
        this.trailTimer = 0;
        this.impactRemaining = 0;
        this._staticCollisionOptions = {
            onStaticCollision: () => {
                this.isExpired = true;
            }
        };
    }

    getStaticCollisionOptions() {
        return this._staticCollisionOptions;
    }

    update(delta, simulation) {
        if (this.impactRemaining > 0) {
            this.impactRemaining = Math.max(0, this.impactRemaining - delta);
            this._updateTrail(delta);
            if (this.impactRemaining <= 0) this.isExpired = true;
            return;
        }
        this.updateProjectile(delta, simulation);
        if (this.impactRemaining > 0) this.isExpired = false;
        this._updateTrail(delta);
    }

    _updateTrail(delta) {
        this.trailTimer -= delta;
        if (this.trailTimer <= 0) {
            this.trailTimer += TRAIL_SAMPLE_INTERVAL;
            this.trail.push({ position: this.position.clone(), life: TRAIL_SAMPLE_LIFETIME });
        }
        this.trail.forEach((sample) => (sample.life -= delta));
        this.trail = this.trail.filter((sample) => sample.life > 0);
    }

    _findTarget(simulation) {
        return simulation
            .getEnemiesOf(this.owner)
            .find((enemy) => Vector2.subtract(this.position, enemy.position).length() <= enemy.radius + this.radius);
    }

    _getHitDamage() {
        return this.damage;
    }

    _getHitLabel() {
        return "Hero Shield Counter";
    }

    dealDamageToTarget(target, rawDamage, source, label, simulation) {
        const final =
            target.actionContext?.onProjectileDamage?.(rawDamage, this, source, label, simulation, target) ?? rawDamage;
        target.takeDamage(final, source, label, { suppressReactiveEffects: true });
    }

    _onHitEffects(target, simulation) {
        this.impactRemaining = HERO_COMBAT_CONFIG.counter.impactVisualDuration;
        this.applyImpulse(this.velocity.clone().scale(-1));
        this._seedImpactTrail();
        simulation.spawnParticleBurst(this.position.clone(), "#ffd84d", {
            count: 14,
            speed: 180,
            radiusMin: 2,
            radiusMax: 4
        });
        simulation.addSparkBurst(this.position.clone(), "#fff4b8");
        simulation.playSound("hit", 1.15);
    }

    _seedImpactTrail() {
        const direction = Vector2.fromAngle(this.angle, 1);
        for (const index of Array.from({ length: IMPACT_TRAIL_SAMPLE_COUNT }, (_, value) => value)) {
            this.trail.push({
                position: Vector2.subtract(this.position, direction.clone().scale(index * this.radius * 0.85)),
                life: TRAIL_SAMPLE_LIFETIME * (1 - index / (IMPACT_TRAIL_SAMPLE_COUNT * 1.5))
            });
        }
    }

    draw(ctx) {
        ctx.save();
        this.trail.forEach((sample, index) => {
            const progress = sample.life / TRAIL_SAMPLE_LIFETIME;
            const size = 2 + progress * 3;
            ctx.globalAlpha = progress * 0.55;
            ctx.fillStyle = index % 2 === 0 ? "#ffd84d" : "#fff4b8";
            ctx.beginPath();
            ctx.arc(sample.position.x, sample.position.y, size, 0, Math.PI * 2);
            ctx.fill();
        });
        let slashAlpha = 1;
        let slashScale = 1;
        if (this.impactRemaining > 0) {
            const impactProgress = this.impactRemaining / HERO_COMBAT_CONFIG.counter.impactVisualDuration;
            slashAlpha = impactProgress;
            slashScale = 1 + (1 - impactProgress) * 0.65;
        }
        ctx.restore();
        drawProjectileSlashVisual(ctx, this.position, this.angle, this.radius, {
            alpha: slashAlpha,
            scale: slashScale
        });
    }
}
