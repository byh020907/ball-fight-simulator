import { applyCollisionImpulse, Vector2 } from "../core.js";
import { ELEMENTAL_ORB_CONFIG, ElementalOrb, ElementalWaterBolt } from "../entities/index.js";
import { enforceActiveEntityLimit } from "../entities/activeEntityLimit.js";
import {
    BURNING_EFFECT_CONFIG,
    ElementalChannelEffect,
    ElementalWetReactionEffect,
    VisualBurst,
    applyBurningEffect,
    applyElementalWet
} from "../effects/index.js";
import { applyMagneticAttraction } from "../physics/index.js";
import { Ability } from "./ability.js";
import {
    ELEMENTAL_COMPOSITE_RECIPES,
    ELEMENTAL_PALETTE,
    chooseElement,
    getElementalCompositeRecipe
} from "./elementalistRecipes.js";

const ELEMENTALIST_CONFIG = Object.freeze({
    channelRange: 600,
    channelDuration: 2,
    channelTickInterval: 0.08,
    maximumOrbs: ELEMENTAL_ORB_CONFIG.maximumActivePerCaster,
    boltSpeedMultiplier: 2.2,
    orbReleaseSpeed: 165,
    ownerMagnet: { responseRate: 9, attractionSpeed: 900 },
    orbMagnet: { radius: 145, responseRate: 3.8, attractionSpeed: 120 },
    manaLeap: {
        maximumDistanceRadiusMultiplier: 2.5,
        rangeBufferRadiusMultiplier: 0.25,
        duration: 0.22,
        retriggerCooldown: 0.4
    },
    wetDuration: 2.5
});

const SINGLE_SPELLS = Object.freeze({
    fire: { damageMultiplier: 1, ignitionDamageMultiplier: 0.5 },
    electric: { damageMultiplier: 1.5 },
    frost: { damageMultiplier: 1, slow: { duration: 1.2, amount: 0.55 } },
    wind: { damageMultiplier: 1.15, pushImpulse: 0.15 },
    earth: { damageMultiplier: 1.5 }
});

const WET_REACTION_CONFIG = Object.freeze({
    fire: Object.freeze({ damageMultiplier: 0.2, label: "증기 충격", impulseScale: 0.15 }),
    electric: Object.freeze({ damageMultiplier: 0.5, label: "과전류" }),
    frost: Object.freeze({ rootDuration: 0.45, progressiveSlowStart: 0.55, label: "냉기 속박" }),
    wind: Object.freeze({ damageMultiplier: 0.15, label: "물회오리" }),
    earth: Object.freeze({ rootDuration: 0.35, immediate: true, label: "대지 속박" })
});

let nextChannelId = 1;
const TICK_BOUNDARY_EPSILON = 1e-9;

function channelProgress(channel) {
    return Math.max(0, Math.min(1, channel.elapsed / channel.duration));
}

function exactTickDamage(totalDamage, tickNumber, maximumTicks) {
    const previous = Math.round((totalDamage * (tickNumber - 1)) / maximumTicks);
    const current = Math.round((totalDamage * tickNumber) / maximumTicks);
    return current - previous;
}

export function getElementalistWetDamageComparison(elements, recipe = null) {
    const directDamageMultiplier = recipe?.damageMultiplier ?? SINGLE_SPELLS[elements[0]]?.damageMultiplier ?? 0;
    const ignitionDamageMultiplier = elements.includes("fire") ? SINGLE_SPELLS.fire.ignitionDamageMultiplier : 0;
    const baseMultiplier = directDamageMultiplier + ignitionDamageMultiplier;
    const reactions = elements.map((element) => WET_REACTION_CONFIG[element]).filter(Boolean);
    const wetBonusMultiplier = reactions.reduce((total, reaction) => total + (reaction.damageMultiplier ?? 0), 0);
    const rootDuration = reactions.reduce((longest, reaction) => Math.max(longest, reaction.rootDuration ?? 0), 0);
    return {
        baseMultiplier,
        wetBonusMultiplier,
        wetTotalMultiplier: Math.round((baseMultiplier + wetBonusMultiplier) * 100) / 100,
        increasePercent: baseMultiplier > 0 ? Math.round((wetBonusMultiplier / baseMultiplier) * 100) : 0,
        damageReactionLabels: reactions
            .filter((reaction) => reaction.damageMultiplier)
            .map((reaction) => reaction.label),
        rootDuration
    };
}

export class ElementalistAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 1.5);
        this.activeChannels = [];
        this.activeOrbs = [];
        this.rng = simulation.rng ?? Math.random;
        this.nextManaLeapAt = 0;
    }

    update(delta, target) {
        if (this.owner.flags.defeated || this.simulation.finished) {
            this.cleanupElementalState();
            return;
        }
        this.tickCooldown(delta);
        this._updateChannels(delta);
        this._pruneOrbs();
        if (this.getLevelUpgrade().orbitalFusion) this._processOrbInteractions(delta);
        if (!this.cooldownReady || !this._isValidTarget(target, false)) return;
        this.resetCooldown(this.cooldown);
        this._fireWaterBolt(target);
    }

    _fireWaterBolt(target) {
        const direction = Vector2.subtract(target.position, this.owner.position).normalize();
        const bolt = new ElementalWaterBolt(this.owner, this.owner.position.clone(), new Vector2(), this);
        bolt.applyImpulse(direction.scale(this.owner.stats.baseSpeed * ELEMENTALIST_CONFIG.boltSpeedMultiplier));
        this.simulation.entities.push(bolt);
        this.simulation.playSound("shoot", 0.55);
    }

    onWaterBoltHit(target, position) {
        if (this.getLevelUpgrade().wetDuration) this._applyWet(target);
        const elements = [chooseElement(this.rng)];
        if (this.getLevelUpgrade().dualOrbChance && this.rng() < this.getLevelUpgrade().dualOrbChance) {
            elements.push(chooseElement(this.rng, elements));
        }
        elements.forEach((element, index) => this._spawnOrb(element, target, position, index, elements.length));
    }

    _spawnOrb(element, targetMemory, position, index, count) {
        this._pruneOrbs();
        enforceActiveEntityLimit(this.activeOrbs, ELEMENTALIST_CONFIG.maximumOrbs, {
            reserveSlots: 1,
            getOrder: (orb) => orb.createdAt,
            expire: (orb) => orb.expire()
        });
        this._pruneOrbs();
        const spread = count === 1 ? 0 : (index - (count - 1) / 2) * 0.7;
        const angle = this.rng() * Math.PI * 2 + spread;
        const orb = new ElementalOrb({
            owner: this.owner,
            element,
            position: Vector2.add(position, Vector2.fromAngle(angle, 24)),
            targetMemory,
            ability: this
        });
        orb.applyImpulse(Vector2.fromAngle(angle, ELEMENTALIST_CONFIG.orbReleaseSpeed));
        this.activeOrbs.push(orb);
        this.simulation.entities.push(orb);
        this.simulation.spawnExplosion(orb.position.clone(), this.getElementColor(element));
    }

    consumeOrbByOwner(orb) {
        if (orb.isExpired) return;
        const elements = [...orb.elements];
        const recipe = orb.recipe;
        const channel = this._createChannel({
            elements,
            recipe,
            target: null,
            wetSnapshot: false,
            targetMemory: orb.targetMemory,
            materialMemories: orb.isComposite ? [...orb.materialMemories] : null
        });
        orb.expire();
        this.activeChannels.push(channel);
        const target = this._selectChannelTarget(channel);
        if (target) this._activateChannel(channel, target);
    }

    _activateChannel(channel, target) {
        channel.target = target;
        channel.wetSnapshot = this._consumeWet(target);
        channel.tickCount = Math.floor(
            channel.elapsed / ELEMENTALIST_CONFIG.channelTickInterval + TICK_BOUNDARY_EPSILON
        );
        this._tryManaLeap(target);
        this.simulation.entities.push(
            new ElementalChannelEffect({
                channel,
                source: this.owner,
                target,
                elements: channel.elements,
                recipe: channel.recipe,
                duration: channel.duration - channel.elapsed
            })
        );
        this.simulation.playSound("charge", 0.7);
    }

    _tryManaLeap(target) {
        if (!this.getLevelUpgrade().manaLeap || this.owner.state.movement) return false;
        if (this.simulation.elapsed < this.nextManaLeapAt) return false;

        const away = Vector2.subtract(this.owner.position, target.position);
        const targetDistance = away.length();
        if (targetDistance <= 0.001) return false;

        const config = ELEMENTALIST_CONFIG.manaLeap;
        const rangeBuffer = this.owner.radius * config.rangeBufferRadiusMultiplier;
        const availableDistance = Math.max(0, ELEMENTALIST_CONFIG.channelRange - targetDistance - rangeBuffer);
        const maximumDistance = this.owner.radius * config.maximumDistanceRadiusMultiplier;
        const leapDistance = Math.min(maximumDistance, availableDistance);
        if (leapDistance <= 0) return false;

        this.owner.initiateDash(away.normalize(), {
            duration: config.duration,
            multiplier: 1,
            speedOverride: leapDistance / config.duration,
            color: "#8fdcff",
            collisionDamage: 0,
            collisionLabel: "Mana Leap",
            showRing: false
        });
        this.nextManaLeapAt = this.simulation.elapsed + config.retriggerCooldown;
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#8fdcff", {
            count: 10,
            speed: 135,
            radiusMin: 2,
            radiusMax: 4
        });
        this.simulation.playSound("dash", 0.85);
        return true;
    }

    _createChannel({ elements, recipe, target, wetSnapshot, targetMemory = null, materialMemories = null }) {
        return {
            id: nextChannelId++,
            elements,
            recipe,
            target,
            targetMemory,
            materialMemories,
            duration: ELEMENTALIST_CONFIG.channelDuration,
            elapsed: 0,
            wetSnapshot,
            tickCount: 0,
            started: false,
            fireIgnited: false,
            wetReactionStarted: false,
            wetReactionSettled: false,
            finished: false,
            cancelled: false
        };
    }

    _updateChannels(delta) {
        for (const channel of this.activeChannels) {
            if (channel.target && !this._isValidTarget(channel.target)) {
                this._cancelChannel(channel);
                continue;
            }
            channel.elapsed = Math.min(channel.duration, channel.elapsed + delta);
            if (!channel.target) {
                if (channel.elapsed >= channel.duration) {
                    channel.finished = true;
                    continue;
                }
                const target = this._selectChannelTarget(channel);
                if (!target) continue;
                this._activateChannel(channel, target);
            }
            this._updateChannel(channel, delta);
            if (channel.elapsed >= channel.duration) {
                this._finishChannel(channel);
                channel.finished = true;
            }
        }
        this.activeChannels = this.activeChannels.filter((channel) => !channel.finished && !channel.cancelled);
    }

    _updateChannel(channel, delta) {
        const spell = channel.recipe ?? SINGLE_SPELLS[channel.elements[0]];
        if (!channel.started) {
            channel.started = true;
            if (spell.slow) channel.target.applySlow?.(spell.slow.duration, spell.slow.amount);
            this._startWetReaction(channel);
        }
        this._updateWetReaction(channel, delta);
        if (channel.elements.includes("wind")) {
            this._applyAwayImpulse(channel.target, spell.pushImpulse ?? SINGLE_SPELLS.wind.pushImpulse, delta);
        }
        this._applyChannelDamageTicks(channel, spell.damageMultiplier);
    }

    _applyChannelDamageTicks(channel, multiplier) {
        const maximumTicks = Math.round(channel.duration / ELEMENTALIST_CONFIG.channelTickInterval);
        const expectedTicks = Math.min(
            maximumTicks,
            Math.floor(channel.elapsed / ELEMENTALIST_CONFIG.channelTickInterval + TICK_BOUNDARY_EPSILON)
        );
        if (!channel.fireIgnited && channel.elements.includes("fire") && expectedTicks > channel.tickCount) {
            channel.fireIgnited = true;
            applyBurningEffect({
                source: this.owner,
                target: channel.target,
                simulation: this.simulation,
                label: "원소 점화",
                config: BURNING_EFFECT_CONFIG,
                totalDamage: this._getTotalAttack() * SINGLE_SPELLS.fire.ignitionDamageMultiplier
            });
        }
        while (channel.tickCount < expectedTicks) {
            channel.tickCount += 1;
            this._dealExactTick(
                channel.target,
                multiplier,
                channel.tickCount,
                maximumTicks,
                channel.recipe?.name ?? "원소 주문"
            );
        }
    }

    _finishChannel(channel) {
        if (channel.cancelled || channel.target.flags.defeated) return;
        this._settleWetReaction(channel);
        if (channel.recipe?.finishBurst) {
            this.simulation.entities.push(
                new VisualBurst(channel.target.position.clone(), this.getElementColor(channel.elements[0]), 70, 0.2)
            );
        }
    }

    _startWetReaction(channel) {
        if (!channel.wetSnapshot || channel.wetReactionStarted) return;
        channel.wetReactionStarted = true;
        const immediateElements = channel.elements.filter((element) => WET_REACTION_CONFIG[element]?.immediate);
        if (immediateElements.length === 0) return;
        const rootDuration = immediateElements.reduce(
            (longest, element) => Math.max(longest, WET_REACTION_CONFIG[element].rootDuration ?? 0),
            0
        );
        if (rootDuration > 0) channel.target.applySlow?.(rootDuration, 0);
        this._spawnWetReactionEffect(channel.target, immediateElements);
    }

    _updateWetReaction(channel, delta) {
        if (!channel.wetSnapshot || !channel.elements.includes("frost")) return;
        const immediateEarthRoot = channel.elements.includes("earth") ? WET_REACTION_CONFIG.earth.rootDuration : 0;
        if (channel.elapsed <= immediateEarthRoot) return;
        const reaction = WET_REACTION_CONFIG.frost;
        const remainingMovement = reaction.progressiveSlowStart * (1 - channelProgress(channel));
        channel.target.applySlow?.(Math.max(0.1, delta + 0.05), remainingMovement);
    }

    _cancelChannel(channel) {
        if (channel.cancelled || channel.finished) return;
        this._startWetReaction(channel);
        this._settleWetReaction(channel);
        channel.cancelled = true;
    }

    _settleWetReaction(channel) {
        if (!channel.wetSnapshot || channel.wetReactionSettled) return;
        channel.wetReactionSettled = true;
        const settledElements = channel.elements.filter((element) => !WET_REACTION_CONFIG[element]?.immediate);
        if (settledElements.length === 0) return;
        const reactions = settledElements.map((element) => WET_REACTION_CONFIG[element]).filter(Boolean);
        if (!channel.target.flags.defeated) {
            const damageMultiplier = reactions.reduce((total, reaction) => total + (reaction.damageMultiplier ?? 0), 0);
            if (damageMultiplier > 0) {
                const labels = reactions
                    .filter((reaction) => reaction.damageMultiplier)
                    .map((reaction) => reaction.label)
                    .join(" + ");
                this._dealDamage(channel.target, damageMultiplier, labels);
            }
            const impulseScale = reactions.reduce((total, reaction) => total + (reaction.impulseScale ?? 0), 0);
            if (impulseScale > 0) {
                const away = Vector2.subtract(channel.target.position, this.owner.position).normalize();
                channel.target.applyImpulse(away.scale(channel.target.stats.baseSpeed * impulseScale));
            }
            const rootDuration = reactions.reduce(
                (longest, reaction) => Math.max(longest, reaction.rootDuration ?? 0),
                0
            );
            if (rootDuration > 0) channel.target.applySlow?.(rootDuration, 0);
        }
        this._spawnWetReactionEffect(channel.target, settledElements);
    }

    _spawnWetReactionEffect(target, elements) {
        this.simulation.entities.push(new ElementalWetReactionEffect({ target, elements }));
    }

    _applyAwayImpulse(target, strength, delta) {
        const away = Vector2.subtract(target.position, this.owner.position);
        if (away.length() <= 0.001) return;
        target.applyImpulse(away.normalize().scale((target.stats?.baseSpeed ?? 100) * strength * Math.max(0, delta)));
    }

    _dealExactTick(target, multiplier, tickNumber, maximumTicks, label) {
        const totalDamage = this._getTotalAttack() * multiplier;
        target.takeDamage(exactTickDamage(totalDamage, tickNumber, maximumTicks), this.owner, label);
    }

    _dealDamage(target, multiplier, label) {
        target.takeDamage(Math.round(this._getTotalAttack() * multiplier), this.owner, label);
    }

    _getTotalAttack() {
        return this.owner.stats.baseDamage * (this.owner.getStatModifiers?.().damage ?? 1);
    }

    _applyWet(target) {
        applyElementalWet(target, this.simulation, ELEMENTALIST_CONFIG.wetDuration);
    }

    _hasWet(target) {
        return (target?.state?.elementalWetUntil ?? 0) > this.simulation.elapsed;
    }

    _consumeWet(target) {
        if (!this._hasWet(target)) return false;
        target.state.elementalWetUntil = 0;
        target.state.elementalWetEffect?.consume?.();
        return true;
    }

    _selectSingleChannelTarget(remembered) {
        if (this.getLevelUpgrade().wetDuration && this._isValidTarget(remembered) && this._hasWet(remembered)) {
            return remembered;
        }
        return this._nearestValidEnemy();
    }

    _selectChannelTarget(channel) {
        if (channel.materialMemories) return this.selectCompositeMemoryTarget(channel.materialMemories);
        return this._selectSingleChannelTarget(channel.targetMemory);
    }

    selectCompositeMemoryTarget(memories) {
        const candidates = memories
            .filter(({ target }) => this._isValidTarget(target) && this._hasWet(target))
            .filter(({ target }, index, all) => all.findIndex((candidate) => candidate.target === target) === index);
        if (candidates.length === 1) return candidates[0].target;
        if (candidates.length > 1) {
            return candidates
                .map((candidate) => ({
                    ...candidate,
                    distance: Vector2.subtract(candidate.target.position, this.owner.position).length()
                }))
                .sort((left, right) => left.distance - right.distance || left.createdAt - right.createdAt)[0].target;
        }
        return this._nearestValidEnemy();
    }

    _nearestValidEnemy() {
        return this.simulation
            .getEnemiesOf(this.owner)
            .filter((target) => this._isValidTarget(target))
            .sort(
                (left, right) =>
                    Vector2.subtract(left.position, this.owner.position).length() -
                    Vector2.subtract(right.position, this.owner.position).length()
            )[0];
    }

    _isValidTarget(target, requireRange = true) {
        if (!target || target.flags.defeated || !this.simulation.isHostile(this.owner, target)) return false;
        if (!requireRange) return true;
        return Vector2.subtract(target.position, this.owner.position).length() <= ELEMENTALIST_CONFIG.channelRange;
    }

    _processOrbInteractions(delta) {
        const normals = this.activeOrbs.filter((orb) => !orb.isExpired && !orb.isComposite);
        for (const [index, orb] of normals.entries()) {
            for (const other of normals.slice(index + 1)) {
                if (orb.isExpired || other.isExpired) continue;
                const magnetGraceActive = orb.isCollectionGraceActive() || other.isCollectionGraceActive();
                if (orb.element !== other.element && !magnetGraceActive) this._applyOrbPairMagnet(orb, other, delta);
                this._resolveOrbPairContact(orb, other);
            }
        }
    }

    _applyOrbPairMagnet(first, second, delta) {
        applyMagneticAttraction(first, second, delta, ELEMENTALIST_CONFIG.orbMagnet);
        applyMagneticAttraction(second, first, delta, ELEMENTALIST_CONFIG.orbMagnet);
    }

    _resolveOrbPairContact(first, second) {
        const separation = Vector2.subtract(second.position, first.position);
        const distance = separation.length();
        const overlap = first.radius + second.radius - distance;
        if (overlap <= 0) return;
        const normal = distance > 0 ? separation.normalize() : new Vector2(1, 0);
        if (first.element === second.element) {
            first.applyPositionCorrection(normal.clone().scale(-overlap * 0.5));
            second.applyPositionCorrection(normal.clone().scale(overlap * 0.5));
            applyCollisionImpulse(first, second, normal, 0.82, { minApproachSpeed: 80 });
            return;
        }
        this._fuseOrbs(first, second);
    }

    _fuseOrbs(first, second) {
        const recipe = getElementalCompositeRecipe(first.element, second.element);
        if (!recipe) return;
        const position = Vector2.add(first.position, second.position).scale(0.5);
        const velocity = Vector2.add(first.velocity, second.velocity).scale(0.5);
        const composite = first.makeComposite(second, recipe, position, new Vector2());
        composite.applyImpulse(velocity);
        first.expire();
        second.expire();
        this.activeOrbs.push(composite);
        this.simulation.entities.push(composite);
        this.simulation.spawnPulse(position.clone(), "#ffffff");
    }

    applyOwnerMagnet(orb, delta, graceActive) {
        const radiusMultiplier = this.getLevelUpgrade().ownerMagnetRadiusMultiplier;
        if (!radiusMultiplier || graceActive) return;
        const config = ELEMENTALIST_CONFIG.ownerMagnet;
        applyMagneticAttraction(orb, this.owner, delta, {
            radius: this.owner.radius * radiusMultiplier,
            responseRate: config.responseRate,
            attractionSpeed: config.attractionSpeed
        });
    }

    onOrbExpired(orb) {
        this.activeOrbs = this.activeOrbs.filter((candidate) => candidate !== orb && !candidate.isExpired);
    }

    _pruneOrbs() {
        this.activeOrbs = this.activeOrbs.filter((orb) => !orb.isExpired);
    }

    onOwnerDefeated() {
        this.cleanupElementalState();
        return false;
    }

    onBattleEnded() {
        this.cleanupElementalState();
    }

    cleanupElementalState() {
        for (const orb of [...this.activeOrbs]) orb.expire();
        for (const channel of this.activeChannels) channel.cancelled = true;
        this.activeChannels = [];
        for (const entity of this.simulation.entities) {
            if (!entity.state) continue;
            entity.state.elementalWetUntil = 0;
            entity.state.elementalWetEffect?.consume?.();
        }
        for (const entity of this.simulation.entities) {
            if (entity instanceof ElementalChannelEffect && entity.source === this.owner) entity.isExpired = true;
        }
    }

    getCombinationRecipe(first, second) {
        return getElementalCompositeRecipe(first, second);
    }

    getElementColor(element) {
        return ELEMENTAL_PALETTE[element] ?? "#d8c4ff";
    }

    draw(ctx) {
        const colors = Object.values(ELEMENTAL_PALETTE).slice(1);
        ctx.save();
        ctx.lineWidth = 2;
        colors.forEach((color, index) => {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(
                this.owner.position.x,
                this.owner.position.y,
                this.owner.radius + 5,
                (index * Math.PI * 2) / colors.length,
                ((index + 1) * Math.PI * 2) / colors.length
            );
            ctx.stroke();
        });
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        const radius = ball.radius;
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.fillStyle = "#ffffff";
        ctx.lineWidth = Math.max(2, radius * 0.045);
        this._eye(ctx, ball, -0.2, -0.08, 0.065);
        this._eye(ctx, ball, 0.2, -0.08, 0.065);
        this._line(ctx, ball, [
            [-0.11, 0.19],
            [0.11, 0.19]
        ]);
        this._line(ctx, ball, [
            [0, -0.43],
            [0.07, -0.35],
            [0, -0.27],
            [-0.07, -0.35],
            [0, -0.43]
        ]);
        ctx.restore();
        return true;
    }

    getUiState() {
        const channels = this.activeChannels.length;
        return {
            label: `원소 오브 ${this.activeOrbs.length}/${ELEMENTALIST_CONFIG.maximumOrbs}`,
            text: channels > 0 ? `채널 ${channels}` : null,
            progress: this.cooldownProgress
        };
    }
}

export { ELEMENTALIST_CONFIG, ELEMENTAL_COMPOSITE_RECIPES, SINGLE_SPELLS, WET_REACTION_CONFIG };
