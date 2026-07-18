import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { createWaveringPath } from "./waveringPath.js";
import { drawElectricArc } from "./electricArc.js";
import { getVisibleLineWidth } from "./effectVisibility.js";
import { ELEMENTAL_PALETTE } from "../abilities/elementalistRecipes.js";

const SHAPE_COUNT = 8;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function drawConfiguredShape(ctx, shape, size) {
    ctx.beginPath();
    switch (shape) {
        case "drill":
        case "blade":
            ctx.moveTo(size * 1.8, 0);
            ctx.lineTo(-size, size * 0.55);
            ctx.lineTo(-size, -size * 0.55);
            ctx.closePath();
            break;
        case "crack":
            ctx.moveTo(-size, -size);
            ctx.lineTo(size * 0.15, -size * 0.2);
            ctx.lineTo(-size * 0.1, size * 0.25);
            ctx.lineTo(size, size);
            break;
        case "ember":
        case "spark":
            ctx.arc(0, 0, shape === "spark" ? size * 0.55 : size, 0, Math.PI * 2);
            break;
        case "shard":
        case "crystal":
            ctx.moveTo(0, -size * 1.4);
            ctx.lineTo(size, 0);
            ctx.lineTo(0, size * 1.4);
            ctx.lineTo(-size, 0);
            ctx.closePath();
            break;
        case "rock":
            ctx.moveTo(-size, -size * 0.45);
            ctx.lineTo(-size * 0.2, -size);
            ctx.lineTo(size, -size * 0.35);
            ctx.lineTo(size * 0.65, size);
            ctx.lineTo(-size * 0.75, size * 0.65);
            ctx.closePath();
            break;
        case "boulder":
            ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
            break;
        default:
            ctx.rect(-size, -size * 0.45, size * 2, size * 0.9);
            break;
    }
    if (shape === "crack") ctx.stroke();
    else ctx.fill();
}

function getMotionPoint(channel, index, progress) {
    const target = channel.target;
    const motion = channel.recipe?.motion;
    const baseAngle = (Math.PI * 2 * index) / SHAPE_COUNT;
    const spinningAngle = baseAngle + progress * Math.PI * 2;
    const baseRadius = target.radius + 34;
    let angle = spinningAngle;
    let distance = baseRadius;

    if (motion === "alternate") distance *= index % 2 === 0 ? 1 - progress * 0.55 : 0.55 + progress * 0.45;
    if (motion === "spiral") distance *= 1 - progress * 0.72;
    if (motion === "volley") {
        angle = -Math.PI * 0.7 + (Math.PI * 1.4 * index) / (SHAPE_COUNT - 1);
        distance *= 1.2 - progress * 0.65;
    }
    if (motion === "converge") distance *= 1 - progress * 0.82;
    if (motion === "rail") {
        const source = channel.source?.position ?? target.position;
        const along = (index + progress) / SHAPE_COUNT;
        return {
            x: source.x + (target.position.x - source.x) * along,
            y: source.y + (target.position.y - source.y) * along,
            angle: Math.atan2(target.position.y - source.y, target.position.x - source.x)
        };
    }
    if (motion === "pinch") {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2) - 1.5;
        return {
            x: target.position.x + side * baseRadius * (1 - progress * 0.82),
            y: target.position.y + row * 8,
            angle: side < 0 ? 0 : Math.PI
        };
    }
    if (motion === "flow") {
        angle = baseAngle * 0.35 + progress * Math.PI * 1.5;
        distance = baseRadius * (0.65 + 0.25 * Math.sin(index + progress * Math.PI * 2));
    }

    return {
        x: target.position.x + Math.cos(angle) * distance,
        y: target.position.y + Math.sin(angle) * distance,
        angle
    };
}

export function drawElementalOrb(ctx, orb, time = 0) {
    const elements = orb.elements ?? [orb.element];
    const colors = elements.map((element) => ELEMENTAL_PALETTE[element] ?? "#ffffff");
    const pulse = 1 + Math.sin(time * 8 + orb.createdAt * 3) * 0.08;
    ctx.save();
    ctx.translate(orb.position.x, orb.position.y);
    ctx.rotate(time * 1.8);
    colors.forEach((color, index) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.beginPath();
        ctx.arc(
            0,
            0,
            orb.radius * pulse,
            (index * Math.PI * 2) / colors.length,
            ((index + 1) * Math.PI * 2) / colors.length
        );
        ctx.stroke();
    });
    ctx.fillStyle = colors.length > 1 ? "#f7f4ff" : colors[0];
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.arc(0, 0, orb.radius * 0.62 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

export function drawTargetChannelTimeline(ctx, channel, progress) {
    const target = channel.target;
    if (!target || target.flags?.defeated) return;
    const colors = channel.colors;
    ctx.save();
    ctx.lineCap = "round";
    colors.forEach((color, index) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.beginPath();
        ctx.arc(
            target.position.x,
            target.position.y,
            target.radius + 8 + index * 4,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * progress
        );
        ctx.stroke();
    });
    ctx.restore();
}

export function drawMultiShapeMotion(ctx, channel, progress) {
    if (!channel.target) return;
    const shape = channel.recipe?.shape ?? "spark";
    ctx.save();
    Array.from({ length: SHAPE_COUNT }, (_, index) => index).forEach((index) => {
        const point = getMotionPoint(channel, index, progress);
        const side = index % channel.colors.length;
        ctx.save();
        ctx.fillStyle = channel.colors[side];
        ctx.strokeStyle = channel.colors[side];
        ctx.lineWidth = getVisibleLineWidth(ctx, "detail", 2);
        ctx.translate(point.x, point.y);
        ctx.rotate(point.angle + progress * 2);
        const size = 3 + (index % 3);
        drawConfiguredShape(ctx, shape, size);
        ctx.restore();
    });
    ctx.restore();
}

export function drawPathFlow(ctx, channel, progress) {
    const target = channel.target;
    if (!target) return;
    const origin = channel.source?.position ?? target.position;
    const path = channel.recipe?.path ?? "focus";
    const perpendicular = new Vector2(-(target.position.y - origin.y), target.position.x - origin.x).normalize();
    const points = createWaveringPath(origin, target.position, {
        time: progress * 3,
        maxSegments: 12,
        offsetAt: ({ index, time }) => {
            const amplitude = path === "wave" ? 6 : path === "fracture" ? 4 : path === "tangent" ? 3 : 0.8;
            return Math.sin(index * (path === "fracture" ? 2.8 : 1.7) + time) * amplitude;
        }
    });
    ctx.save();
    ctx.strokeStyle = channel.colors[0];
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    if (path === "arc" || path === "lob") {
        const bend = path === "lob" ? 70 : 34;
        const middle = Vector2.add(origin, target.position).scale(0.5).add(perpendicular.scale(bend));
        ctx.moveTo(origin.x, origin.y);
        ctx.quadraticCurveTo(middle.x, middle.y, target.position.x, target.position.y);
    } else if (path === "spiral") {
        ctx.arc(
            target.position.x,
            target.position.y,
            target.radius + 12 + progress * 14,
            progress * Math.PI * 2,
            progress * Math.PI * 2 + Math.PI * 1.65
        );
    } else if (path === "line" || path === "focus") {
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(target.position.x, target.position.y);
    } else {
        points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    }
    ctx.stroke();
    if (channel.elements.includes("electric")) {
        drawElectricArc(ctx, origin, target.position, { time: progress * 2, color: ELEMENTAL_PALETTE.electric });
    }
    ctx.restore();
}

export function drawAttachedMarker(ctx, channel, progress) {
    const target = channel.target;
    if (!target) return;
    const marker = channel.recipe?.marker ?? "charge";
    const size = target.radius * 0.46;
    ctx.save();
    ctx.translate(target.position.x, target.position.y);
    ctx.rotate(progress * Math.PI * 2);
    ctx.strokeStyle = channel.colors.at(-1);
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
    ctx.beginPath();
    if (marker === "pierce" || marker === "polarity") {
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
    } else if (marker === "cut" || marker === "crack") {
        ctx.moveTo(-size, -size);
        ctx.lineTo(size, size);
        ctx.moveTo(size, -size);
        ctx.lineTo(-size, size);
    } else if (marker === "thermal") {
        ctx.arc(0, 0, size, 0, Math.PI);
        ctx.moveTo(-size, 0);
        ctx.arc(0, 0, size * 0.65, Math.PI, Math.PI * 2);
    } else if (marker === "burn" || marker === "magma") {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.72, size);
        ctx.lineTo(-size * 0.72, size);
        ctx.closePath();
    } else if (marker === "travel" || marker === "erosion") {
        ctx.setLineDash([5, 4]);
        ctx.arc(0, 0, size, 0, Math.PI * 2);
    } else {
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.moveTo(-size * 0.6, 0);
        ctx.lineTo(size * 0.6, 0);
    }
    ctx.stroke();
    ctx.restore();
}

export function drawFinishImpact(ctx, channel, progress) {
    if (progress < 0.8 || !channel.target) return;
    const finishProgress = clamp01((progress - 0.8) / 0.2);
    const finish = channel.recipe?.finish ?? "burst";
    const target = channel.target;
    ctx.save();
    ctx.globalAlpha = 1 - finishProgress;
    ctx.strokeStyle = channel.colors[0];
    ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
    ctx.beginPath();
    if (finish === "pierce") {
        ctx.moveTo(target.position.x - target.radius - 36, target.position.y);
        ctx.lineTo(target.position.x + target.radius + 36, target.position.y);
    } else if (finish === "shatter" || finish === "shock") {
        Array.from({ length: 8 }, (_, index) => index).forEach((index) => {
            const angle = (Math.PI * 2 * index) / 8;
            const inner = target.radius + 4;
            const outer = inner + finishProgress * (finish === "shock" ? 54 : 38);
            ctx.moveTo(target.position.x + Math.cos(angle) * inner, target.position.y + Math.sin(angle) * inner);
            ctx.lineTo(target.position.x + Math.cos(angle) * outer, target.position.y + Math.sin(angle) * outer);
        });
    } else if (finish === "crush") {
        const gap = (1 - finishProgress) * 40;
        ctx.arc(target.position.x - gap, target.position.y, target.radius, -Math.PI / 2, Math.PI / 2);
        ctx.arc(target.position.x + gap, target.position.y, target.radius, Math.PI / 2, -Math.PI / 2);
    } else {
        const expansion = finish === "converge" ? (1 - finishProgress) * 44 : finishProgress * 44;
        ctx.arc(target.position.x, target.position.y, target.radius + expansion, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
}

export class ElementalChannelEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({ channel = null, source, target, elements, recipe = null, duration = 1, visualOnly = false }) {
        super(target.position.clone(), new Vector2(), target.radius);
        this.channel = channel;
        this.source = source;
        this.target = target;
        this.elements = elements;
        this.recipe = recipe;
        this.colors = elements.map((element) => ELEMENTAL_PALETTE[element]);
        this.duration = duration;
        this.life = duration;
        this.maxLife = duration;
        this.visualOnly = visualOnly;
    }

    update(delta) {
        if (this.target.flags?.defeated || (this.channel && (this.channel.cancelled || this.channel.finished))) {
            this.isExpired = true;
            return;
        }
        this.pos = this.target.position.clone();
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = clamp01(this.lifeProgress);
        const view = {
            ...this,
            target: this.target,
            source: this.source,
            colors: this.colors,
            elements: this.elements,
            recipe: this.recipe
        };
        drawTargetChannelTimeline(ctx, view, progress);
        drawPathFlow(ctx, view, progress);
        drawMultiShapeMotion(ctx, view, progress);
        drawAttachedMarker(ctx, view, progress);
        drawFinishImpact(ctx, view, progress);
    }
}
