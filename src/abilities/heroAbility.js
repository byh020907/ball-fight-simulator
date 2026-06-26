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
    const slowMult = owner.slowEffect ? owner.slowEffect.amount : 1;
    const boostMult = owner.speedBoost ? owner.speedBoost.multiplier : 1;
    const movementSpeed = owner.movementEffect?.getSpeed?.(owner);
    return movementSpeed ?? owner.baseSpeed * baseMult * slowMult * boostMult;
}

export class HeroAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, HERO_ORB_BASE_COOLDOWN);
        this._cooldownBurstTimer = 0;
        this._cooldownBurstMultiplier = 1;
    }

    /** cooldown burst 상태에서 effective cooldown getter 오버라이드 */
    get cooldown() {
        const base = super.cooldown;
        return base * this._cooldownBurstMultiplier;
    }

    /** cooldown burst 발동 */
    applyCooldownBurst(duration = COOLDOWN_BURST_DURATION, multiplier = COOLDOWN_BURST_MULTIPLIER) {
        this._cooldownBurstTimer = Math.max(this._cooldownBurstTimer, duration);
        this._cooldownBurstMultiplier = multiplier;
    }

    _tickCooldownBurst(delta) {
        if (this._cooldownBurstTimer <= 0) return;
        this._cooldownBurstTimer -= delta;
        if (this._cooldownBurstTimer <= 0) {
            this._cooldownBurstTimer = 0;
            this._cooldownBurstMultiplier = 1;
        }
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

    update(delta, target) {
        this._tickCooldownBurst(delta);
        this.timer -= delta;
        if (this.timer > 0) return;
        this.timer = this.cooldown;

        const effectType = pickHeroOrbEffectType(Math.random);
        const angle = Math.random() * Math.PI * 2;
        const direction = Vector2.fromAngle(angle, 1);
        const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + 20));

        this._enforceOwnerOrbLimit();

        const orbSpeed = this._computeOrbSpeed();
        this.simulation.spawnHeroOrb(this.owner, start, direction.scale(orbSpeed), effectType);
        this.simulation.playSound("orb", 0.8);
        this.simulation.addLog(`${this.owner.name} launches a ${effectType} orb.`);
    }

    getUiState() {
        const progress = Math.max(0, Math.min(1, 1 - this.timer / this.cooldown));
        const label = this._cooldownBurstTimer > 0 ? "Burst" : "Orbs";
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
