import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

const EFFECT_CONFIG = Object.freeze({
    ability_crit: { color: "#ffd65a", life: 0.45, radius: 120, kind: "star" },
    pursuit_flurry: { color: "#8ce8e5", life: 0.35, radius: 82, kind: "double-slash" },
    mass_execution: { color: "#a52a2a", life: 0.5, radius: 150, kind: "execution" },
    vital_heat: { color: "#ff6a32", life: 0.22, radius: 150, kind: "vital-heat" },
    defense_conversion: { color: "#d44b4b", life: 0.25, radius: 58, kind: "fangs" },
    mass_shockwave: { color: "#c69b5a", life: 0.5, radius: 180, kind: "shockwave" },
    wall_ricochet: { color: "#b9f7ff", life: 0.35, radius: 96, kind: "crescent" },
    wall_heat: { color: "#ff8747", life: 0.6, radius: 260, kind: "wall-heat" },
    speed_angular: { color: "#9df6ff", life: 0.3, radius: 82, kind: "spiral" },
    ability_echo: { color: "#c6b5ff", life: 0.4, radius: 94, kind: "echo" },
    vortex_charge: { color: "#b7f8ff", life: 0.6, radius: 180, kind: "vortex" },
    vital_overwhelm: { color: "#ff7560", life: 0.35, radius: 96, kind: "dragon" }
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
        this.intensity = clamp01(event.intensity ?? 1);
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
        else if (this.config.kind === "vital-heat") this._drawVitalHeat(ctx, radius, progress);
        else if (this.config.kind === "wall-heat") this._drawWallHeat(ctx, radius, progress);
        else if (this.config.kind === "echo") this._drawEcho(ctx, radius, progress);
        else if (this.config.kind === "fangs") this._drawFangs(ctx, radius, progress);
        else if (this.config.kind === "star") this._drawStar(ctx, radius, progress);
        else if (this.config.kind === "execution") this._drawExecution(ctx, radius, progress);
        else if (this.config.kind === "shockwave") this._drawShockwave(ctx, radius, progress);
        else if (this.config.kind === "dragon") this._drawDragon(ctx, radius, progress);
        else if (this.config.kind === "vortex") this._drawVortex(ctx, radius, progress);
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
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha *= Math.max(0, 1 - progress * 2.2);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawExecution(ctx, radius, progress) {
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 7 - progress * 3);
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y - radius * 0.9);
        ctx.lineTo(this.position.x, this.position.y + radius * 0.2);
        ctx.stroke();
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y + radius * 0.22, radius * (0.45 + progress * 0.35), Math.PI, 0);
        ctx.stroke();
    }

    _drawShockwave(ctx, radius, progress) {
        this._drawImpact(ctx, radius, progress);
        ctx.globalAlpha *= 0.4;
        [0, 1, 2, 3, 4, 5].forEach((index) => {
            const angle = index * (Math.PI / 3) + progress;
            ctx.beginPath();
            ctx.arc(
                this.position.x + Math.cos(angle) * radius * 0.7,
                this.position.y + Math.sin(angle) * radius * 0.35,
                4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
    }

    _drawDragon(ctx, radius, progress) {
        radius *= 0.65 + this.intensity * 0.35;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        [-1, 1].forEach((side) => {
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y + radius * 0.2);
            ctx.lineTo(this.position.x + side * radius * 0.55, this.position.y - radius * 0.55);
            ctx.lineTo(this.position.x + side * radius * 0.2, this.position.y + radius * 0.1);
            ctx.stroke();
        });
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * (0.35 + progress * 0.5), 0, Math.PI * 2);
        ctx.stroke();
    }

    _drawSlashes(ctx, radius, progress) {
        const normal = new Vector2(-this.direction.y, this.direction.x);
        [0, 1].forEach((index) => {
            const localProgress = clamp01((progress - index * 0.23) / (1 - index * 0.23));
            if (localProgress <= 0) return;
            const offset = (index === 0 ? -1 : 1) * radius * 0.22;
            const start = this.position.clone().add(normal.clone().scale(offset - radius * 0.18));
            const end = this.position
                .clone()
                .add(this.direction.clone().scale(radius))
                .add(normal.clone().scale(offset));
            ctx.globalAlpha = (1 - localProgress) * 0.9;
            ctx.strokeStyle = index === 0 ? "#8ce8e5" : "#ffffff";
            ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 7 - localProgress * 2);
            ctx.beginPath();
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            ctx.arc(this.position.x, this.position.y, radius * 0.72, angle - 0.75, angle + 0.75);
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
        this._drawSpiralPaths(ctx, radius, progress, [0], 18, 1.6, 2.5);
    }

    _drawSpiralPaths(ctx, radius, progress, phases, pointCount, turns, width) {
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", width);
        phases.forEach((phase) => {
            ctx.beginPath();
            Array.from({ length: pointCount }, (_, index) => index).forEach((index) => {
                const ratio = index / (pointCount - 1);
                const angle = phase + progress * Math.PI * 4 + ratio * Math.PI * turns;
                const pointRadius = radius * ratio;
                const x = this.position.x + Math.cos(angle) * pointRadius;
                const y = this.position.y + Math.sin(angle) * pointRadius;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    }

    _drawVortex(ctx, radius, progress) {
        this._drawSpiralPaths(ctx, radius, progress, [0, Math.PI], 30, 2.4, 4);
        ctx.fillStyle = "#ffffff";
        [0, 1, 2, 3, 4, 5, 6, 7].forEach((index) => {
            const angle = index * (Math.PI / 4) + progress * 4;
            const distance = radius * (0.55 + (index % 3) * 0.12);
            ctx.globalAlpha = (1 - progress) * 0.7;
            ctx.beginPath();
            ctx.arc(
                this.position.x + Math.cos(angle) * distance,
                this.position.y + Math.sin(angle) * distance,
                2.5 + (index % 2),
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
    }

    _drawVitalHeat(ctx, radius, progress) {
        ctx.globalAlpha = (1 - progress) * 0.82;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 4);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * (0.42 + progress * 0.45), Math.PI, Math.PI * 2);
        ctx.stroke();
        [0, 1, 2, 3, 4, 5].forEach((index) => {
            const angle = index * (Math.PI / 3) + this.seed * 0.45;
            ctx.beginPath();
            ctx.arc(
                this.position.x + Math.cos(angle) * radius * (0.35 + progress * 0.35),
                this.position.y + Math.sin(angle) * radius * 0.25,
                2 + (index % 2),
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
    }

    _drawWallHeat(ctx, radius, progress) {
        ctx.globalAlpha = (1 - progress) * 0.82;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 6 - progress * 2);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * (0.35 + progress * 0.65), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#ffd27a";
        ctx.globalAlpha *= 0.45;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * (0.28 + progress * 0.5), 0, Math.PI * 2);
        ctx.stroke();
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

    _drawFangs(ctx, radius, progress) {
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(Math.atan2(this.direction.y, this.direction.x));
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        [-1, 1].forEach((side) => {
            ctx.beginPath();
            ctx.moveTo(-radius * 0.1, side * radius * 0.12);
            ctx.lineTo(radius * 0.55, side * radius * 0.42);
            ctx.lineTo(radius * 0.34, side * radius * 0.02);
            ctx.closePath();
            ctx.stroke();
        });
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
