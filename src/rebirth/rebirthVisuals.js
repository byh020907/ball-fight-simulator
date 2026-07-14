import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { createWaveringPath } from "../effects/waveringPath.js";

const MAX_FLAME_COUNT = Math.max(...REWARD_BALANCE.rebirth.visualStages.map((stage) => stage.flameCount));
const FLAME_MOVEMENT_THRESHOLD = 8;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeDirection(direction) {
    const length = Math.hypot(direction.x, direction.y) || 1;
    return { x: direction.x / length, y: direction.y / length };
}

function smoothStep(edge0, edge1, value) {
    const progress = clamp((value - edge0) / Math.max(0.001, edge1 - edge0), 0, 1);
    return progress * progress * (3 - 2 * progress);
}

function hashNoise(cell, seed) {
    const value = Math.sin((cell + seed * 0.61803398875) * 127.1 + seed * 311.7) * 43758.5453123;
    return (value - Math.floor(value)) * 2 - 1;
}

function smoothNoise(sample, seed) {
    const cell = Math.floor(sample);
    const progress = sample - cell;
    const blend = progress * progress * (3 - 2 * progress);
    return hashNoise(cell, seed) * (1 - blend) + hashNoise(cell + 1, seed) * blend;
}

function getBallSeed(ball) {
    const identity = String(ball.id ?? ball.name ?? `${ball.position.x}:${ball.position.y}`);
    return [...identity].reduce((seed, character) => (seed * 31 + character.charCodeAt(0)) % 997, 1);
}

function getFlameDirection(ball) {
    const velocity = ball.velocity ?? { x: 0, y: 0 };
    const speed = typeof velocity.length === "function" ? velocity.length() : Math.hypot(velocity.x, velocity.y);
    if (speed < FLAME_MOVEMENT_THRESHOLD) return { x: 0, y: -1 };
    const movementDirection = { x: -velocity.x / speed, y: -velocity.y / speed };
    const movementBlend = smoothStep(FLAME_MOVEMENT_THRESHOLD, Math.max(36, ball.stats?.baseSpeed * 0.45), speed);
    return normalizeDirection({
        x: movementDirection.x * movementBlend,
        y: -1 * (1 - movementBlend) + movementDirection.y * movementBlend
    });
}

function drawTaperedPath(ctx, points, color, baseWidth, alpha) {
    ctx.strokeStyle = color;
    points.slice(1).forEach((point, index) => {
        const progress = (index + 1) / (points.length - 1);
        ctx.globalAlpha = alpha * (1 - progress * 0.26);
        ctx.lineWidth = Math.max(0.45, baseWidth * Math.max(0.1, (1 - progress) ** 0.78));
        ctx.beginPath();
        ctx.moveTo(points[index].x, points[index].y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    });
}

export function createRebirthFlamePaths(ball, visual, { time = 0 } = {}) {
    if (!visual || visual.rebirthCount <= 0) return [];
    const velocity = ball.velocity ?? { x: 0, y: 0 };
    const speed = typeof velocity.length === "function" ? velocity.length() : Math.hypot(velocity.x, velocity.y);
    const speedRatio = Math.min(1, speed / Math.max(1, ball.stats?.baseSpeed ?? 1));
    const direction = getFlameDirection(ball);
    const perpendicular = { x: -direction.y, y: direction.x };
    const strandCount = Math.max(3, Math.min(MAX_FLAME_COUNT, visual.flameCount));
    const baseLength = ball.radius * (0.78 + visual.stage * 0.055) + 9 + speedRatio * ball.radius * 0.45;
    const ballSeed = getBallSeed(ball);

    return Array.from({ length: strandCount }, (_, index) => {
        const seed = ballSeed + index * 43;
        const centeredIndex = index - (strandCount - 1) / 2;
        const laneDirection = normalizeDirection({
            x: direction.x + perpendicular.x * centeredIndex * 0.24,
            y: direction.y + perpendicular.y * centeredIndex * 0.24
        });
        const lengthPulse = 0.74 + (smoothNoise(time * 2.4, seed) + 1) * 0.16;
        const flameLength = baseLength * lengthPulse;
        const root = {
            x: ball.position.x + laneDirection.x * (ball.radius - 4) + perpendicular.x * centeredIndex * 2,
            y: ball.position.y + laneDirection.y * (ball.radius - 4) + perpendicular.y * centeredIndex * 2
        };
        const tip = {
            x: root.x + laneDirection.x * flameLength,
            y: root.y + laneDirection.y * flameLength
        };
        const points = createWaveringPath(root, tip, {
            time,
            segmentLength: 8,
            minSegments: 3,
            maxSegments: 6,
            minAmplitude: 2,
            maxAmplitude: 6 + visual.stage,
            amplitudeRatio: 0.24,
            offsetAt: ({ time: pathTime, index: pointIndex, progress }) => {
                const broadFlow = smoothNoise(pathTime * 4.1 - progress * 4.8 + pointIndex * 0.17, seed);
                const tipFlicker = smoothNoise(pathTime * 9.7 - progress * 8.2, seed + 19);
                return broadFlow * 0.72 + tipFlicker * 0.28;
            }
        });
        return { points, root, direction: laneDirection, alpha: 0.58 + ((index + visual.stage) % 3) * 0.1 };
    });
}

export function getRebirthVisualProfile(rebirthCount = 0) {
    const normalizedCount = Math.max(0, Math.floor(Number.isFinite(rebirthCount) ? rebirthCount : 0));
    const stage = [...REWARD_BALANCE.rebirth.visualStages]
        .reverse()
        .find((candidate) => normalizedCount >= candidate.minimumCount);
    return Object.freeze({
        rebirthCount: normalizedCount,
        stage: REWARD_BALANCE.rebirth.visualStages.indexOf(stage),
        color: stage.color,
        outlineWidth: stage.outlineWidth,
        auraRadius: stage.auraRadius,
        flameCount: Math.min(MAX_FLAME_COUNT, stage.flameCount),
        afterimageAlpha: Math.min(0.3, stage.afterimageAlpha)
    });
}

export function drawRebirthVisualUnderlay(ctx, ball, visual, time = performance.now() / 1000) {
    if (!visual || visual.rebirthCount <= 0) return;
    const pulse = 0.88 + Math.sin(time * 4 + ball.position.x * 0.01) * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.18 + visual.stage * 0.05;
    ctx.fillStyle = visual.color;
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, ball.radius + visual.auraRadius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

export function drawRebirthVisualOverlay(ctx, ball, visual, time = performance.now() / 1000) {
    if (!visual || visual.rebirthCount <= 0) return;
    const { x, y } = ball.position;
    const speedRatio = Math.min(1, ball.velocity?.length?.() / Math.max(1, ball.stats.baseSpeed) || 0);
    ctx.save();
    ctx.strokeStyle = visual.color;
    ctx.lineWidth = 1.5 + visual.outlineWidth;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, ball.radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.55 + speedRatio * visual.afterimageAlpha;
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -time * (16 + visual.stage * 5);
    ctx.beginPath();
    ctx.arc(x, y, ball.radius + 7 + visual.outlineWidth, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    createRebirthFlamePaths(ball, visual, { time }).forEach((flame) => {
        drawTaperedPath(ctx, flame.points, "#e74716", 8 + visual.stage * 0.68, flame.alpha * 0.82);
        drawTaperedPath(ctx, flame.points, "#ff942b", 4.6 + visual.stage * 0.42, flame.alpha);
        const corePointCount = Math.max(2, Math.ceil(flame.points.length * 0.68));
        drawTaperedPath(
            ctx,
            flame.points.slice(0, corePointCount),
            "#fff2b0",
            1.9 + visual.stage * 0.16,
            flame.alpha * 0.9
        );
    });
    ctx.globalCompositeOperation = "source-over";

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = visual.color;
    ctx.font = "900 12px Bahnschrift, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", x, y - ball.radius * 0.42);
    ctx.restore();
}
