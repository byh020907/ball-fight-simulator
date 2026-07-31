import { Vector2 } from "../core.js";
import { HeroShieldShard } from "../entities/heroShieldShard.js";
import { enforceActiveEntityLimit } from "../entities/activeEntityLimit.js";
import { HeroShieldBreakEffect } from "../effects/heroEffects.js";
import { CooldownBank } from "../game-kit/physics/index.js";
import { Ability } from "./ability.js";
import { HERO_COMBAT_CONFIG } from "./heroCombatConfig.js";
import { EnergyShieldVisual } from "./mixins/energyShieldVisual.js";

export const HERO_ORB_STAT_CAP = -1;
export const HERO_ORB_MAX_ACTIVE_PER_OWNER = HERO_COMBAT_CONFIG.core.maximumActivePerOwner;
const STAT_EFFECT_TYPES = ["hp", "damage", "speed", "defense", "skill", "critical"];
const HERO_COOLDOWN_KEYS = Object.freeze({ pursuit: "pursuit", counter: "counter" });

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

export class HeroAbility extends EnergyShieldVisual(Ability) {
    constructor(owner, simulation) {
        super(owner, simulation, HERO_COMBAT_CONFIG.growth.stackInterval);
        this.cooldowns = new CooldownBank({
            [HERO_COOLDOWN_KEYS.pursuit]: HERO_COMBAT_CONFIG.pursuit.interval,
            [HERO_COOLDOWN_KEYS.counter]: HERO_COMBAT_CONFIG.counter.cooldown
        });
        this.state = {
            growthStacks: 0,
            chargeTimer: 0,
            shield: 0,
            shieldDecayTimer: 0,
            stackGainFlash: 0,
            stackReleaseFlash: 0,
            commandWindowRemaining: 0,
            commandWasAiming: false,
            preparedCommand: null,
            commandCycles: new Map(),
            collisionSequences: new Set()
        };
    }

    update(delta, target) {
        this._tickTransientState(delta);
        this._clampShield();
        this._decayShield(delta);
        this._chargeGrowthStacks(delta);
        this._updatePursuit(delta, target);
    }

    _tickTransientState(delta) {
        this.cooldowns.tick(delta);
        this.state.stackGainFlash = Math.max(0, this.state.stackGainFlash - delta);
        this.state.stackReleaseFlash = Math.max(0, this.state.stackReleaseFlash - delta);
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
            if (this.state.growthStacks === HERO_COMBAT_CONFIG.growth.stackCap)
                this.cooldowns.clear(HERO_COOLDOWN_KEYS.pursuit);
            if (this.state.growthStacks === HERO_COMBAT_CONFIG.growth.stackCap) this._openCommandWindow();
        }
    }

    _updatePursuit(delta, fallbackTarget) {
        if (this.state.growthStacks < HERO_COMBAT_CONFIG.growth.stackCap) {
            this.cooldowns.clear(HERO_COOLDOWN_KEYS.pursuit);
            this.state.commandWindowRemaining = 0;
            this.state.commandWasAiming = false;
            return;
        }
        if (!this.cooldowns.isReady(HERO_COOLDOWN_KEYS.pursuit) || this.owner.state.movement) return;

        if (this.state.preparedCommand) return;
        if (this._hasOpenCommandWindow()) {
            const aiming = this.simulation.dragCombat?.input?.state === "aiming";
            if (aiming) {
                this.state.commandWasAiming = true;
                return;
            }
            if (this.state.commandWasAiming) {
                this.state.commandWindowRemaining = 0;
                this.state.commandWasAiming = false;
            } else {
                this.state.commandWindowRemaining = Math.max(0, this.state.commandWindowRemaining - Math.max(0, delta));
                if (this.state.commandWindowRemaining > 0) return;
            }
        }

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
        this.cooldowns.reset(HERO_COOLDOWN_KEYS.pursuit);
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

    _openCommandWindow() {
        if (!this._canAcceptPlayerCommand()) return;
        this.state.commandWindowRemaining = HERO_COMBAT_CONFIG.pursuit.command.inputWindow;
        this.state.commandWasAiming = false;
    }

    _canAcceptPlayerCommand() {
        const runtime = this.simulation.dragCombat;
        return Boolean(
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            runtime &&
            !runtime.automated &&
            this.simulation.commandResource?.canSpend?.()
        );
    }

    _hasCommandWindow() {
        return this._canAcceptPlayerCommand() && this._hasOpenCommandWindow();
    }

    _hasOpenCommandWindow() {
        return this.state.commandWindowRemaining > 0;
    }

    getCommandState() {
        if (!this.simulation.abilityCommandEnabled || this.simulation.playerBall !== this.owner) {
            return { available: false, reserveResource: false };
        }
        const full = this.state.growthStacks >= HERO_COMBAT_CONFIG.growth.stackCap;
        return {
            available: full && this._hasOpenCommandWindow(),
            reserveResource: !full || !this._hasOpenCommandWindow()
        };
    }

    prepareCommand(intent) {
        if (
            this.state.growthStacks < HERO_COMBAT_CONFIG.growth.stackCap ||
            (!this._hasOpenCommandWindow() && !this.state.commandWasAiming)
        )
            return intent;
        this.state.preparedCommand = { ...intent, direction: { ...intent.direction } };
        this.state.commandWindowRemaining = 0;
        this.state.commandWasAiming = false;
        return this.state.preparedCommand;
    }

    resolveCommandCollision(event, { context } = {}) {
        const intent = this.state.preparedCommand;
        if (
            !intent ||
            intent.sequence !== event.commandSequence ||
            !event.target ||
            !this.simulation.isHostile(this.owner, event.target) ||
            this.state.collisionSequences.has(event.commandSequence)
        )
            return { handled: false, runDefaultOnCollision: true };
        this.state.collisionSequences.add(event.commandSequence);
        context.heroCommandSequence = event.commandSequence;
        context.heroCommandDirection = { ...intent.direction };
        return { handled: true, runDefaultOnCollision: true };
    }

    onFighterCollisionDamageResolved(target, actualDamage, context = {}) {
        if (!target) return;
        const commandSequence = context.heroCommandSequence;
        if (Number.isFinite(commandSequence)) {
            const intent = this.state.preparedCommand;
            if (intent?.sequence !== commandSequence) return;
            this._releaseGrowthCores(context.contactPoint ?? target.position, {
                direction: context.heroCommandDirection,
                commandSequence
            });
            this.state.preparedCommand = null;
            return;
        }
        this._releaseGrowthCores(context.contactPoint ?? target.position);
    }

    _releaseGrowthCores(contactPoint, command = null) {
        const stackCount = this.state.growthStacks;
        if (stackCount <= 0) return;
        this.state.growthStacks = 0;
        this.state.chargeTimer = 0;
        this.cooldowns.clear(HERO_COOLDOWN_KEYS.pursuit);
        this.state.stackReleaseFlash = HERO_COMBAT_CONFIG.growth.releaseFlashDuration;
        if (Number.isFinite(command?.commandSequence)) {
            this.state.commandCycles.set(command.commandSequence, {
                released: stackCount,
                collected: 0,
                shield: 0,
                heal: 0,
                settled: 0,
                finalized: false
            });
        }
        for (const [index] of Array.from({ length: stackCount }).entries()) {
            const direction = command
                ? this._getCommandCoreDirection(command.direction, index, stackCount)
                : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
            this._spawnCore(pickHeroOrbEffectType(), contactPoint, direction, command?.commandSequence ?? null);
        }
        this.simulation.spawnPulse(new Vector2(contactPoint.x, contactPoint.y), "#ffd85a");
        this.simulation.playSound("orb", 0.9);
    }

    _getCommandCoreDirection(direction, index, count) {
        const base = new Vector2(direction?.x ?? 1, direction?.y ?? 0);
        if (base.length() <= 0.001) base.x = 1;
        const center = Math.atan2(base.y, base.x);
        const progress = count <= 1 ? 0.5 : index / (count - 1);
        const angle = center + (progress - 0.5) * HERO_COMBAT_CONFIG.pursuit.command.fanAngle;
        return Vector2.fromAngle(angle, 1);
    }

    _spawnCore(effectType, contactPoint, direction, commandSequence = null) {
        this._enforceOwnerCoreLimit();
        const speedMultiplier =
            HERO_COMBAT_CONFIG.core.speedMinMultiplier +
            Math.random() * (HERO_COMBAT_CONFIG.core.speedMaxMultiplier - HERO_COMBAT_CONFIG.core.speedMinMultiplier);
        const speed = computeOwnerCombatSpeed(this.owner) * speedMultiplier;
        return this.simulation.spawnHeroOrb(
            this.owner,
            new Vector2(contactPoint.x, contactPoint.y),
            direction.clone().scale(speed),
            effectType,
            HERO_COMBAT_CONFIG.core.lifetime,
            {
                collectionGraceDuration: HERO_COMBAT_CONFIG.core.collectionGraceDuration,
                sourceAbility: this,
                commandSequence,
                onSettled: (event) => this._settleCommandCore(commandSequence, event)
            }
        );
    }

    _getActiveOwnerCores() {
        return this.simulation.entities.filter(
            (entity) => entity.constructor?.name === "HeroOrb" && entity.owner === this.owner && !entity.isExpired
        );
    }

    _enforceOwnerCoreLimit() {
        enforceActiveEntityLimit(this._getActiveOwnerCores(), HERO_ORB_MAX_ACTIVE_PER_OWNER, {
            reserveSlots: 1,
            expire: (orb) => orb.settle?.({ collected: false }) ?? (orb.isExpired = true)
        });
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
        const commandCycle = this.state.commandCycles.get(orb?.commandSequence);
        if (commandCycle) commandCycle.collected += 1;
        if (!result?.applied) return { shield: 0, heal: 0 };
        const upgrade = this.getLevelUpgrade();
        const shield = upgrade.heroArmor ? this._addShieldFromCore() : 0;
        const heal = upgrade.coreRecovery ? this._healFromCore() : 0;
        if (commandCycle) {
            commandCycle.shield += shield;
            commandCycle.heal += heal;
        }
        return { shield, heal };
    }

    _addShieldFromCore() {
        const gained = this.owner.maxHp * HERO_COMBAT_CONFIG.armor.shieldPerCoreMaxHpRatio;
        const previous = this.state.shield;
        this.state.shield = Math.min(this.getMaximumShield(), previous + gained);
        if (this.state.shield <= previous) return 0;
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#ffe66b", {
            count: 8,
            speed: 90,
            radiusMin: 2,
            radiusMax: 4,
            upBias: 12
        });
        return this.state.shield - previous;
    }

    _healFromCore() {
        const restored = this.owner.heal(this.owner.maxHp * HERO_COMBAT_CONFIG.core.recoveryPerCoreMaxHpRatio);
        if (restored <= 0) return 0;
        this.simulation.spawnActionText(this.owner.position.clone(), `회복 +${restored}`, "#55cc77");
        this.simulation.playSound("powerup", 1.05);
        return restored;
    }

    _settleCommandCore(commandSequence) {
        if (!Number.isFinite(commandSequence)) return;
        const cycle = this.state.commandCycles.get(commandSequence);
        if (!cycle || cycle.finalized) return;
        cycle.settled += 1;
        if (cycle.settled >= cycle.released) this._finalizeCommandCycle(commandSequence);
    }

    _finalizeCommandCycle(commandSequence) {
        const cycle = this.state.commandCycles.get(commandSequence);
        if (!cycle || cycle.finalized) return;
        cycle.finalized = true;
        this.recordAbilityResult({
            commandSequence,
            resultType: "hero-command-core-cycle",
            success: cycle.collected > 0,
            value: {
                released: cycle.released,
                collected: cycle.collected,
                shield: cycle.shield,
                heal: cycle.heal
            }
        });
        this.state.commandCycles.delete(commandSequence);
        this.state.collisionSequences.delete(commandSequence);
    }

    onCommandEnd(event) {
        if (event.reason === "plain-hit" || event.reason === "rear-hit" || event.reason === "shield-counter") return;
        if (this.state.preparedCommand?.sequence === event.commandSequence) this.state.preparedCommand = null;
        this.state.collisionSequences.delete(event.commandSequence);
    }

    onBattleEnded() {
        for (const orb of this._getActiveOwnerCores().filter((entity) => Number.isFinite(entity.commandSequence))) {
            orb.settle?.({ collected: false });
        }
        for (const commandSequence of [...this.state.commandCycles.keys()]) this._finalizeCommandCycle(commandSequence);
        this.state.preparedCommand = null;
        this.state.commandWindowRemaining = 0;
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

    _decayShield(delta) {
        if (this.state.shield <= 0) {
            this.state.shieldDecayTimer = 0;
            return;
        }
        const config = HERO_COMBAT_CONFIG.armor;
        this.state.shieldDecayTimer += Math.max(0, delta);
        const tickCount = Math.floor((this.state.shieldDecayTimer + Number.EPSILON) / config.decayInterval);
        if (tickCount <= 0) return;
        this.state.shieldDecayTimer -= tickCount * config.decayInterval;
        const decayPerTick = this.owner.maxHp * config.decayMaxHpRatioPerSecond * config.decayInterval;
        this.state.shield = Math.max(0, this.state.shield - decayPerTick * tickCount);
        if (this.state.shield <= 0) this.state.shieldDecayTimer = 0;
    }

    absorbIncomingDamage(damage, source, label, options = {}) {
        if (!this.getLevelUpgrade().heroArmor || this.state.shield <= 0 || damage <= 0) {
            return { remainingDamage: damage, absorbedDamage: 0 };
        }

        const shieldBefore = this.state.shield;
        const absorbedDamage = Math.min(shieldBefore, damage);
        this.state.shield = Math.max(0, shieldBefore - absorbedDamage);
        this.showEnergyShieldHit(absorbedDamage, source);

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

    _tryLaunchCounter(source) {
        if (!this.cooldowns.isReady(HERO_COOLDOWN_KEYS.counter)) return;
        const direction = Vector2.subtract(source.position, this.owner.position);
        if (direction.length() <= 0.001) return;
        direction.normalize();
        const spawnPosition = Vector2.add(
            this.owner.position,
            direction.clone().scale(this.owner.radius + HERO_COMBAT_CONFIG.counter.radius + 2)
        );
        const damage = this.owner.getTotalAttackDamage() * HERO_COMBAT_CONFIG.counter.damageMultiplier;
        this.simulation.entities.push(new HeroShieldShard(this.owner, spawnPosition, direction, damage));
        this.cooldowns.reset(HERO_COOLDOWN_KEYS.counter);
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
            enemy.applyKnockback?.(direction.normalize().scale(config.knockbackSpeed), config.knockbackDuration);
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
        this.drawEnergyShield(ctx);
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
            label: `Core ${this.state.growthStacks}/${HERO_COMBAT_CONFIG.growth.stackCap}`,
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
