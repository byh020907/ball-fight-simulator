import { Vector2 } from "../core.js";
import { HeroResonanceEffect } from "../effects/heroEffects.js";
import { Ability } from "./ability.js";

export const HERO_ORB_STAT_CAP = -1;
export const HERO_ORB_MAX_ACTIVE_PER_OWNER = 5;
const HERO_GROWTH_STACK_CAP = 5;
const HERO_GROWTH_STACK_INTERVAL = 1;
const HERO_CORE_LIFETIME = 8;
const HERO_CORE_SPEED_MIN_MULTIPLIER = 0.72;
const HERO_CORE_SPEED_MAX_MULTIPLIER = 0.96;
const HERO_COLLECTION_GRACE = 0.16;
const HERO_STACK_GAIN_FLASH_DURATION = 0.16;
const HERO_STACK_RELEASE_FLASH_DURATION = 0.28;
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
        super(owner, simulation, HERO_GROWTH_STACK_INTERVAL);
        this.state = {
            growthStacks: 0,
            chargeTimer: 0,
            resonanceFragments: [],
            stackGainFlash: 0,
            stackReleaseFlash: 0
        };
    }

    update(delta) {
        this.state.stackGainFlash = Math.max(0, this.state.stackGainFlash - delta);
        this.state.stackReleaseFlash = Math.max(0, this.state.stackReleaseFlash - delta);
        if (this.state.growthStacks >= HERO_GROWTH_STACK_CAP) return;
        this.state.chargeTimer += delta;
        while (
            this.state.chargeTimer >= HERO_GROWTH_STACK_INTERVAL &&
            this.state.growthStacks < HERO_GROWTH_STACK_CAP
        ) {
            this.state.chargeTimer -= HERO_GROWTH_STACK_INTERVAL;
            this.state.growthStacks += 1;
            this.state.stackGainFlash = HERO_STACK_GAIN_FLASH_DURATION;
        }
    }

    onFighterCollisionDamageResolved(target, actualDamage, context = {}) {
        if (!target) return;
        if (!target.flags.defeated) this._releaseResonance(target);
        this._releaseGrowthCores(context.contactPoint ?? target.position);
    }

    _releaseGrowthCores(contactPoint) {
        const stackCount = this.state.growthStacks;
        if (stackCount <= 0) return;
        this.state.growthStacks = 0;
        this.state.chargeTimer = 0;
        this.state.stackReleaseFlash = HERO_STACK_RELEASE_FLASH_DURATION;
        for (const _ of Array.from({ length: stackCount })) {
            const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
            this._spawnCore(pickHeroOrbEffectType(), contactPoint, direction);
        }
        this.simulation.spawnPulse(new Vector2(contactPoint.x, contactPoint.y), "#ffd85a");
        this.simulation.playSound("orb", 0.9);
    }

    _spawnCore(effectType, contactPoint, direction) {
        this._enforceOwnerCoreLimit();
        const multiplier =
            HERO_CORE_SPEED_MIN_MULTIPLIER +
            Math.random() * (HERO_CORE_SPEED_MAX_MULTIPLIER - HERO_CORE_SPEED_MIN_MULTIPLIER);
        const speed = computeOwnerCombatSpeed(this.owner) * multiplier;
        this.simulation.spawnHeroOrb(
            this.owner,
            new Vector2(contactPoint.x, contactPoint.y),
            direction.clone().scale(speed),
            effectType,
            HERO_CORE_LIFETIME,
            {
                collectionGraceDuration: HERO_COLLECTION_GRACE,
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
        if (!this.getLevelUpgrade().magneticCoreCollection) return null;
        return {
            radius: this.owner.radius * 3.5 + orb.radius,
            responseRate: 5
        };
    }

    onOrbCollected(orb, result) {
        if (!result?.applied || !this.getLevelUpgrade().resonanceFragments) return;
        if (this.state.resonanceFragments.length >= 5) return;
        this.state.resonanceFragments.push({ color: orb.color });
    }

    _releaseResonance(target) {
        if (!this.getLevelUpgrade().resonanceFragments || this.state.resonanceFragments.length === 0) return;
        const fragments = this.state.resonanceFragments.splice(0);
        this.simulation.entities.push(
            new HeroResonanceEffect(this.owner, target, fragments, {
                heroicBurst: Boolean(this.getLevelUpgrade().heroicBurst) && fragments.length === 5
            })
        );
    }

    getOrbStackState() {
        return {
            stacks: this.state.growthStacks,
            stackCap: HERO_GROWTH_STACK_CAP,
            progress: this.state.growthStacks / HERO_GROWTH_STACK_CAP
        };
    }

    draw(ctx) {
        this._drawStackReleaseFlash(ctx);
        this._drawGrowthStacks(ctx);
        this._drawResonanceFragments(ctx);
    }

    _drawStackReleaseFlash(ctx) {
        if (this.state.stackReleaseFlash <= 0) return;
        const progress = 1 - this.state.stackReleaseFlash / HERO_STACK_RELEASE_FLASH_DURATION;
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
        const segmentAngle = (Math.PI * 2) / HERO_GROWTH_STACK_CAP;
        const pulse = this.state.stackGainFlash / HERO_STACK_GAIN_FLASH_DURATION;
        const radius = this.owner.radius + 13 + pulse * 2;
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

    _drawResonanceFragments(ctx) {
        const fragments = this.state.resonanceFragments;
        if (fragments.length === 0) return;
        const time = performance.now() / 1000;
        ctx.save();
        fragments.forEach((fragment, index) => {
            const angle = time * 2.5 + (Math.PI * 2 * index) / fragments.length;
            const radius = this.owner.radius + 26;
            const x = this.owner.position.x + Math.cos(angle) * radius;
            const y = this.owner.position.y + Math.sin(angle) * radius;
            ctx.fillStyle = fragment.color;
            ctx.beginPath();
            for (let side = 0; side < 6; side += 1) {
                const pointAngle = (Math.PI * 2 * side) / 6;
                const px = x + Math.cos(pointAngle) * 5;
                const py = y + Math.sin(pointAngle) * 5;
                if (side === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();
    }

    getUiState() {
        const fragments = this.state.resonanceFragments.length;
        return {
            label:
                fragments > 0
                    ? `Core ${this.state.growthStacks}/5 · Resonance ${fragments}/5`
                    : `Core ${this.state.growthStacks}/5`,
            progress: this.state.growthStacks >= 5 ? 1 : (this.state.growthStacks + this.state.chargeTimer) / 5
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
