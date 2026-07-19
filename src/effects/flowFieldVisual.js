import { Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

const GOLDEN_ANGLE = 2.399;

function createStream(center, radius, count, index) {
    const angle = (Math.PI * 2 * index) / count;
    const radialRatio = 0.18 + ((index * 11) % 23) / 27;
    const position = Vector2.add(center, Vector2.fromAngle(angle, radius * radialRatio));
    return { position, points: [position.clone()], seed: index };
}

function resetStream(stream, center, radius, rotation) {
    const angle = (stream.seed * GOLDEN_ANGLE + rotation) % (Math.PI * 2);
    stream.position = Vector2.add(center, Vector2.fromAngle(angle, radius * 0.94));
    stream.points = [stream.position.clone()];
}

export function createFlowFieldVisual(center, { radius, streamCount = 26, pointLimit = 7 }) {
    return {
        radius,
        pointLimit,
        streams: Array.from({ length: streamCount }, (_, index) => createStream(center, radius, streamCount, index))
    };
}

export function updateFlowFieldVisual(
    field,
    { center, delta, innerRadius, rotation = 0, outerPadding = 20, getAccelerationAt, getSpeedBoost = () => 1 }
) {
    for (const stream of field.streams) {
        const distance = Vector2.subtract(stream.position, center).length();
        const acceleration = getAccelerationAt(stream.position);
        stream.position.add(acceleration.scale(delta * getSpeedBoost(distance)));
        stream.points.push(stream.position.clone());
        if (stream.points.length > field.pointLimit) stream.points.shift();
        if (distance < innerRadius || distance > field.radius + outerPadding) {
            resetStream(stream, center, field.radius, rotation);
        }
    }
}

export function drawFlowFieldVisual(
    ctx,
    field,
    { center, color, lineWidth = 2, baseAlpha = 0.35, innerAlpha = 0.6, boundaryColor = null, boundaryAlpha = 0.72 }
) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", lineWidth);
    for (const stream of field.streams) {
        if (stream.points.length < 2) continue;
        const distance = Vector2.subtract(stream.position, center).length();
        ctx.globalAlpha = baseAlpha + Math.max(0, 1 - distance / field.radius) * innerAlpha;
        ctx.beginPath();
        stream.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
    }
    if (boundaryColor) {
        ctx.globalAlpha = boundaryAlpha;
        ctx.strokeStyle = boundaryColor;
        ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.5);
        ctx.beginPath();
        ctx.arc(center.x, center.y, field.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
