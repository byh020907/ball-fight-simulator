import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

const EFFECT_CONFIG = Object.freeze({
    ability_crit: { color: "#ffd65a", life: 0.45, radius: 120, kind: "star" },
    pursuit_flurry: { color: "#dffcff", life: 0.35, radius: 82, kind: "double-slash" },
    mass_execution: { color: "#ff8568", life: 0.5, radius: 150, kind: "impact" },
    vital_heat: { color: "#ff7a45", life: 0.8, radius: 150, kind: "heat" },
    defense_conversion: { color: "#d44b4b", life: 0.25, radius: 58, kind: "conversion" },
    mass_shockwave: { color: "#ffd65a", life: 0.5, radius: 180, kind: "impact" },
    wall_ricochet: { color: "#b9f7ff", life: 0.35, radius: 96, kind: "crescent" },
    wall_heat: { color: "#ff9b55", life: 0.6, radius: 260, kind: "heat" },
    speed_angular: { color: "#9df6ff", life: 0.3, radius: 82, kind: "spiral" },
    ability_echo: { color: "#c6b5ff", life: 0.4, radius: 94, kind: "echo" },
    vortex_charge: { color: "#b7f8ff", life: 0.6, radius: 180, kind: "spiral" },
    vital_overwhelm: { color: "#ff7560", life: 0.35, radius: 96, kind: "impact" }
});

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function getDirection(event) {
    const velocity = event.owner?.velocity?.clone?.() ?? new Vector2(1, 0);
    return velocity.length() > 0.001 ? velocity.normalize() : new Vector2(1, 0);
}

export class EquipmentPassiveEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(event) {
        const config = EFFECT_CONFIG[event.passiveId];
        super(event.anchor.clone(), new Vector2(), 0);
        this.passiveId = event.passiveId;
        this.config = config;
        this.direction = getDirection(event);
        this.life = config.life;
        this.maxLife = config.life;
        this.seed = event.seed ?? 0;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - clamp01(this.life / this.maxLife);
        const alpha = 1 - progress;
        const radius = this.config.radius * (0.16 + progress * 0.84);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.config.color;
        ctx.fillStyle = this.config.color;
        ctx.lineCap = "round";
        if (this.config.kind === "double-slash") this._drawSlashes(ctx, radius, progress);
        else if (this.config.kind === "crescent") this._drawCrescent(ctx, radius, progress);
        else if (this.config.kind === "spiral") this._drawSpiral(ctx, radius, progress);
        else if (this.config.kind === "heat") this._drawHeat(ctx, radius, progress);
        else if (this.config.kind === "echo") this._drawEcho(ctx, radius, progress);
        else if (this.config.kind === "conversion") this._drawConversion(ctx, radius, progress);
        else if (this.config.kind === "star") this._drawStar(ctx, radius, progress);
        else this._drawImpact(ctx, radius, progress);
        ctx.restore();
    }

    _drawImpact(ctx, radius, progress) {
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5 * (1 - progress * 0.45));
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.38;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * 0.54, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawStar(ctx, radius, progress) {
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(progress * 1.8);
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4);
        ctx.beginPath();
        [0, 1, 2, 3].forEach((index) => {
            const angle = (Math.PI * index) / 2;
            ctx.moveTo(Math.cos(angle) * radius * 0.18, Math.sin(angle) * radius * 0.18);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        });
        ctx.stroke();
    }

    _drawSlashes(ctx, radius, progress) {
        const normal = new Vector2(-this.direction.y, this.direction.x);
        [0, 1].forEach((index) => {
            const offset = (index === 0 ? -1 : 1) * radius * 0.22;
            const start = this.position.clone().add(normal.clone().scale(offset - radius * 0.18));
            const end = this.position
                .clone()
                .add(this.direction.clone().scale(radius))
                .add(normal.clone().scale(offset));
            ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 7 - progress * 2);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        });
    }

    _drawCrescent(ctx, radius, progress) {
        const angle = Math.atan2(this.direction.y, this.direction.x);
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 6 - progress * 2);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * 0.7, angle - 0.8, angle + 0.8);
        ctx.stroke();
    }

    _drawSpiral(ctx, radius, progress) {
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3.5);
        [0, Math.PI].forEach((phase) => {
            ctx.beginPath();
            Array.from({ length: 26 }, (_, index) => index).forEach((index) => {
                const ratio = index / 25;
                const angle = phase + progress * Math.PI * 4 + ratio * Math.PI * 2.2;
                const pointRadius = radius * ratio;
                const x = this.position.x + Math.cos(angle) * pointRadius;
                const y = this.position.y + Math.sin(angle) * pointRadius;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    }

    _drawHeat(ctx, radius, progress) {
        [0.45, 0.72, 1].forEach((ratio, index) => {
            ctx.globalAlpha = (1 - progress) * (0.75 - index * 0.16);
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, radius * ratio * (0.55 + progress * 0.45), 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    _drawEcho(ctx, radius, progress) {
        [0, 0.12].forEach((delay) => {
            const local = clamp01((progress - delay) / (1 - delay));
            if (local <= 0) return;
            ctx.globalAlpha = (1 - local) * 0.8;
            ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4);
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, radius * local, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    _drawConversion(ctx, radius, progress) {
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * (0.55 + progress * 0.35), -Math.PI * 0.2, Math.PI * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.position.x - radius * 0.38, this.position.y);
        ctx.lineTo(this.position.x + radius * 0.48, this.position.y);
        ctx.stroke();
    }
}

export function spawnEquipmentPassiveEffect(event) {
    const config = EFFECT_CONFIG[event?.passiveId];
    if (!config || !event?.simulation?.entities || !event?.anchor) return null;
    const effect = new EquipmentPassiveEffect(event);
    event.simulation.entities.push(effect);
    return effect;
}

export const EQUIPMENT_PASSIVE_EFFECT_CONFIG = EFFECT_CONFIG;
