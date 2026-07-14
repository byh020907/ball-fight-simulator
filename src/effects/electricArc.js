import { createWaveringPath } from "./waveringPath.js";

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
    return createWaveringPath(from, to, {
        time,
        amplitude,
        offsetAt: ({ time: pathTime, index }) => getArcOffset(pathTime, index)
    });
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
