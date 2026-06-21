import { Vector2 } from "../core.js";
import { ArrowProjectile, Grenade, SeedOrb } from "../entities.js";
import {
    DeathBurstEffect,
    GravityParticle,
    OrbitHitEffect,
    SlashTrail,
    VisualBurst,
    DamageNumber
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
        let bounced = false;
        let wallNormal = null;
        let wallPoint = null;
        if (ball.position.x <= ball.radius) {
            ball.position.x = ball.radius;
            ball.velocity.x = Math.abs(ball.velocity.x);
            bounced = true;
            wallNormal = new Vector2(1, 0);
            wallPoint = ball.position.clone();
            this.clearWallDash(ball);
        } else if (ball.position.x >= this.width - ball.radius) {
            ball.position.x = this.width - ball.radius;
            ball.velocity.x = -Math.abs(ball.velocity.x);
            bounced = true;
            wallNormal = new Vector2(-1, 0);
            wallPoint = ball.position.clone();
            this.clearWallDash(ball);
        }

        if (ball.position.y <= ball.radius) {
            ball.position.y = ball.radius;
            ball.velocity.y = Math.abs(ball.velocity.y);
            bounced = true;
            wallNormal = new Vector2(0, 1);
            wallPoint = ball.position.clone();
            this.clearWallDash(ball);
        } else if (ball.position.y >= this.height - ball.radius) {
            ball.position.y = this.height - ball.radius;
            ball.velocity.y = -Math.abs(ball.velocity.y);
            bounced = true;
            wallNormal = new Vector2(0, -1);
            wallPoint = ball.position.clone();
            this.clearWallDash(ball);
        }

        if (bounced && ball.wallSlamState && ball.wallSlamState.cooldown <= 0) {
            ball.wallSlamState.cooldown = 0.18;
            ball.takeDamage(ball.wallSlamState.damage, ball.wallSlamState.source, "Wall Slam");
            this.spawnWallImpact(
                wallPoint ?? ball.position.clone(),
                wallNormal ?? ball.velocity.clone().normalize().scale(-1),
                ball.wallSlamState.source?.color ?? ball.color
            );
            this.playSound("wall", 1.15);
            this.shakeScreen(0.24, 16);
            this.addLog(`${ball.name} takes wall slam damage.`);
        }
    }

    clearWallDash(ball) {
        if (!ball.dashState?.untilWall) return;
        ball.ability?.onDashWall?.(ball.dashState);
        ball.clearDash();
    }

    keepEntityInsideArena(entity) {
        if (entity.position.x <= entity.radius) {
            entity.position.x = entity.radius;
            entity.velocity.x = Math.abs(entity.velocity.x);
        } else if (entity.position.x >= this.width - entity.radius) {
            entity.position.x = this.width - entity.radius;
            entity.velocity.x = -Math.abs(entity.velocity.x);
        }
        if (entity.position.y <= entity.radius) {
            entity.position.y = entity.radius;
            entity.velocity.y = Math.abs(entity.velocity.y);
        } else if (entity.position.y >= this.height - entity.radius) {
            entity.position.y = this.height - entity.radius;
            entity.velocity.y = -Math.abs(entity.velocity.y);
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
    getSpeedMultiplier() {
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
