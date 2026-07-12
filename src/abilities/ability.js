import { mixins, Cooldown } from "../physics/index.js";
import { getAbilityUpgrade } from "../experience/abilityUpgradeConfig.js";

export class Ability extends mixins([Cooldown]) {
    /** @type {Record<string, typeof Ability>} */
    static MAP = {};

    constructor(owner, simulation, baseCooldown = 0) {
        super();
        this.owner = owner;
        this.simulation = simulation;
        this._baseCooldown = baseCooldown;
        this._cooldownDuration = baseCooldown;
        this._cooldownRemaining = this.cooldown;
    }

    /** Effective cooldown after stat, mastery, and equipment reductions. */
    get cooldown() {
        const skill = this.owner.getSkillPoints?.() ?? this.owner.stats?.allocation?.skill ?? 0;
        const skillMultiplier = 100 / (100 + skill);
        const masteryMultiplier = Math.max(0.1, 1 - (this.owner.mastery?.action?.cooldownPercent ?? 0));
        const equipmentMultiplier = this.owner.equipmentEffects?.abilityCooldownMultiplier ?? 1;
        return this._baseCooldown * skillMultiplier * masteryMultiplier * equipmentMultiplier;
    }

    getLevelRewardModifier(modifierId, fallback = 0) {
        return this.owner.levelRewardModifiers?.[this.owner.abilityId]?.[modifierId] ?? fallback;
    }

    getLevelUpgrade() {
        return getAbilityUpgrade(this.owner.abilityId, this.getLevelRewardModifier("tier"));
    }

    set cooldown(val) {
        this._baseCooldown = val;
    }

    /** @deprecated — use cooldownReady / tickCooldown() instead */
    get timer() {
        return this._cooldownRemaining;
    }
    set timer(v) {
        this._cooldownRemaining = v;
    }

    update() {}
    onCollision() {}
    onDamageTaken() {}
    getRadiusScale() {
        return 1;
    }
    getStatModifiers() {
        return { speed: 1, damage: 1, defense: 1, impact: 1 };
    }
    getUiState() {
        return { label: "Passive", progress: 1 };
    }

    /** Override to draw character-specific effects around/on top of the ball. */
    draw(ctx) {}

    /** Override to draw a custom face. Return true if handled. */
    drawFace(ctx, rotation, ball) {
        return false;
    }

    // ── Face-drawing helpers (for use in subclasses' drawFace) ──────────

    _eye(ctx, ball, ex, ey, size) {
        const { r, blink } = this._faceContext(ball);
        const half = size * r * 1.18;
        const lift = size * r * 0.32 * blink;
        ctx.beginPath();
        ctx.moveTo(ex * r - half, ey * r + lift);
        ctx.quadraticCurveTo(ex * r, ey * r - lift, ex * r + half, ey * r + lift);
        ctx.stroke();
    }

    _dotEye(ctx, ball, ex, ey, size) {
        const { r, blink } = this._faceContext(ball);
        ctx.beginPath();
        ctx.ellipse(ex * r, ey * r, size * r, size * r * blink, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    _sharpEye(ctx, ball, ex, ey, flip, size) {
        const { r } = this._faceContext(ball);
        ctx.beginPath();
        ctx.moveTo((ex - size) * r, (ey - 0.02 * flip) * r);
        ctx.lineTo((ex + size) * r, (ey + 0.04 * flip) * r);
        ctx.stroke();
    }

    _line(ctx, ball, points) {
        const { r } = this._faceContext(ball);
        ctx.beginPath();
        points.forEach(([px, py], index) => {
            if (index === 0) ctx.moveTo(px * r, py * r);
            else ctx.lineTo(px * r, py * r);
        });
        ctx.stroke();
    }

    _arc(ctx, ball, cx, cy, radius, start, end) {
        const { r } = this._faceContext(ball);
        ctx.beginPath();
        ctx.arc(cx * r, cy * r, radius * r, start, end);
        ctx.stroke();
    }

    _faceContext(ball) {
        const time = performance.now() / 1000;
        return {
            r: ball.radius,
            blink: Math.sin(time * 2.6 + ball.position.y * 0.01) > 0.93 ? 0.22 : 1
        };
    }
}
