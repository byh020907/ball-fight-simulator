import { applyCollisionImpulse, Vector2 } from "../core.js";
import { ElementalOrb, ElementalWaterBolt } from "../entities/index.js";
import { ElementalChannelEffect, ElementalWetEffect, VisualBurst } from "../effects/index.js";
import { applyMagneticAttraction } from "../physics/index.js";
import { Ability } from "./ability.js";
import {
    ELEMENTAL_COMPOSITE_RECIPES,
    ELEMENTAL_PALETTE,
    chooseElement,
    getElementalCompositeRecipe
} from "./elementalistRecipes.js";

const ELEMENTALIST_CONFIG = Object.freeze({
    channelRange: 850,
    maximumOrbs: 4,
    boltSpeedMultiplier: 2.2,
    orbReleaseSpeed: 165,
    ownerMagnet: { radiusMultiplier: 2, responseRate: 9, attractionSpeed: 900 },
    orbMagnet: { radius: 145, responseRate: 3.8, attractionSpeed: 120 },
    wetDuration: 2.5
});

const SINGLE_SPELLS = Object.freeze({
    fire: { duration: 0.5, damageMultiplier: 1.52, ticks: 5 },
    electric: { duration: 0.5, damageMultiplier: 1.38, ticks: 5 },
    frost: { duration: 0.7, damageMultiplier: 1, ticks: 1, slow: { duration: 1.2, amount: 0.55 } },
    wind: { duration: 0.8, damageMultiplier: 1.14, ticks: 4, tangentImpulse: 0.16 },
    earth: { duration: 0.6, damageMultiplier: 1.48, ticks: 5 }
});

let nextChannelId = 1;

function channelProgress(channel) {
    return Math.max(0, Math.min(1, channel.elapsed / channel.duration));
}

function exactTickDamage(totalDamage, tickNumber, maximumTicks) {
    const previous = Math.round((totalDamage * (tickNumber - 1)) / maximumTicks);
    const current = Math.round((totalDamage * tickNumber) / maximumTicks);
    return current - previous;
}

export class ElementalistAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 1.5);
        this.activeChannels = [];
        this.activeOrbs = [];
        this.rng = simulation.rng ?? Math.random;
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
        while (this.activeOrbs.length >= ELEMENTALIST_CONFIG.maximumOrbs) {
            this.activeOrbs.sort((left, right) => left.createdAt - right.createdAt)[0].expire();
            this._pruneOrbs();
        }
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
        const target = orb.isComposite
            ? this.selectCompositeMemoryTarget(orb.materialMemories)
            : this._selectSingleChannelTarget(orb);
        orb.expire();
        if (!target) return;
        const elements = [...orb.elements];
        const recipe = orb.recipe;
        const wetSnapshot = this._consumeWet(target);
        const channel = this._createChannel({ elements, recipe, target, wetSnapshot });
        this.activeChannels.push(channel);
        this.simulation.entities.push(
            new ElementalChannelEffect({
                channel,
                source: this.owner,
                target,
                elements,
                recipe,
                duration: channel.duration
            })
        );
        this.simulation.playSound("charge", 0.7);
    }

    _createChannel({ elements, recipe, target, wetSnapshot }) {
        const spell = recipe ?? SINGLE_SPELLS[elements[0]];
        return {
            id: nextChannelId++,
            elements,
            recipe,
            target,
            duration: recipe ? 1 : spell.duration,
            elapsed: 0,
            wetSnapshot,
            tickCount: 0,
            tickAccumulator: 0,
            displacement: 0,
            lastTickAt: -Infinity,
            lastTargetPosition: target.position.clone(),
            started: false,
            finished: false,
            cancelled: false
        };
    }

    _updateChannels(delta) {
        for (const channel of this.activeChannels) {
            if (!this._isValidTarget(channel.target)) {
                channel.cancelled = true;
                continue;
            }
            channel.elapsed = Math.min(channel.duration, channel.elapsed + delta);
            if (channel.recipe) this._updateCompositeChannel(channel, delta);
            else this._updateSingleChannel(channel, delta);
            if (channel.elapsed >= channel.duration) {
                this._finishChannel(channel);
                channel.finished = true;
            }
        }
        this.activeChannels = this.activeChannels.filter((channel) => !channel.finished && !channel.cancelled);
    }

    _updateSingleChannel(channel, delta) {
        const element = channel.elements[0];
        const spell = SINGLE_SPELLS[element];
        if (!channel.started) {
            channel.started = true;
            if (spell.slow) channel.target.applySlow?.(spell.slow.duration, spell.slow.amount);
            this._applyWetReaction(channel.target, channel.elements, channel.wetSnapshot, 1);
        }
        if (element === "wind") this._applyTangentImpulse(channel.target, spell.tangentImpulse, delta);
        if (element !== "frost") this._applyScheduledTicks(channel, spell.damageMultiplier, spell.ticks);
        if (element === "frost" && channel.tickCount === 0)
            this._dealDamage(channel.target, spell.damageMultiplier, "냉기");
    }

    _updateCompositeChannel(channel, delta) {
        const recipe = channel.recipe;
        if (!channel.started) {
            channel.started = true;
            this._applyWetReaction(channel.target, channel.elements, channel.wetSnapshot, 1);
            if (recipe.slow) channel.target.applySlow?.(recipe.slow.duration, recipe.slow.amount);
        }
        const progress = channelProgress(channel);
        if (progress >= 0.2 && progress <= 0.8) {
            if (recipe.tangentImpulse) this._applyTangentImpulse(channel.target, recipe.tangentImpulse, delta);
            if (recipe.displacementTicks) this._updateThunderPursuit(channel);
            else this._applyScheduledTicks(channel, recipe.damageMultiplier, 4, 0.2, 0.8);
        }
    }

    _updateThunderPursuit(channel) {
        const movement = Vector2.subtract(channel.target.position, channel.lastTargetPosition).length();
        channel.lastTargetPosition = channel.target.position.clone();
        channel.displacement += movement;
        const threshold = Math.max(1, channel.target.radius * 2);
        while (
            channel.displacement >= threshold &&
            channel.tickCount < 3 &&
            channel.elapsed - channel.lastTickAt >= 0.15
        ) {
            channel.displacement -= threshold;
            channel.lastTickAt = channel.elapsed;
            channel.tickCount += 1;
            this._dealExactTick(
                channel.target,
                channel.recipe.damageMultiplier,
                channel.tickCount,
                3,
                channel.recipe.name
            );
        }
    }

    _applyScheduledTicks(channel, multiplier, maximumTicks, start = 0, end = 1) {
        const progress = channelProgress(channel);
        const normalized = Math.max(0, Math.min(1, (progress - start) / Math.max(0.001, end - start)));
        const expectedTicks = Math.min(maximumTicks, Math.floor(normalized * maximumTicks + 1e-9));
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
        if (channel.recipe?.displacementTicks) {
            this.simulation.entities.push(
                new VisualBurst(channel.target.position.clone(), this.getElementColor(channel.elements[0]), 70, 0.2)
            );
        }
    }

    _applyWetReaction(target, elements, wetSnapshot, ratio) {
        if (!wetSnapshot) return;
        if (elements.includes("fire")) {
            this._dealDamage(target, 0.2 * ratio, "증기 충격");
            const away = Vector2.subtract(target.position, this.owner.position).normalize();
            target.applyImpulse(away.scale(target.stats.baseSpeed * 0.16 * ratio));
        }
        if (elements.includes("electric")) this._dealDamage(target, 0.18 * ratio, "과전류");
        if (elements.includes("wind")) this._dealDamage(target, 0.15 * ratio, "물회오리");
        const rootDuration = Math.max(elements.includes("frost") ? 0.45 : 0, elements.includes("earth") ? 0.35 : 0);
        if (rootDuration > 0) target.applySlow?.(rootDuration * ratio, 0);
    }

    _applyTangentImpulse(target, strength, delta) {
        const radial = Vector2.subtract(target.position, this.owner.position);
        if (radial.length() <= 0.001) return;
        const tangent = new Vector2(-radial.y, radial.x).normalize();
        target.applyImpulse(tangent.scale((target.stats?.baseSpeed ?? 100) * strength * Math.max(0, delta)));
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
        target.state ||= {};
        const wetUntil = this.simulation.elapsed + ELEMENTALIST_CONFIG.wetDuration;
        target.state.elementalWetUntil = wetUntil;
        const currentEffect = target.state.elementalWetEffect;
        if (currentEffect instanceof ElementalWetEffect && !currentEffect.isExpired) {
            currentEffect.refresh(wetUntil);
            return;
        }
        const effect = new ElementalWetEffect({
            target,
            simulation: this.simulation,
            expiresAt: wetUntil
        });
        target.state.elementalWetEffect = effect;
        this.simulation.entities.push(effect);
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

    _selectSingleChannelTarget(orb) {
        const remembered = orb.targetMemory;
        if (this.getLevelUpgrade().wetDuration && this._isValidTarget(remembered) && this._hasWet(remembered)) {
            return remembered;
        }
        return this._nearestValidEnemy();
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
        const expiresAt = Math.max(first.expiresAt, second.expiresAt);
        const composite = first.makeComposite(second, recipe, position, new Vector2(), expiresAt);
        composite.applyImpulse(velocity);
        first.expire();
        second.expire();
        this.activeOrbs.push(composite);
        this.simulation.entities.push(composite);
        this.simulation.spawnPulse(position.clone(), "#ffffff");
    }

    applyOwnerMagnet(orb, delta, graceActive) {
        if (!this.getLevelUpgrade().orbitalFusion || graceActive) return;
        const config = ELEMENTALIST_CONFIG.ownerMagnet;
        applyMagneticAttraction(orb, this.owner, delta, {
            radius: this.owner.radius * config.radiusMultiplier,
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
            label: `원소 오브 ${this.activeOrbs.length}/4`,
            text: channels > 0 ? `채널 ${channels}` : null,
            progress: this.cooldownProgress
        };
    }
}

export { ELEMENTALIST_CONFIG, ELEMENTAL_COMPOSITE_RECIPES, SINGLE_SPELLS };
