import { Vector2 } from "../core.js";

const ELECTRIC_ARC_CONFIG = Object.freeze({
    segmentLength: 28,
    minSegments: 4,
    maxSegments: 14,
    minAmplitude: 8,
    maxAmplitude: 26,
    amplitudeRatio: 0.085
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getArcOffset(time, index) {
    const rapidFlicker = Math.sin(time * 34 + index * 2.71);
    const slowDrift = Math.sin(time * 15 + index * 7.93);
    return rapidFlicker * 0.72 + slowDrift * 0.28;
}

function drawArcPath(ctx, points, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
}

export function createElectricArcPath(from, to, { time = 0, amplitude = null } = {}) {
    const direction = Vector2.subtract(to, from);
    const distance = direction.length();
    if (distance <= 0.001) return [new Vector2(from.x, from.y), new Vector2(to.x, to.y)];

    const segmentCount = clamp(
        Math.ceil(distance / ELECTRIC_ARC_CONFIG.segmentLength),
        ELECTRIC_ARC_CONFIG.minSegments,
        ELECTRIC_ARC_CONFIG.maxSegments
    );
    const perpendicular = new Vector2(-direction.y / distance, direction.x / distance);
    const resolvedAmplitude = Number.isFinite(amplitude)
        ? amplitude
        : clamp(
              distance * ELECTRIC_ARC_CONFIG.amplitudeRatio,
              ELECTRIC_ARC_CONFIG.minAmplitude,
              ELECTRIC_ARC_CONFIG.maxAmplitude
          );
    const intermediatePoints = Array.from({ length: segmentCount - 1 }, (_, offset) => {
        const index = offset + 1;
        const progress = index / segmentCount;
        const envelope = Math.sin(progress * Math.PI);
        const offsetDistance = getArcOffset(time, index) * resolvedAmplitude * envelope;
        return new Vector2(
            from.x + direction.x * progress + perpendicular.x * offsetDistance,
            from.y + direction.y * progress + perpendicular.y * offsetDistance
        );
    });

    return [new Vector2(from.x, from.y), ...intermediatePoints, new Vector2(to.x, to.y)];
}

export function drawElectricArc(ctx, from, to, { time = 0, color = "#a8e6ff" } = {}) {
    const points = createElectricArcPath(from, to, { time });
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    drawArcPath(ctx, points, "rgba(91, 216, 255, 0.28)", 11);
    ctx.shadowBlur = 5;
    drawArcPath(ctx, points, color, 3.2);
    ctx.shadowBlur = 0;
    drawArcPath(ctx, points, "#f4fdff", 1.1);
    ctx.restore();
    return points;
}
