import { Vector2 } from "../core.js";
import { ArrowProjectile, Grenade, HeroOrb, OrbitProjectile, SeedOrb } from "../entities/index.js";
import {
    DeathBurstEffect,
    RevivalEffect,
    GravityParticle,
    OrbitHitEffect,
    SlashTrail,
    VisualBurst,
    DamageNumber,
    CriticalNumber,
    ActionText,
    ActionWindowEffect,
    ActionSuccessEffect,
    ActionWhiffEffect
} from "../effects/index.js";
import { resolveTerrainCollisions } from "../terrain/terrainCollision.js";
import { applyCollisionResponse } from "../physics/collisionResponse.js";
import { PeriodicDamageEffect } from "../combatEffects.js";
import { StickyGrenadeRegistry } from "./stickyGrenadeRegistry.js";

function createStaticCollisionContext(surface, collision, postCollisionVelocity) {
    return {
        wall: surface === "wall",
        terrain: surface === "terrain",
        normal: collision.normal.clone(),
        contactPoint: collision.contactPoint.clone(),
        preCollisionVelocity: collision.preCollisionVelocity.clone(),
        postCollisionVelocity: postCollisionVelocity.clone()
    };
}

/**
 * Base simulation — arena boundaries, wall bouncing, effect spawning.
 * Extended by BattleSimulation (real game) and TestSimulation (tests).
 */
export class Simulation {
    constructor() {
        this.width = 960;
        this.height = 960;
        /** @type {import("./entities/index.js").BattleBall[]} */
        this.fighters = [];
        /** @type {import("./core.js").CombatEntity[]} */
        this.entities = [];
        this.screenShake = null;
        this.showDamageNumbers = true;
        this.stickyGrenadeRegistry = new StickyGrenadeRegistry();
    }

    // ── Arena helpers ─────────────────────────────────────────────────────

    isHostile(a, b) {
        if (!a || !b || a === b) return false;
        if (a.teamId == null || b.teamId == null) return true;
        return a.teamId !== b.teamId;
    }

    getEnemiesOf(ball) {
        const combatTargets = [
            ...this.fighters,
            ...this.entities.filter((entity) => entity.isCombatTarget && !this.fighters.includes(entity))
        ];
        return combatTargets.filter(
            (fighter) =>
                this.isHostile(ball, fighter) &&
                fighter.participation?.canBeTargeted !== false &&
                !fighter.flags.defeated &&
                !fighter.state?.swallowed
        );
    }

    getAlliesOf(ball) {
        return this.fighters.filter(
            (fighter) =>
                !this.isHostile(ball, fighter) &&
                fighter.participation?.canBeTargeted !== false &&
                !fighter.flags.defeated &&
                !fighter.flags.destroyed &&
                !fighter.state?.swallowed
        );
    }

    getNearestEnemy(ball) {
        const enemies = this.getEnemiesOf(ball);
        if (enemies.length === 0) return null;
        return enemies.reduce((nearest, enemy) => {
            const nearestDistance = Vector2.subtract(nearest.position, ball.position).length();
            const enemyDistance = Vector2.subtract(enemy.position, ball.position).length();
            return enemyDistance < nearestDistance ? enemy : nearest;
        });
    }

    getOpponent(ball) {
        return this.getNearestEnemy(ball);
    }

    registerStickyGrenade(target, ownerId, grenade) {
        return this.stickyGrenadeRegistry.register(target, ownerId, grenade);
    }

    getStickyGrenade(target, ownerId) {
        return this.stickyGrenadeRegistry.get(target, ownerId);
    }

    releaseStickyGrenade(target, ownerId, grenade) {
        return this.stickyGrenadeRegistry.release(target, ownerId, grenade);
    }

    getActiveStickyGrenadeCount() {
        return this.stickyGrenadeRegistry.activeCount;
    }

    keepInsideArena(ball) {
        const xBounce = this._reflectX(ball);
        const yBounce = this._reflectY(ball);
        const terrainResult = resolveTerrainCollisions(ball, this.terrain);
        if (!xBounce && !yBounce && !terrainResult) return;

        ball.bounced = true;
        for (const wallCollision of [xBounce, yBounce].filter(Boolean)) {
            ball.applyWallBounceBoost?.(wallCollision.normal);
            ball.state.wallSlam?.onWallBounce(
                ball,
                wallCollision.normal,
                this,
                wallCollision.contactPoint,
                wallCollision.preCollisionVelocity
            );
        }
        if (terrainResult) {
            ball.state.wallSlam?.onTerrainCollision(
                ball,
                terrainResult.normal,
                this,
                terrainResult.contactPoint,
                terrainResult.preCollisionVelocity
            );
        }
        const primaryCollision = xBounce ?? yBounce ?? terrainResult;
        this.notifyFighterStaticCollision?.(ball, {
            wall: Boolean(xBounce || yBounce),
            terrain: Boolean(terrainResult),
            normal: primaryCollision?.normal ?? null,
            contactPoint: primaryCollision?.contactPoint ?? null,
            preCollisionVelocity: primaryCollision?.preCollisionVelocity ?? null
        });
    }

    keepEntityInsideArena(entity, { resolveTerrain = false, onStaticCollision = null } = {}) {
        const notifyStaticCollision = (surface, collision) => {
            if (!collision || typeof onStaticCollision !== "function") return;
            onStaticCollision(createStaticCollisionContext(surface, collision, entity.velocity));
        };

        const xBounce = this._reflectX(entity);
        notifyStaticCollision("wall", xBounce);
        const yBounce = this._reflectY(entity);
        notifyStaticCollision("wall", yBounce);
        const terrainCollision = resolveTerrain ? resolveTerrainCollisions(entity, this.terrain) : null;
        notifyStaticCollision("terrain", terrainCollision);
    }

    /** X축 벽 반사. bounce 발생 시 normal 반환. */
    _reflectX(entity) {
        if (entity.position.x <= entity.radius) {
            entity.position.x = entity.radius;
            const preVel = new Vector2(entity.velocity.x, entity.velocity.y);
            applyCollisionResponse(entity, new Vector2(1, 0), new Vector2(0, entity.position.y), preVel, {
                surfaceMaterial: "wall"
            });
            if (entity.state?.movement) this._handleWallBounce(entity);
            return {
                normal: new Vector2(1, 0),
                contactPoint: new Vector2(0, entity.position.y),
                preCollisionVelocity: preVel
            };
        }
        if (entity.position.x >= this.width - entity.radius) {
            entity.position.x = this.width - entity.radius;
            const preVel = new Vector2(entity.velocity.x, entity.velocity.y);
            applyCollisionResponse(entity, new Vector2(-1, 0), new Vector2(this.width, entity.position.y), preVel, {
                surfaceMaterial: "wall"
            });
            if (entity.state?.movement) this._handleWallBounce(entity);
            return {
                normal: new Vector2(-1, 0),
                contactPoint: new Vector2(this.width, entity.position.y),
                preCollisionVelocity: preVel
            };
        }
        return null;
    }

    /** Y축 벽 반사. bounce 발생 시 normal 반환. */
    _reflectY(entity) {
        if (entity.position.y <= entity.radius) {
            entity.position.y = entity.radius;
            const preVel = new Vector2(entity.velocity.x, entity.velocity.y);
            applyCollisionResponse(entity, new Vector2(0, 1), new Vector2(entity.position.x, 0), preVel, {
                surfaceMaterial: "wall"
            });
            if (entity.state?.movement) this._handleWallBounce(entity);
            return {
                normal: new Vector2(0, 1),
                contactPoint: new Vector2(entity.position.x, 0),
                preCollisionVelocity: preVel
            };
        }
        if (entity.position.y >= this.height - entity.radius) {
            entity.position.y = this.height - entity.radius;
            const preVel = new Vector2(entity.velocity.x, entity.velocity.y);
            applyCollisionResponse(entity, new Vector2(0, -1), new Vector2(entity.position.x, this.height), preVel, {
                surfaceMaterial: "wall"
            });
            if (entity.state?.movement) this._handleWallBounce(entity);
            return {
                normal: new Vector2(0, -1),
                contactPoint: new Vector2(entity.position.x, this.height),
                preCollisionVelocity: preVel
            };
        }
        return null;
    }

    _handleWallBounce(ball) {
        ball.state.movement.onWallBounce(ball, this);
        if (ball.state.movement?.expired) {
            ball.state.movement = null;
            // 대시/효과 종료 시 벽 방향 forceHeading도 같이 제거합니다.
            if (ball.state.forcedHeading) ball.state.forcedHeading = null;
        }
    }

    // ── Spawn helpers ─────────────────────────────────────────────────────

    spawnArrow(owner, position, velocity, options = {}) {
        const arrow = new ArrowProjectile(owner, position, velocity, options);
        this.entities.push(arrow);
        return arrow;
    }

    spawnSeedOrb(owner, position, velocity, life, options = {}) {
        const seed = new SeedOrb(owner, position, velocity, life, options);
        this.entities.push(seed);
        return seed;
    }

    createPeriodicDamageEffect(options) {
        return new PeriodicDamageEffect(options);
    }

    spawnGrenade(owner, targetPosition, fuseTime, options = {}) {
        this.entities.push(new Grenade(owner, targetPosition, fuseTime, options));
    }

    spawnOrbitShot(owner, position, direction, size, options = {}) {
        const projectile = new OrbitProjectile(owner, position, direction, size, options);
        this.entities.push(projectile);
        return projectile;
    }

    spawnHeroOrb(owner, position, velocity, effectType, life, options) {
        const orb = new HeroOrb(owner, position, velocity, effectType, life, options);
        this.entities.push(orb);
        return orb;
    }

    spawnPulse(position, color) {
        this.entities.push(new VisualBurst(position, color, 180, 0.34));
        this.spawnParticleBurst(position, color, { count: 16, speed: 200, radiusMin: 2, radiusMax: 4 });
    }

    spawnRevival(position, color, radius) {
        this.entities.push(new RevivalEffect(position.clone(), color, radius));
        this.entities.push(new VisualBurst(position.clone(), "#ffffff", radius * 5.4, 0.38));
        this.spawnParticleBurst(position, color, {
            count: 28,
            speed: radius * 6.2,
            radiusMin: 2,
            radiusMax: 5,
            gravity: 260,
            life: 0.82,
            bounce: 0,
            settleDelay: 0.82,
            upBias: radius * 1.8
        });
    }

    spawnLootCollection(position, color, label) {
        const center = position.clone();
        this.entities.push(new VisualBurst(center.clone(), color, 260, 0.44));
        this.spawnParticleBurst(center, color, {
            count: 24,
            speed: 240,
            radiusMin: 2,
            radiusMax: 5,
            gravity: 760,
            life: 0.95,
            bounce: 0.08,
            settleDelay: 0.32,
            upBias: 100
        });
        this.spawnActionText(center, label, color);
    }

    spawnExperienceCollection(position, color) {
        const center = position.clone();
        this.entities.push(new VisualBurst(center.clone(), color, 150, 0.26));
        this.spawnParticleBurst(center, color, {
            count: 7,
            speed: 150,
            radiusMin: 1,
            radiusMax: 3,
            gravity: 360,
            life: 0.48,
            bounce: 0.04,
            settleDelay: 0.12,
            upBias: 70
        });
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

    spawnOrbitHit(shardPosition, targetPosition, color, options = {}) {
        this.entities.push(new OrbitHitEffect(shardPosition, targetPosition, color, options));
    }

    spawnOrbitExplosion(position, color, radius) {
        this.entities.push(
            new OrbitHitEffect(position.clone(), position.clone(), color, {
                impactRadius: radius,
                drawConnection: false
            })
        );
        this.spawnParticleBurst(position, color, {
            count: 20,
            speed: 220,
            radiusMin: 2,
            radiusMax: 5,
            upBias: 10
        });
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
        const effect = new DamageNumber(position, amount, color);
        this.entities.push(effect);
        return effect;
    }

    spawnCriticalNumber(position, amount) {
        if (!this.showDamageNumbers) return;
        this.entities.push(new CriticalNumber(position, amount));
    }

    spawnActionText(position, text, color = "#ffffff") {
        if (!this.showDamageNumbers) return;
        const effect = new ActionText(position, text, color);
        this.entities.push(effect);
        return effect;
    }

    spawnActionWindow(ball, actionId, duration) {
        this.entities.push(new ActionWindowEffect(ball, actionId, duration));
    }

    spawnActionSuccess(position, actionId) {
        this.entities.push(new ActionSuccessEffect(position, actionId));
    }

    spawnActionWhiff(position) {
        this.entities.push(new ActionWhiffEffect(position));
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
