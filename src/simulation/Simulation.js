import { Vector2 } from "../core.js";
import { ArrowProjectile, Grenade, OrbitProjectile, SeedOrb } from "../entities.js";
import {
    DeathBurstEffect,
    GravityParticle,
    OrbitHitEffect,
    SlashTrail,
    VisualBurst,
    DamageNumber,
    ActionText
} from "../effects.js";

/**
 * Base simulation — arena boundaries, wall bouncing, effect spawning.
 * Extended by BattleSimulation (real game) and TestSimulation (tests).
 */
export class Simulation {
    constructor() {
        this.width = 960;
        this.height = 960;
        /** @type {import("./entities.js").BattleBall[]} */
        this.fighters = [];
        /** @type {import("./core.js").CombatEntity[]} */
        this.entities = [];
        this.screenShake = null;
        this.showDamageNumbers = true;
    }

    // ── Arena helpers ─────────────────────────────────────────────────────

    getOpponent(ball) {
        return (
            this.fighters.find((fighter) => fighter !== ball && !fighter.isDefeated && !fighter.swallowedState) || null
        );
    }

    keepInsideArena(ball) {
        const xBounce = this._reflectX(ball);
        const yBounce = this._reflectY(ball);
        if (!xBounce && !yBounce) return;

        ball.bounced = true;
        ball.wallSlamState?.onWallBounce(ball, xBounce ?? yBounce, this);
    }

    keepEntityInsideArena(entity) {
        this._reflectX(entity);
        this._reflectY(entity);
    }

    /** X축 벽 반사. bounce 발생 시 normal 반환. */
    _reflectX(entity) {
        if (entity.position.x <= entity.radius) {
            entity.position.x = entity.radius;
            entity.velocity.x = Math.abs(entity.velocity.x);
            if (entity.movementEffect) this._handleWallBounce(entity);
            return new Vector2(1, 0);
        }
        if (entity.position.x >= this.width - entity.radius) {
            entity.position.x = this.width - entity.radius;
            entity.velocity.x = -Math.abs(entity.velocity.x);
            if (entity.movementEffect) this._handleWallBounce(entity);
            return new Vector2(-1, 0);
        }
        return null;
    }

    /** Y축 벽 반사. bounce 발생 시 normal 반환. */
    _reflectY(entity) {
        if (entity.position.y <= entity.radius) {
            entity.position.y = entity.radius;
            entity.velocity.y = Math.abs(entity.velocity.y);
            if (entity.movementEffect) this._handleWallBounce(entity);
            return new Vector2(0, 1);
        }
        if (entity.position.y >= this.height - entity.radius) {
            entity.position.y = this.height - entity.radius;
            entity.velocity.y = -Math.abs(entity.velocity.y);
            if (entity.movementEffect) this._handleWallBounce(entity);
            return new Vector2(0, -1);
        }
        return null;
    }

    _handleWallBounce(ball) {
        ball.movementEffect.onWallBounce(ball, this);
        if (ball.movementEffect?.expired) {
            ball.movementEffect = null;
        }
    }

    // ── Spawn helpers ─────────────────────────────────────────────────────

    spawnArrow(owner, position, velocity) {
        const arrow = new ArrowProjectile(owner, position, velocity);
        this.entities.push(arrow);
        return arrow;
    }

    spawnSeedOrb(owner, position, velocity, life) {
        this.entities.push(new SeedOrb(owner, position, velocity, life));
    }

    spawnGrenade(owner, targetPosition, fuseTime) {
        this.entities.push(new Grenade(owner, targetPosition, fuseTime));
    }

    spawnOrbitShot(owner, position, direction, size) {
        this.entities.push(new OrbitProjectile(owner, position, direction, size));
    }

    spawnPulse(position, color) {
        this.entities.push(new VisualBurst(position, color, 180, 0.34));
        this.spawnParticleBurst(position, color, { count: 16, speed: 200, radiusMin: 2, radiusMax: 4 });
    }

    addSparkBurst(position, color) {
        this.entities.push(new VisualBurst(position, color, 120, 0.22));
        this.spawnParticleBurst(position, color, { count: 10, speed: 140, radiusMin: 2, radiusMax: 3 });
    }

    spawnExplosion(position, color) {
        this.entities.push(new VisualBurst(position, color, 340, 0.48));
        this.spawnParticleBurst(position, color, { count: 34, speed: 320, radiusMin: 2, radiusMax: 6, gravity: 940 });
    }

    spawnDeathExplosion(position, color) {
        this.playSound("ko");
        this.entities.push(new DeathBurstEffect(position, color));
        this.entities.push(new VisualBurst(position, "#ffffff", 280, 0.5));
        this.spawnParticleBurst(position, color, {
            count: 58,
            speed: 390,
            radiusMin: 3,
            radiusMax: 7,
            gravity: 1120,
            life: 2.25,
            bounce: 0.18,
            settleDelay: 0.85
        });
        this.spawnParticleBurst(position, "#ffffff", {
            count: 22,
            speed: 300,
            radiusMin: 2,
            radiusMax: 4,
            gravity: 980,
            life: 1.55,
            bounce: 0.12,
            settleDelay: 0.45
        });
    }

    spawnOrbitHit(shardPosition, targetPosition, color) {
        this.entities.push(new OrbitHitEffect(shardPosition, targetPosition, color));
    }

    spawnSlash(from, to, color) {
        this.entities.push(new SlashTrail(from, to, color));
        this.playSound("dash", 0.72);
        const center = Vector2.add(from, to).scale(0.5);
        this.spawnParticleBurst(center, color, { count: 12, speed: 180, radiusMin: 2, radiusMax: 4, gravity: 760 });
    }

    spawnParticleBurst(position, color, options = {}) {
        const count = options.count ?? 12;
        for (let index = 0; index < count; index += 1) {
            const spread = options.spread ?? Math.PI * 2;
            const baseAngle = options.direction
                ? Math.atan2(options.direction.y, options.direction.x)
                : Math.random() * Math.PI * 2;
            const angle = options.direction ? baseAngle + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
            const speed = (options.speed ?? 180) * (0.45 + Math.random() * 0.9);
            const velocity = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed - (options.upBias ?? 40));
            this.entities.push(
                new GravityParticle(position.clone(), velocity, {
                    color,
                    gravity: options.gravity ?? 1280,
                    radius:
                        (options.radiusMin ?? 2) +
                        Math.random() * ((options.radiusMax ?? 4) - (options.radiusMin ?? 2)),
                    life: options.life ?? 2.0 + Math.random() * 0.9,
                    bounce: options.bounce ?? 0.12,
                    floorFriction: options.floorFriction ?? 0.88,
                    settleDelay: options.settleDelay ?? 0.9 + Math.random() * 0.8
                })
            );
        }
    }

    spawnWallImpact(position, normal, color) {
        const direction = normal.clone().normalize();
        this.spawnParticleBurst(position, color, {
            count: 28,
            speed: 340,
            radiusMin: 3,
            radiusMax: 7,
            gravity: 1040,
            life: 1.65,
            bounce: 0.1,
            settleDelay: 0.45,
            upBias: 10,
            direction,
            spread: Math.PI * 0.72
        });
        this.entities.push(new VisualBurst(position.clone(), color, 180, 0.22));
    }

    spawnDamageNumber(position, amount, color = "#ff3333") {
        if (!this.showDamageNumbers) return;
        this.entities.push(new DamageNumber(position, amount, color));
    }

    spawnActionText(position, text, color = "#ffffff") {
        if (!this.showDamageNumbers) return;
        this.entities.push(new ActionText(position, text, color));
    }

    // ── Shared helpers ────────────────────────────────────────────────────

    shakeScreen(duration = 0.18, strength = 10) {
        if (this.screenShake) {
            this.screenShake.duration = Math.max(this.screenShake.duration, duration);
            this.screenShake.remaining = Math.max(this.screenShake.remaining, duration);
            this.screenShake.strength = Math.max(this.screenShake.strength, strength);
            return;
        }
        this.screenShake = { duration, remaining: duration, strength };
    }

    updateScreenShake(delta) {
        if (!this.screenShake) return;
        this.screenShake.remaining -= delta;
        if (this.screenShake.remaining <= 0) this.screenShake = null;
    }

    /** Override in subclass. */
    getSpeedMultiplier(ball = null) {
        return 1;
    }

    /** Override in subclass. */
    getDamageMultiplier() {
        return 1;
    }

    /** Override in subclass. */
    addLog(message) {}

    /** Override in subclass. */
    playSound(type, intensity = 1) {}
}
