import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";

export const ENERGY_SHIELD_VISUAL_CONFIG = Object.freeze({
    shellPadding: 7,
    shellWidth: 2.5,
    shellBaseColor: "#2879d8",
    shellColor: "#65e7ff",
    shellHighlightColor: "#d9fbff",
    hitDuration: 0.3,
    hitArcWidth: Math.PI * 0.72,
    hitCellCount: 7,
    hitRippleDistance: 12
});

function drawHexagon(ctx, x, y, radius, rotation = 0) {
    ctx.beginPath();
    for (const index of Array.from({ length: 6 }, (_, value) => value)) {
        const angle = rotation + (Math.PI * 2 * index) / 6;
        const pointX = x + Math.cos(angle) * radius;
        const pointY = y + Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();
}

export function drawEnergyShieldField(ctx, owner, shieldRatio) {
    const ratio = Math.min(1, Math.max(0, shieldRatio));
    if (ratio <= 0) return;

    const config = ENERGY_SHIELD_VISUAL_CONFIG;
    const radius = owner.radius + config.shellPadding;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.05 + ratio * 0.04;
    ctx.fillStyle = config.shellBaseColor;
    ctx.beginPath();
    ctx.arc(owner.position.x, owner.position.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.28 + ratio * 0.14;
    ctx.strokeStyle = config.shellBaseColor;
    ctx.lineWidth = config.shellWidth + 2.5;
    ctx.beginPath();
    ctx.arc(owner.position.x, owner.position.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.3 + ratio * 0.18;
    ctx.strokeStyle = config.shellColor;
    ctx.lineWidth = config.shellWidth;
    ctx.beginPath();
    ctx.arc(owner.position.x, owner.position.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.34 + ratio * 0.16;
    ctx.strokeStyle = config.shellHighlightColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(owner.position.x, owner.position.y, radius + 3, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.stroke();
    ctx.restore();
}

export class EnergyShieldHitEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(target, impactDirection, absorbedDamage = 0) {
        super(target.position.clone(), new Vector2(), 0);
        this.target = target;
        this.attachToEntity(target);
        this.direction = impactDirection.clone();
        if (this.direction.length() <= 0.001) this.direction.x = 1;
        this.direction.normalize();
        this.strength = Math.min(1, 0.55 + (Math.max(0, absorbedDamage) / Math.max(1, target.maxHp)) * 2);
        this.duration = ENERGY_SHIELD_VISUAL_CONFIG.hitDuration;
        this.life = this.duration;
    }

    update(delta) {
        this.syncAttachedPosition();
        this.tickLife(delta);
    }

    draw(ctx) {
        const config = ENERGY_SHIELD_VISUAL_CONFIG;
        const progress = Math.min(1, Math.max(0, 1 - this.life / this.duration));
        const alpha = 1 - progress;
        const targetRadius = this.target?.radius ?? 20;
        const shellRadius = targetRadius + config.shellPadding + progress * config.hitRippleDistance;
        const impactAngle = Math.atan2(this.direction.y, this.direction.x);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.42 * this.strength;
        ctx.strokeStyle = config.shellColor;
        ctx.lineWidth = (5 - progress * 2) * this.strength;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, shellRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = config.shellHighlightColor;
        ctx.lineWidth = 7 - progress * 3;
        ctx.beginPath();
        ctx.arc(
            this.position.x,
            this.position.y,
            shellRadius,
            impactAngle - config.hitArcWidth / 2,
            impactAngle + config.hitArcWidth / 2
        );
        ctx.stroke();

        const cellRadius = Math.max(3, targetRadius * 0.16) * (1 - progress * 0.25);
        for (const index of Array.from({ length: config.hitCellCount }, (_, value) => value)) {
            const offset = (index - (config.hitCellCount - 1) / 2) * (config.hitArcWidth / config.hitCellCount);
            const angle = impactAngle + offset;
            const cellDistance = shellRadius + ((index % 2) - 0.5) * cellRadius * 1.4;
            const x = this.position.x + Math.cos(angle) * cellDistance;
            const y = this.position.y + Math.sin(angle) * cellDistance;
            ctx.globalAlpha = alpha * (0.42 + (index % 2) * 0.22);
            ctx.strokeStyle = index % 2 === 0 ? config.shellColor : config.shellHighlightColor;
            ctx.lineWidth = 1.5;
            drawHexagon(ctx, x, y, cellRadius, angle);
            ctx.stroke();
        }
        ctx.restore();
    }
}
