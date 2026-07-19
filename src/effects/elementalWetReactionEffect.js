import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { ELEMENTAL_PALETTE } from "../abilities/elementalistRecipes.js";
import { drawElectricArc } from "./electricArc.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export const ELEMENTAL_WET_REACTION_VISUAL_CONFIG = Object.freeze({
    duration: 0.45,
    fire: Object.freeze({ steamCount: 9, dropletCount: 7, radiusPadding: 30 }),
    electric: Object.freeze({ arcCount: 7, radiusPadding: 38 }),
    frost: Object.freeze({ shardCount: 10, radiusPadding: 16 }),
    wind: Object.freeze({ streamCount: 8, dropletCount: 10, radiusPadding: 42 }),
    earth: Object.freeze({ rockCount: 8, radiusPadding: 14 })
});

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function drawSteamReaction(ctx, center, radius, progress) {
    const config = ELEMENTAL_WET_REACTION_VISUAL_CONFIG.fire;
    ctx.save();
    Array.from({ length: config.steamCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.steamCount + progress * 0.5;
        const travel = radius + progress * config.radiusPadding * (0.65 + (index % 3) * 0.15);
        ctx.globalAlpha = (1 - progress) * (0.42 + (index % 2) * 0.12);
        ctx.fillStyle = index % 2 === 0 ? "#f4fbff" : "#c9edf2";
        ctx.beginPath();
        ctx.arc(
            center.x + Math.cos(angle) * travel,
            center.y + Math.sin(angle) * travel - progress * 14,
            5 + progress * 7 + (index % 3),
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
    ctx.fillStyle = ELEMENTAL_PALETTE.water;
    Array.from({ length: config.dropletCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.dropletCount - progress * 0.8;
        const travel = radius + 6 + progress * 32;
        ctx.globalAlpha = (1 - progress) * 0.72;
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(angle) * travel, center.y + Math.sin(angle) * travel, 2.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawOvercurrentReaction(ctx, center, radius, progress) {
    const config = ELEMENTAL_WET_REACTION_VISUAL_CONFIG.electric;
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.7;
    Array.from({ length: config.arcCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.arcCount + progress * 1.6;
        const inner = Vector2.add(center, Vector2.fromAngle(angle, radius * 0.55));
        const outer = Vector2.add(center, Vector2.fromAngle(angle + 0.32, radius + config.radiusPadding * progress));
        drawElectricArc(ctx, inner, outer, {
            time: progress * 5 + index,
            color: ELEMENTAL_PALETTE.electric,
            branches: 2
        });
    });
    ctx.restore();
}

function drawFreezeReaction(ctx, center, radius, progress) {
    const config = ELEMENTAL_WET_REACTION_VISUAL_CONFIG.frost;
    const shellRadius = radius + config.radiusPadding * progress;
    ctx.save();
    ctx.strokeStyle = "#edf3ff";
    ctx.fillStyle = "rgba(111, 159, 255, 0.42)";
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.5);
    ctx.globalAlpha = 1 - progress * 0.45;
    Array.from({ length: config.shardCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.shardCount;
        const tip = Vector2.add(center, Vector2.fromAngle(angle, shellRadius + 9));
        const left = Vector2.add(center, Vector2.fromAngle(angle - 0.16, shellRadius - 4));
        const right = Vector2.add(center, Vector2.fromAngle(angle + 0.16, shellRadius - 4));
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}

function drawWaterVortexReaction(ctx, center, radius, progress) {
    const config = ELEMENTAL_WET_REACTION_VISUAL_CONFIG.wind;
    ctx.save();
    ctx.lineCap = "round";
    Array.from({ length: config.streamCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.streamCount + progress * 2.4;
        const innerRadius = radius * (0.7 + progress * 0.35);
        const outerRadius = radius + config.radiusPadding * progress;
        ctx.strokeStyle = index % 2 === 0 ? ELEMENTAL_PALETTE.wind : ELEMENTAL_PALETTE.water;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3.2);
        ctx.globalAlpha = (1 - progress) * 0.78;
        ctx.beginPath();
        ctx.arc(center.x, center.y, innerRadius + (index % 3) * 6, angle, angle + 0.85 + progress * 0.5);
        ctx.stroke();
        const end = Vector2.add(center, Vector2.fromAngle(angle + 0.85, outerRadius));
        ctx.fillStyle = ELEMENTAL_PALETTE.water;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 2.4 + (index % 2), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawMudBindReaction(ctx, center, radius, progress) {
    const config = ELEMENTAL_WET_REACTION_VISUAL_CONFIG.earth;
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.35;
    ctx.strokeStyle = "#5c4432";
    ctx.fillStyle = "#8b6a4a";
    ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius + 5 + progress * config.radiusPadding, 0, Math.PI * 2);
    ctx.stroke();
    Array.from({ length: config.rockCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.rockCount;
        const distance = radius + 7 + (1 - progress) * 12;
        const point = Vector2.add(center, Vector2.fromAngle(angle, distance));
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(angle + progress);
        ctx.fillRect(-4, -3, 8, 6);
        ctx.restore();
    });
    ctx.restore();
}

const REACTION_DRAWERS = Object.freeze({
    fire: drawSteamReaction,
    electric: drawOvercurrentReaction,
    frost: drawFreezeReaction,
    wind: drawWaterVortexReaction,
    earth: drawMudBindReaction
});

export function drawElementalWetChannelBuildUp(ctx, channel, progress) {
    if (!(channel.wetSnapshot ?? channel.channel?.wetSnapshot)) return;
    const center = channel.target.position;
    if (channel.elements.includes("frost")) {
        ctx.save();
        ctx.globalAlpha = 0.25 + progress * 0.55;
        ctx.fillStyle = "rgba(111, 159, 255, 0.24)";
        ctx.beginPath();
        ctx.arc(center.x, center.y, channel.target.radius + progress * 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    if (channel.elements.includes("wind")) {
        ctx.save();
        ctx.fillStyle = ELEMENTAL_PALETTE.water;
        Array.from({ length: 8 }, (_, index) => index).forEach((index) => {
            const angle = progress * Math.PI * 4 + (Math.PI * 2 * index) / 8;
            const distance = channel.target.radius + 12 + (index % 3) * 5;
            ctx.globalAlpha = 0.35 + (index % 2) * 0.18;
            ctx.beginPath();
            ctx.arc(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance, 2.2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}

export class ElementalWetReactionEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({ target, elements, duration = ELEMENTAL_WET_REACTION_VISUAL_CONFIG.duration }) {
        super(target.position.clone(), new Vector2(), target.radius);
        this.target = target;
        this.attachToEntity(target);
        this.elements = [...new Set(elements)].filter((element) => REACTION_DRAWERS[element]);
        this.duration = duration;
        this.life = duration;
        this.maxLife = duration;
    }

    update(delta) {
        this.syncAttachedPosition();
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = clamp01(this.lifeProgress);
        const center = this.target?.position ?? this.position;
        this.elements.forEach((element) => REACTION_DRAWERS[element](ctx, center, this.radius, progress));
    }
}
