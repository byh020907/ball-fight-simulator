import { Vector2 } from "../core.js";
import { HeroShieldShard } from "../entities/heroShieldShard.js";
import { HeroShieldBreakEffect } from "../effects/heroEffects.js";
import { Ability } from "./ability.js";
import { HERO_COMBAT_CONFIG } from "./heroCombatConfig.js";

export const HERO_ORB_STAT_CAP = -1;
export const HERO_ORB_MAX_ACTIVE_PER_OWNER = HERO_COMBAT_CONFIG.core.maximumActivePerOwner;
const STAT_EFFECT_TYPES = ["hp", "damage", "speed", "defense", "skill", "critical"];

export function pickHeroOrbEffectType(rng = Math.random) {
    return STAT_EFFECT_TYPES[Math.min(STAT_EFFECT_TYPES.length - 1, Math.floor(rng() * STAT_EFFECT_TYPES.length))];
}

export function computeOwnerCombatSpeed(owner) {
    const modifiers = owner.getStatModifiers?.() ?? { speed: 1 };
    const slowMultiplier = owner.state.slow ? owner.state.slow.amount : 1;
    const boostMultiplier = owner.state.speedBoost ? owner.state.speedBoost.multiplier : 1;
    const movementSpeed = owner.state.movement?.getSpeed?.(owner);
    return movementSpeed ?? owner.stats.baseSpeed * modifiers.speed * slowMultiplier * boostMultiplier;
}

export class HeroAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, HERO_COMBAT_CONFIG.growth.stackInterval);
        this.state = {
            growthStacks: 0,
            chargeTimer: 0,
            pursuitTimer: 0,
            shield: 0,
            counterCooldown: 0,
            stackGainFlash: 0,
            stackReleaseFlash: 0
        };
    }

    update(delta, target) {
        this._tickTransientState(delta);
        this._clampShield();
        this._chargeGrowthStacks(delta);
        this._updatePursuit(delta, target);
    }

    _tickTransientState(delta) {
        this.state.stackGainFlash = Math.max(0, this.state.stackGainFlash - delta);
        this.state.stackReleaseFlash = Math.max(0, this.state.stackReleaseFlash - delta);
        this.state.counterCooldown = Math.max(0, this.state.counterCooldown - delta);
    }

    _chargeGrowthStacks(delta) {
        if (this.state.growthStacks >= HERO_COMBAT_CONFIG.growth.stackCap) return;
        this.state.chargeTimer += delta;
        while (
            this.state.chargeTimer >= HERO_COMBAT_CONFIG.growth.stackInterval &&
            this.state.growthStacks < HERO_COMBAT_CONFIG.growth.stackCap
        ) {
            this.state.chargeTimer -= HERO_COMBAT_CONFIG.growth.stackInterval;
            this.state.growthStacks += 1;
            this.state.stackGainFlash = HERO_COMBAT_CONFIG.growth.gainFlashDuration;
            if (this.state.growthStacks === HERO_COMBAT_CONFIG.growth.stackCap) this.state.pursuitTimer = 0;
        }
    }

    _updatePursuit(delta, fallbackTarget) {
        if (this.state.growthStacks < HERO_COMBAT_CONFIG.growth.stackCap) {
            this.state.pursuitTimer = 0;
            return;
        }
        this.state.pursuitTimer = Math.max(0, this.state.pursuitTimer - delta);
        if (this.state.pursuitTimer > 0 || this.owner.state.movement) return;

        const target = this._resolvePursuitTarget(fallbackTarget);
        if (!target) return;
        const direction = Vector2.subtract(target.position, this.owner.position);
        if (direction.length() <= 0.001) return;
        direction.normalize();
        this.owner.initiateDash(direction, {
            duration: HERO_COMBAT_CONFIG.pursuit.duration,
            multiplier: HERO_COMBAT_CONFIG.pursuit.speedMultiplier,
            color: "#ffd84d",
            collisionDamage: 0,
            collisionLabel: "Hero Pursuit"
        });
        this.state.pursuitTimer = HERO_COMBAT_CONFIG.pursuit.interval;
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#ffd84d", {
            count: 10,
            speed: 140,
            radiusMin: 2,
            radiusMax: 4
        });
        this.simulation.playSound("dash", 0.72);
    }

    _resolvePursuitTarget(fallbackTarget) {
        if (fallbackTarget && !fallbackTarget.flags.defeated && this.simulation.isHostile(this.owner, fallbackTarget)) {
            return fallbackTarget;
        }
        return this.simulation.getNearestEnemy(this.owner);
    }

    onFighterCollisionDamageResolved(target, actualDamage, context = {}) {
        if (!target) return;
        this._releaseGrowthCores(context.contactPoint ?? target.position);
    }

    _releaseGrowthCores(contactPoint) {
        const stackCount = this.state.growthStacks;
        if (stackCount <= 0) return;
        this.state.growthStacks = 0;
        this.state.chargeTimer = 0;
        this.state.pursuitTimer = 0;
        this.state.stackReleaseFlash = HERO_COMBAT_CONFIG.growth.releaseFlashDuration;
        for (const _ of Array.from({ length: stackCount })) {
            const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
            this._spawnCore(pickHeroOrbEffectType(), contactPoint, direction);
        }
        this.simulation.spawnPulse(new Vector2(contactPoint.x, contactPoint.y), "#ffd85a");
        this.simulation.playSound("orb", 0.9);
    }

    _spawnCore(effectType, contactPoint, direction) {
        this._enforceOwnerCoreLimit();
        const speedMultiplier =
            HERO_COMBAT_CONFIG.core.speedMinMultiplier +
            Math.random() * (HERO_COMBAT_CONFIG.core.speedMaxMultiplier - HERO_COMBAT_CONFIG.core.speedMinMultiplier);
        const speed = computeOwnerCombatSpeed(this.owner) * speedMultiplier;
        this.simulation.spawnHeroOrb(
            this.owner,
            new Vector2(contactPoint.x, contactPoint.y),
            direction.clone().scale(speed),
            effectType,
            HERO_COMBAT_CONFIG.core.lifetime,
            {
                collectionGraceDuration: HERO_COMBAT_CONFIG.core.collectionGraceDuration,
                sourceAbility: this
            }
        );
    }

    _getActiveOwnerCores() {
        return this.simulation.entities.filter(
            (entity) => entity.constructor?.name === "HeroOrb" && entity.owner === this.owner && !entity.isExpired
        );
    }

    _enforceOwnerCoreLimit() {
        const activeCores = this._getActiveOwnerCores();
        while (activeCores.length >= HERO_ORB_MAX_ACTIVE_PER_OWNER) {
            activeCores.shift().isExpired = true;
        }
    }

    getOrbAttraction(orb) {
        const upgraded = Boolean(this.getLevelUpgrade().fortifiedCoreMagnet);
        const radiusMultiplier = upgraded
            ? HERO_COMBAT_CONFIG.magnet.upgradedRadiusMultiplier
            : HERO_COMBAT_CONFIG.magnet.baseRadiusMultiplier;
        return {
            radius: this.owner.radius * radiusMultiplier + orb.radius,
            responseRate: upgraded
                ? HERO_COMBAT_CONFIG.magnet.upgradedResponseRate
                : HERO_COMBAT_CONFIG.magnet.baseResponseRate,
            attractionSpeedMultiplier: HERO_COMBAT_CONFIG.magnet.attractionSpeedMultiplier
        };
    }

    onOrbCollected(orb, result) {
        if (!result?.applied) return;
        const upgrade = this.getLevelUpgrade();
        if (upgrade.heroArmor) this._addShieldFromCore();
        if (upgrade.coreRecovery) this._healFromCore();
    }

    _addShieldFromCore() {
        const gained = this.owner.maxHp * HERO_COMBAT_CONFIG.armor.shieldPerCoreMaxHpRatio;
        const previous = this.state.shield;
        this.state.shield = Math.min(this.getMaximumShield(), previous + gained);
        if (this.state.shield <= previous) return;
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#ffe66b", {
            count: 8,
            speed: 90,
            radiusMin: 2,
            radiusMax: 4,
            upBias: 12
        });
    }

    _healFromCore() {
        const restored = this.owner.heal(this.owner.maxHp * 0.01);
        if (restored <= 0) return;
        this.simulation.spawnActionText(this.owner.position.clone(), `회복 +${restored}`, "#55cc77");
        this.simulation.playSound("powerup", 1.05);
    }

    getMaximumShield() {
        return this.owner.maxHp * HERO_COMBAT_CONFIG.armor.maximumShieldMaxHpRatio;
    }

    getShieldState() {
        if (!this.getLevelUpgrade().heroArmor) return { current: 0, maximum: 0 };
        return {
            current: this.state.shield,
            maximum: this.getMaximumShield()
        };
    }

    _clampShield() {
        this.state.shield = Math.min(Math.max(0, this.state.shield), this.getMaximumShield());
    }

    absorbIncomingDamage(damage, source, label, options = {}) {
        if (!this.getLevelUpgrade().heroArmor || this.state.shield <= 0 || damage <= 0) {
            return { remainingDamage: damage, absorbedDamage: 0 };
        }

        const shieldBefore = this.state.shield;
        const absorbedDamage = Math.min(shieldBefore, damage);
        this.state.shield = Math.max(0, shieldBefore - absorbedDamage);
        this._showShieldHit(absorbedDamage);

        const hostileSource = this._isHostileSource(source);
        if (hostileSource && this.getLevelUpgrade().shieldCounter && !options.suppressReactiveEffects) {
            this._tryLaunchCounter(source);
        }
        if (
            hostileSource &&
            shieldBefore > 0 &&
            this.state.shield <= 0 &&
            this.getLevelUpgrade().shieldBreakShockwave
        ) {
            this._triggerShieldBreak();
        }

        return {
            remainingDamage: Math.max(0, damage - absorbedDamage),
            absorbedDamage
        };
    }

    _isHostileSource(source) {
        return Boolean(source && !source.flags?.defeated && this.simulation.isHostile(this.owner, source));
    }

    _showShieldHit(absorbedDamage) {
        this.simulation.spawnActionText(this.owner.position.clone(), `방어 ${Math.round(absorbedDamage)}`, "#ffd84d");
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#fff4b8", {
            count: 10,
            speed: 130,
            radiusMin: 2,
            radiusMax: 4
        });
        this.simulation.playSound("bounce", 0.78);
    }

    _tryLaunchCounter(source) {
        if (this.state.counterCooldown > 0) return;
        const direction = Vector2.subtract(source.position, this.owner.position);
        if (direction.length() <= 0.001) return;
        direction.normalize();
        const spawnPosition = Vector2.add(
            this.owner.position,
            direction.clone().scale(this.owner.radius + HERO_COMBAT_CONFIG.counter.radius + 2)
        );
        const damage = this.owner.getTotalAttackDamage() * HERO_COMBAT_CONFIG.counter.damageMultiplier;
        this.simulation.entities.push(new HeroShieldShard(this.owner, spawnPosition, direction, damage));
        this.state.counterCooldown = HERO_COMBAT_CONFIG.counter.cooldown;
        this.simulation.spawnParticleBurst(spawnPosition, "#ffd84d", {
            count: 8,
            speed: 120,
            radiusMin: 2,
            radiusMax: 3
        });
    }

    _triggerShieldBreak() {
        const config = HERO_COMBAT_CONFIG.shieldBreak;
        const center = this.owner.position.clone();
        const damage = this.owner.getTotalAttackDamage() * config.damageMultiplier;
        for (const enemy of this.simulation.getEnemiesOf(this.owner)) {
            const direction = Vector2.subtract(enemy.position, center);
            if (direction.length() > config.radius + enemy.radius) continue;
            enemy.takeDamage(damage, this.owner, "Hero Shield Break", { suppressReactiveEffects: true });
            if (direction.length() <= 0.001) direction.x = 1;
            enemy.applyKnockback(direction.normalize().scale(config.knockbackSpeed), config.knockbackDuration);
        }
        this.simulation.entities.push(new HeroShieldBreakEffect(center, config.radius, config.visualDuration));
        this.simulation.spawnParticleBurst(center, "#ffd84d", {
            count: 28,
            speed: 260,
            radiusMin: 2,
            radiusMax: 6
        });
        this.simulation.playSound("explosion", 0.82);
        this.simulation.shakeScreen(0.28, 14);
    }

    getOrbStackState() {
        return {
            stacks: this.state.growthStacks,
            stackCap: HERO_COMBAT_CONFIG.growth.stackCap,
            progress: this.state.growthStacks / HERO_COMBAT_CONFIG.growth.stackCap
        };
    }

    draw(ctx) {
        this._drawStackReleaseFlash(ctx);
        this._drawGrowthStacks(ctx);
    }

    _drawStackReleaseFlash(ctx) {
        if (this.state.stackReleaseFlash <= 0) return;
        const progress = 1 - this.state.stackReleaseFlash / HERO_COMBAT_CONFIG.growth.releaseFlashDuration;
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = "#fff4b8";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(this.owner.position.x, this.owner.position.y, this.owner.radius + 12 + progress * 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawGrowthStacks(ctx) {
        const stacks = this.state.growthStacks;
        const segmentAngle = (Math.PI * 2) / HERO_COMBAT_CONFIG.growth.stackCap;
        const pulse = this.state.stackGainFlash / HERO_COMBAT_CONFIG.growth.gainFlashDuration;
        const radius = this.owner.radius + 28 + pulse * 2;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineWidth = 4 + pulse * 2;
        for (const index of Array.from({ length: stacks }, (_, value) => value)) {
            const start = -Math.PI / 2 + index * segmentAngle + 0.05;
            ctx.strokeStyle = index === stacks - 1 && pulse > 0 ? "#fff4b8" : "#ffd84a";
            ctx.beginPath();
            ctx.arc(this.owner.position.x, this.owner.position.y, radius, start, start + segmentAngle - 0.1);
            ctx.stroke();
        }
        ctx.restore();
    }

    getUiState() {
        return {
            label: `Core ${this.state.growthStacks}/5`,
            progress:
                this.state.growthStacks >= HERO_COMBAT_CONFIG.growth.stackCap
                    ? 1
                    : (this.state.growthStacks + this.state.chargeTimer) / HERO_COMBAT_CONFIG.growth.stackCap
        };
    }

    drawFace(ctx, rotation, ball) {
        const { r } = this._faceContext(ball);
        this._sharpEye(ctx, ball, -0.2, -0.08, 1, 0.06);
        this._sharpEye(ctx, ball, 0.2, -0.08, 1, 0.06);
        ctx.beginPath();
        ctx.arc(0, 0.12 * r, 0.1 * r, 0.15, Math.PI - 0.15);
        ctx.stroke();
        return true;
    }
}
