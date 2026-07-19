import { Projectile, RENDER_LAYERS, Vector2 } from "../core.js";
import { HERO_COMBAT_CONFIG } from "../abilities/heroCombatConfig.js";

const TRAIL_SAMPLE_INTERVAL = 0.04;
const TRAIL_SAMPLE_LIFETIME = 0.18;

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
        this.updateProjectile(delta, simulation);
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
        simulation.spawnParticleBurst(this.position.clone(), "#ffd84d", {
            count: 14,
            speed: 180,
            radiusMin: 2,
            radiusMax: 4
        });
        simulation.addSparkBurst(this.position.clone(), "#fff4b8");
        simulation.playSound("hit", 1.15);
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
        ctx.globalAlpha = 1;
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = "#ffe66b";
        ctx.strokeStyle = "#8f6200";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.35, 0);
        ctx.lineTo(this.radius * 0.35, -this.radius);
        ctx.lineTo(-this.radius, -this.radius * 0.62);
        ctx.lineTo(-this.radius, this.radius * 0.62);
        ctx.lineTo(this.radius * 0.35, this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
