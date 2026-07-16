import { Ability } from "./ability.js";
import { Vector2 } from "../core.js";
import { getRebirthVisualProfile } from "../rebirth/rebirthVisuals.js";

const CHARGE_THRESHOLD_PARTICLES = 0.22;
const PARTICLE_BASE_INTERVAL = 0.15;
const PARTICLE_INTERVAL_REDUCTION = 0.07;
const PARTICLE_BASE_COUNT = 1;
const PARTICLE_COUNT_PER_CHARGE = 3;
const PARTICLE_BASE_SPEED = 90;
const PARTICLE_SPEED_PER_CHARGE = 90;
const SPEED_BASE = 0.78;
const SPEED_PER_CHARGE = 0.2;
const DAMAGE_BASE = 0.96;
const DAMAGE_PER_CHARGE = 0.04;
const IMPACT_BASE = 0.9;
const IMPACT_PER_CHARGE = 0.1;

const IGNITE_DURATION = 0.5;
const IGNITE_TICK_COUNT = 10;
const IGNITE_TICK_INTERVAL = IGNITE_DURATION / IGNITE_TICK_COUNT;
const IGNITE_DAMAGE_PER_TICK = 0.075;

const EXPLOSION_RADIUS = 120;
const EXPLOSION_DAMAGE_MULT = 1.5;

const AFTERSHOCK_DELAY = 0.35;
const AFTERSHOCK_RADIUS = 180;
const AFTERSHOCK_DAMAGE_MULT = 2.25;
const AFTERSHOCK_CENTER_IMPULSE = 1200;
const AFTERSHOCK_EDGE_IMPULSE = 600;

export class RageAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.state = {
            particleTimer: 0,
            timeWithoutCollision: 0,
            aftershock: null
        };
        this._baseMaxChargeTime = 14.0;
    }

    getMaxChargeTime() {
        const skill = this.owner.getSkillPoints?.() ?? this.owner.stats?.allocation?.skill ?? 0;
        const factor = 100 / (100 + skill);
        return this._baseMaxChargeTime * factor;
    }

    update(delta) {
        this.state.timeWithoutCollision = Math.min(this.getMaxChargeTime(), this.state.timeWithoutCollision + delta);
        this._tickAftershock(delta);
        if (this.getChargeProgress() > CHARGE_THRESHOLD_PARTICLES) {
            this.state.particleTimer -= delta;
            if (this.state.particleTimer <= 0) {
                this.state.particleTimer =
                    PARTICLE_BASE_INTERVAL - this.getChargeProgress() * PARTICLE_INTERVAL_REDUCTION;
                this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
                    count: PARTICLE_BASE_COUNT + Math.floor(this.getChargeProgress() * PARTICLE_COUNT_PER_CHARGE),
                    speed: PARTICLE_BASE_SPEED + this.getChargeProgress() * PARTICLE_SPEED_PER_CHARGE,
                    radiusMin: 2,
                    radiusMax: 4,
                    upBias: 120,
                    gravity: 900,
                    life: 1.1
                });
            }
        }
    }

    _tickAftershock(delta) {
        const as = this.state.aftershock;
        if (!as) return;
        as.remaining -= delta;
        if (as.remaining <= 0) {
            this._triggerAftershock();
            return;
        }
        if (as.target.flags.defeated) {
            this.state.aftershock = null;
            return;
        }
        this._drawAftershockEmbers(as);
    }

    _drawAftershockEmbers(as) {
        const worldPoint = this._localToWorld(as.target, as.localContact);
        this.simulation.spawnParticleBurst(worldPoint, "#fff4bd", {
            count: 1,
            speed: 20,
            radiusMin: 1,
            radiusMax: 2,
            life: 0.15,
            upBias: 0,
            gravity: 0
        });
    }

    _localToWorld(ball, localPoint) {
        const cos = Math.cos(ball.angle);
        const sin = Math.sin(ball.angle);
        return {
            x: ball.position.x + localPoint.x * cos - localPoint.y * sin,
            y: ball.position.y + localPoint.x * sin + localPoint.y * cos
        };
    }

    onCollision(target, context) {
        const charge = this.getChargeProgress();
        if (charge < 0.35) return;

        this.simulation.playSound("rage", 0.75);
        this.simulation.addLog(`${this.owner.name}'s momentum resets on impact.`);

        if (this.abilityTier >= 1) {
            if (this.abilityTier === 1) {
                this._applyIgnite(target);
            } else if (this.abilityTier === 2) {
                if (charge < 0.7) {
                    this._applyIgnite(target);
                } else {
                    this._applyExplosion(target, context);
                }
            } else {
                if (charge < 0.7) {
                    this._applyIgnite(target);
                } else if (charge < 1.0) {
                    this._applyExplosion(target, context);
                } else {
                    this._applyAftershock(target, context);
                }
            }
        }

        this.state.timeWithoutCollision = 0;
    }

    _applyIgnite(target) {
        if (target.flags.defeated) return;
        const igniteState = {
            remaining: IGNITE_DURATION,
            tickInterval: IGNITE_TICK_INTERVAL,
            tickTimer: 0,
            tickIndex: 0,
            damagePerTick: Math.round(this.owner.stats.baseDamage * IGNITE_DAMAGE_PER_TICK),
            source: this.owner
        };
        if (target._igniteState) {
            target._igniteState.remaining = IGNITE_DURATION;
            return;
        }
        target._igniteState = igniteState;
        this.simulation.addLog(`${target.name} is ignited by ${this.owner.name}.`);
    }

    _applyExplosion(target, context) {
        const center = context?.contactPoint ?? target.position.clone();
        const rawDamage = Math.round(this.owner.stats.baseDamage * EXPLOSION_DAMAGE_MULT);
        const enemies = this.simulation.getEnemiesOf(this.owner);
        for (const enemy of enemies) {
            const dist = Vector2.subtract(enemy.position, center).length();
            if (dist <= EXPLOSION_RADIUS) {
                enemy.takeDamage(rawDamage, this.owner, "Rage Explosion");
            }
        }
        this.simulation.spawnExplosion(center, "#ff7b32");
        this._spawnFlameRing(center, EXPLOSION_RADIUS, "#ff7b32", 0.22);
        this._spawnFlameRing(center, EXPLOSION_RADIUS * 0.7, "#ff983d", 0.18);
        this.simulation.playSound("explosion", 1.35);
        this.simulation.addLog(`${this.owner.name} triggers explosion!`);
    }

    _spawnFlameRing(center, radius, color, duration) {
        this.simulation.entities.push(new RageFlameRing(center, radius, color, duration));
    }

    _applyAftershock(target, context) {
        const contactPoint = context?.contactPoint ?? target.position.clone();
        const localX = contactPoint.x - target.position.x;
        const localY = contactPoint.y - target.position.y;
        const cos = Math.cos(-target.angle);
        const sin = Math.sin(-target.angle);
        const localContact = {
            x: localX * cos - localY * sin,
            y: localX * sin + localY * cos
        };
        this.state.aftershock = {
            target,
            localContact,
            remaining: AFTERSHOCK_DELAY,
            triggered: false
        };
    }

    _triggerAftershock() {
        const as = this.state.aftershock;
        if (!as || as.target.flags.defeated) {
            this.state.aftershock = null;
            return;
        }
        const worldPoint = this._localToWorld(as.target, as.localContact);
        const rawDamage = Math.round(this.owner.stats.baseDamage * AFTERSHOCK_DAMAGE_MULT);
        const enemies = this.simulation.getEnemiesOf(this.owner);

        let appliedShake = false;
        for (const enemy of enemies) {
            const dist = Vector2.subtract(enemy.position, worldPoint).length();
            if (dist <= AFTERSHOCK_RADIUS) {
                enemy.takeDamage(rawDamage, this.owner, "Rage Aftershock");
                const dir = Vector2.subtract(enemy.position, worldPoint).normalize();
                const impulseStrength =
                    AFTERSHOCK_CENTER_IMPULSE -
                    (dist / AFTERSHOCK_RADIUS) * (AFTERSHOCK_CENTER_IMPULSE - AFTERSHOCK_EDGE_IMPULSE);
                enemy.applyImpulse(dir.scale(impulseStrength));
                if (!appliedShake) {
                    appliedShake = true;
                }
            }
        }
        if (!appliedShake) {
            this.simulation.shakeScreen(0.24, 16);
        } else {
            this.simulation.shakeScreen(0.24, 16);
        }
        this.simulation.playSound("explosion", 0.75);
        this.simulation.playSound("rage", 0.8);

        this._spawnFlameRing(worldPoint, AFTERSHOCK_RADIUS, "#fff4bd", 0.32);
        this._spawnFlameRing(worldPoint, AFTERSHOCK_RADIUS * 0.65, "#ff7b32", 0.28);
        this._spawnFlameRing(worldPoint, AFTERSHOCK_RADIUS * 0.35, "#ff983d", 0.24);
        this.simulation.spawnExplosion(worldPoint, "#fff4bd");

        this.simulation.addLog(`${this.owner.name} unleashes aftershock!`);
        this.state.aftershock = null;
    }

    getChargeProgress() {
        return Math.max(0, Math.min(1, this.state.timeWithoutCollision / this.getMaxChargeTime()));
    }

    isCharged() {
        return this.getChargeProgress() > 0.22;
    }

    getStatModifiers() {
        const charge = this.getChargeProgress();
        return {
            speed: SPEED_BASE + charge * (4.22 - SPEED_BASE + SPEED_PER_CHARGE),
            damage: DAMAGE_BASE + charge * DAMAGE_PER_CHARGE,
            defense: 1,
            impact: IMPACT_BASE + charge * (1.52 - IMPACT_BASE)
        };
    }

    draw(ctx) {
        if (!this.isCharged()) return;

        const pos = this.owner.position;
        const r = this.owner.radius;
        const charge = this.getChargeProgress();
        const pulse = 1 + Math.sin(performance.now() / 70) * (0.04 + charge * 0.08);

        ctx.save();
        ctx.strokeStyle = "#ff421a";
        ctx.lineWidth = 4 + charge * 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (r + 12 + charge * 16) * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#ffb450";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (r + 22 + charge * 20) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        const growl = this.getChargeProgress();
        this._line(ctx, ball, [
            [-0.38, -0.24],
            [-0.12, -0.08]
        ]);
        this._line(ctx, ball, [
            [0.38, -0.24],
            [0.12, -0.08]
        ]);
        this._dotEye(ctx, ball, -0.22, 0, 0.052 + growl * 0.025);
        this._dotEye(ctx, ball, 0.22, 0, 0.052 + growl * 0.025);
        this._arc(ctx, ball, 0, 0.32, 0.2, Math.PI + 0.15, Math.PI * 2 - 0.15);
        return true;
    }

    getUiState() {
        return { label: "Momentum", progress: Math.max(0.08, this.getChargeProgress()) };
    }
}

class RageFlameRing {
    constructor(center, radius, color, duration) {
        this.center = center;
        this.maxRadius = radius;
        this.color = color;
        this.remaining = duration;
        this.maxDuration = duration;
        this.isExpired = false;
    }

    update(delta) {
        this.remaining -= delta;
        if (this.remaining <= 0) this.isExpired = true;
    }

    draw(ctx) {
        const progress = 1 - this.remaining / this.maxDuration;
        const currentRadius = this.maxRadius * progress;
        const alpha = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
