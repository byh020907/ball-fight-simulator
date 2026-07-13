import { DashEffect } from "../combatEffects.js";
import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";

export const HERO_ORB_STAT_CAP = -1;
export const HERO_ORB_MAX_ACTIVE_PER_OWNER = 10;
const HERO_ORB_BASE_COOLDOWN = 1.0;
const HERO_ORB_SPEED_MIN_MULTIPLIER = 1.2;
const HERO_ORB_SPEED_MAX_MULTIPLIER = 1.5;
const STAT_EFFECT_TYPES = ["hp", "damage", "speed", "defense", "skill"];
const SPECIAL_EFFECT_TYPES = ["dash", "arrow", "cooldown_burst"];
const HERO_ORB_SPECIAL_CHANCES = {
    dash: 0.1,
    arrow: 0.1,
    cooldown_burst: 0.05
};
const COOLDOWN_BURST_DURATION = 1.0;
const COOLDOWN_BURST_MULTIPLIER = 0.1;
const HERO_STACK_GAIN_FLASH_DURATION = 0.16;
const HERO_STACK_RELEASE_FLASH_DURATION = 0.28;
const HERO_STACK_RING_OFFSET = 14;
const HERO_STACK_RING_WIDTH = 4;

/**
 * 확률 기반 Hero Orb effect type 선택.
 * @param {function} rng - 0~1 난수 생성기 (기본 Math.random)
 * @returns {string} effect type key
 */
export function pickHeroOrbEffectType(rng = Math.random) {
    const roll = rng();
    let cumulative = 0;
    for (const [type, chance] of Object.entries(HERO_ORB_SPECIAL_CHANCES)) {
        cumulative += chance;
        if (roll < cumulative) return type;
    }
    // 특수 orb 미선택 → 기본 스탯 orb
    return STAT_EFFECT_TYPES[Math.floor(rng() * STAT_EFFECT_TYPES.length)];
}

/** owner의 현재 전투 속도를 계산 */
export function computeOwnerCombatSpeed(owner) {
    const modifiers = owner.getStatModifiers?.() ?? { speed: 1 };
    const baseMult = modifiers.speed;
    const slowMult = owner.state.slow ? owner.state.slow.amount : 1;
    const boostMult = owner.state.speedBoost ? owner.state.speedBoost.multiplier : 1;
    const movementSpeed = owner.state.movement?.getSpeed?.(owner);
    return movementSpeed ?? owner.stats.baseSpeed * baseMult * slowMult * boostMult;
}

export class HeroAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, HERO_ORB_BASE_COOLDOWN);
        this.state = {
            cooldownBurstTimer: 0,
            cooldownBurstMultiplier: 1,
            orbStacks: 0,
            stackGainFlash: 0,
            stackReleaseFlash: 0
        };
    }

    /** cooldown burst 상태에서 effective cooldown getter 오버라이드 */
    get cooldown() {
        const base = super.cooldown;
        if (!this.state) return base;
        return base * this.state.cooldownBurstMultiplier;
    }

    /** cooldown burst 발동 */
    applyCooldownBurst(duration = COOLDOWN_BURST_DURATION, multiplier = COOLDOWN_BURST_MULTIPLIER) {
        this.state.cooldownBurstTimer = Math.max(this.state.cooldownBurstTimer, duration);
        this.state.cooldownBurstMultiplier = multiplier;
    }

    _tickCooldownBurst(delta) {
        if (this.state.cooldownBurstTimer <= 0) return;
        this.state.cooldownBurstTimer -= delta;
        if (this.state.cooldownBurstTimer <= 0) {
            this.state.cooldownBurstTimer = 0;
            this.state.cooldownBurstMultiplier = 1;
        }
    }

    _tickStackVisuals(delta) {
        this.state.stackGainFlash = Math.max(0, this.state.stackGainFlash - delta);
        this.state.stackReleaseFlash = Math.max(0, this.state.stackReleaseFlash - delta);
    }

    /** Hero Orb 발사 속도 계산 — owner의 실제 전투 속도 기준 */
    _computeOrbSpeed() {
        const effectiveSpeed = computeOwnerCombatSpeed(this.owner);
        const multiplier =
            HERO_ORB_SPEED_MIN_MULTIPLIER +
            Math.random() * (HERO_ORB_SPEED_MAX_MULTIPLIER - HERO_ORB_SPEED_MIN_MULTIPLIER);
        return effectiveSpeed * multiplier;
    }

    _getActiveOwnerOrbs() {
        if (!this.simulation?.entities) return [];
        return this.simulation.entities.filter(
            (entity) => entity.constructor?.name === "HeroOrb" && entity.owner === this.owner && !entity.isExpired
        );
    }

    _enforceOwnerOrbLimit() {
        const ownerOrbs = this._getActiveOwnerOrbs();
        while (ownerOrbs.length >= HERO_ORB_MAX_ACTIVE_PER_OWNER) {
            const oldest = ownerOrbs.shift();
            oldest.isExpired = true;
        }
    }

    _spawnOrb(effectType, direction) {
        const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + 20));
        this._enforceOwnerOrbLimit();
        this.simulation.spawnHeroOrb(
            this.owner,
            start,
            direction.scale(this._computeOrbSpeed()),
            effectType,
            undefined,
            { collectionGraceDuration: this.getLevelUpgrade().collectionGraceDuration ?? 0 }
        );
    }

    getOrbAttraction(orb) {
        const upgrade = this.getLevelUpgrade();
        const radiusMultiplier = upgrade.magnetRadiusMultiplier ?? 1;
        if (radiusMultiplier <= 1) return null;
        return {
            radius: this.owner.radius * radiusMultiplier + orb.radius,
            responseRate: upgrade.magnetResponseRate
        };
    }

    onOrbCollected() {
        const stackCap = this.getLevelUpgrade().stackCap;
        if (!stackCap) return;
        const nextStacks = Math.min(stackCap, this.state.orbStacks + 1);
        if (nextStacks > this.state.orbStacks) {
            this.state.stackGainFlash = HERO_STACK_GAIN_FLASH_DURATION;
        }
        this.state.orbStacks = nextStacks;
    }

    getOrbStackState() {
        const rawStackCap = this.getLevelUpgrade().stackCap;
        const stackCap = Number.isFinite(rawStackCap) ? Math.max(0, Math.floor(rawStackCap)) : 0;
        const stacks = Math.min(stackCap, Math.max(0, this.state.orbStacks));
        return { stacks, stackCap, progress: stackCap > 0 ? stacks / stackCap : 0 };
    }

    modifyOutgoingFighterCollisionDamage(amount) {
        const stacks = this.state.orbStacks;
        const damagePerStack = this.getLevelUpgrade().damagePerStack;
        return stacks > 0 && damagePerStack ? amount * (1 + stacks * damagePerStack) : amount;
    }

    onFighterCollisionDamageResolved(target, actualDamage) {
        if (actualDamage <= 0 || this.state.orbStacks <= 0) return;

        const consumedStacks = this.state.orbStacks;
        this.state.orbStacks = 0;
        this.state.stackReleaseFlash = HERO_STACK_RELEASE_FLASH_DURATION;
        const releaseStackRatio = this.getLevelUpgrade().releaseStackRatio;
        if (!releaseStackRatio) return;

        const releaseCount = Math.round(consumedStacks * releaseStackRatio);
        for (const _ of Array.from({ length: releaseCount })) {
            const effectType = pickHeroOrbEffectType(Math.random);
            const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
            this._spawnOrb(effectType, direction);
        }
        this.simulation.spawnPulse(this.owner.position.clone(), this.owner.color);
        this.simulation.addLog(
            `${this.owner.name} releases ${releaseCount} stacked orbs after colliding with ${target.name}.`
        );
    }

    update(delta, target) {
        this._tickCooldownBurst(delta);
        this._tickStackVisuals(delta);
        this.timer -= delta;
        if (this.timer > 0) return;
        this.timer = this.cooldown;

        const effectType = pickHeroOrbEffectType(Math.random);
        const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        this._spawnOrb(effectType, direction);
        this.simulation.playSound("orb", 0.8);
        this.simulation.addLog(`${this.owner.name} launches a ${effectType} orb.`);
    }

    draw(ctx) {
        this._drawStackReleaseFlash(ctx);
        this._drawOrbStackBand(ctx);
    }

    _drawStackReleaseFlash(ctx) {
        if (this.state.stackReleaseFlash <= 0) return;
        const progress = 1 - this.state.stackReleaseFlash / HERO_STACK_RELEASE_FLASH_DURATION;
        const radius = this.owner.radius + HERO_STACK_RING_OFFSET + progress * 22;
        ctx.save();
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = "#fff0a8";
        ctx.lineWidth = 6 - progress * 3;
        ctx.beginPath();
        ctx.arc(this.owner.position.x, this.owner.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawOrbStackBand(ctx) {
        const { stacks, stackCap } = this.getOrbStackState();
        if (stacks <= 0 || stackCap <= 0) return;

        const segmentAngle = (Math.PI * 2) / stackCap;
        const segmentGap = Math.min(segmentAngle * 0.25, 0.08);
        const gainPulse = this.state.stackGainFlash / HERO_STACK_GAIN_FLASH_DURATION;
        const radius = this.owner.radius + HERO_STACK_RING_OFFSET + gainPulse * 2;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineWidth = HERO_STACK_RING_WIDTH + gainPulse * 2;
        Array.from({ length: stacks }).forEach((_, index) => {
            const startAngle = -Math.PI / 2 + index * segmentAngle + segmentGap / 2;
            const endAngle = startAngle + segmentAngle - segmentGap;
            ctx.globalAlpha = index === stacks - 1 ? 0.8 + gainPulse * 0.2 : 0.82;
            ctx.strokeStyle = index === stacks - 1 && gainPulse > 0 ? "#fff4b8" : "#ffd84a";
            ctx.beginPath();
            ctx.arc(this.owner.position.x, this.owner.position.y, radius, startAngle, endAngle);
            ctx.stroke();
        });
        ctx.globalAlpha = 0.94;
        ctx.fillStyle = "#6d5200";
        ctx.font = "800 12px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`x${stacks}`, this.owner.position.x, this.owner.position.y - radius - 8);
        ctx.restore();
    }

    getUiState() {
        const progress = Math.max(0, Math.min(1, 1 - this.timer / this.cooldown));
        const label =
            this.state.orbStacks > 0
                ? `Stacks ${this.state.orbStacks}`
                : this.state.cooldownBurstTimer > 0
                  ? "Burst"
                  : "Orbs";
        return { label, progress };
    }

    drawFace(ctx, rotation, ball) {
        // Hero Ball face: star-shaped eyes + confident smile
        const { r } = this._faceContext(ball);
        const time = performance.now() / 1000;

        // Left eye
        ctx.save();
        ctx.translate(-0.2 * r, -0.08 * r);
        ctx.rotate(Math.sin(time * 3) * 0.05);
        this._sharpEye(ctx, ball, 0, 0, 1, 0.06);
        ctx.restore();

        // Right eye
        ctx.save();
        ctx.translate(0.2 * r, -0.08 * r);
        ctx.rotate(Math.sin(time * 3 + 1) * 0.05);
        this._sharpEye(ctx, ball, 0, 0, 1, 0.06);
        ctx.restore();

        // Confident smile
        ctx.beginPath();
        ctx.arc(0, 0.12 * r, 0.1 * r, 0.15, Math.PI - 0.15);
        ctx.stroke();
        return true;
    }
}
