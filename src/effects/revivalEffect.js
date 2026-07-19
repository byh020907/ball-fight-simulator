import { CombatEntity, Vector2 } from "../core.js";

export const REVIVAL_EFFECT_CONFIG = Object.freeze({
    duration: 0.85,
    pauseDuration: 0.8,
    gatherEnd: 0.56,
    moteCount: 14
});

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export class RevivalEffect extends CombatEntity {
    constructor(position, color, radius) {
        super(position, new Vector2(), radius);
        this.color = color;
        this.life = REVIVAL_EFFECT_CONFIG.duration;
        this.maxLife = this.life;
        this.updatesDuringRevivePause = true;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - clamp01(this.life / this.maxLife);
        const gather = clamp01(progress / REVIVAL_EFFECT_CONFIG.gatherEnd);
        const release = clamp01((progress - REVIVAL_EFFECT_CONFIG.gatherEnd) / (1 - REVIVAL_EFFECT_CONFIG.gatherEnd));
        const envelope = Math.sin(progress * Math.PI);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        this._drawLightColumn(ctx, envelope, release);
        this._drawConvergingMotes(ctx, gather, release, envelope);
        this._drawRings(ctx, gather, release, envelope);
        this._drawCoreFlash(ctx, release);
        ctx.restore();
    }

    _drawLightColumn(ctx, envelope, release) {
        const halfWidth = this.radius * (0.7 + release * 0.45);
        const halfHeight = this.radius * 3.5;
        const gradient = ctx.createLinearGradient(
            this.position.x,
            this.position.y - halfHeight,
            this.position.x,
            this.position.y + halfHeight
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        gradient.addColorStop(0.42, this.color);
        gradient.addColorStop(0.5, "#ffffff");
        gradient.addColorStop(0.58, this.color);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalAlpha = envelope * 0.34;
        ctx.fillStyle = gradient;
        ctx.fillRect(this.position.x - halfWidth, this.position.y - halfHeight, halfWidth * 2, halfHeight * 2);
    }

    _drawConvergingMotes(ctx, gather, release, envelope) {
        ctx.fillStyle = "#ffffff";
        for (let index = 0; index < REVIVAL_EFFECT_CONFIG.moteCount; index += 1) {
            const phase = index / REVIVAL_EFFECT_CONFIG.moteCount;
            const angle = phase * Math.PI * 2 + gather * (0.8 + (index % 3) * 0.17);
            const gatheredDistance = this.radius * (2.9 - gather * 2.3);
            const distance =
                release > 0 ? this.radius * (0.55 + release * (1.8 + (index % 4) * 0.18)) : gatheredDistance;
            const verticalLift = Math.sin(phase * Math.PI * 4) * this.radius * 0.32 * (1 - release);
            const x = this.position.x + Math.cos(angle) * distance;
            const y = this.position.y + Math.sin(angle) * distance + verticalLift;
            ctx.globalAlpha = envelope * (0.62 + (index % 3) * 0.12);
            ctx.beginPath();
            ctx.arc(x, y, 2.2 + (index % 2) * 1.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawRings(ctx, gather, release, envelope) {
        ctx.fillStyle = "transparent";
        ctx.lineWidth = Math.max(3, this.radius * 0.1);
        for (let index = 0; index < 2; index += 1) {
            const gatherRadius = this.radius * (2.65 - gather * (1.55 + index * 0.22));
            const releaseRadius = this.radius * (0.8 + release * (2.1 + index * 0.55));
            ctx.globalAlpha = envelope * (index === 0 ? 0.9 : 0.55);
            ctx.strokeStyle = index === 0 ? "#ffffff" : this.color;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, release > 0 ? releaseRadius : gatherRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    _drawCoreFlash(ctx, release) {
        if (release <= 0) return;
        ctx.globalAlpha = (1 - release) * 0.82;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * (0.7 + release * 0.8), 0, Math.PI * 2);
        ctx.fill();
    }
}
