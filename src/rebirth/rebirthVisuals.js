import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MAX_FLAME_COUNT = Math.max(...REWARD_BALANCE.rebirth.visualStages.map((stage) => stage.flameCount));
const MAX_CONTOUR_POINT_COUNT = 13;
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

function getBallSpeed(ball) {
    const velocity = ball.velocity ?? { x: 0, y: 0 };
    return typeof velocity.length === "function" ? velocity.length() : Math.hypot(velocity.x, velocity.y);
}

function getFlameDirection(ball) {
    const velocity = ball.velocity ?? { x: 0, y: 0 };
    const speed = getBallSpeed(ball);
    if (speed < FLAME_MOVEMENT_THRESHOLD) return { x: 0, y: -1 };
    const movementDirection = { x: -velocity.x / speed, y: -velocity.y / speed };
    const baseSpeed = ball.stats?.baseSpeed ?? speed;
    const movementBlend = smoothStep(FLAME_MOVEMENT_THRESHOLD, Math.max(36, baseSpeed * 0.45), speed);
    return normalizeDirection({
        x: movementDirection.x * movementBlend,
        y: -1 * (1 - movementBlend) + movementDirection.y * movementBlend
    });
}

function getFlameContourPointCount(stage) {
    return Math.min(MAX_CONTOUR_POINT_COUNT, 9 + Math.max(0, stage));
}

function getFlameTongueIntensity(progress, tongueCount, time, seed) {
    const mainCrown = Math.sin(progress * Math.PI) ** 1.1;
    const secondaryTongues = Math.abs(Math.sin(progress * tongueCount * Math.PI));
    const broadFlow = smoothNoise(time * 0.88 + progress * 2.4, seed);
    const fineFlow = smoothNoise(time * 1.65 + progress * 5.8, seed + 29);
    return clamp(0.54 + mainCrown * 0.3 + secondaryTongues * 0.18 + broadFlow * 0.2 + fineFlow * 0.06, 0.32, 1.18);
}

function createFlamePoint(ball, direction, perpendicular, lateral, forward) {
    return {
        x: ball.position.x + perpendicular.x * lateral + direction.x * forward,
        y: ball.position.y + perpendicular.y * lateral + direction.y * forward
    };
}

function getFlameLayerPoints(contour, extensionRatio) {
    return contour.outerPoints.map((point, index) => {
        const root = contour.basePoints[index];
        return {
            x: root.x + (point.x - root.x) * extensionRatio,
            y: root.y + (point.y - root.y) * extensionRatio
        };
    });
}

function traceSmoothPath(ctx, points, shouldMoveTo = true) {
    if (shouldMoveTo) ctx.moveTo(points[0].x, points[0].y);
    points.slice(1, -1).forEach((point, index) => {
        const next = points[index + 2];
        ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * 0.5, (point.y + next.y) * 0.5);
    });
    const last = points.at(-1);
    ctx.lineTo(last.x, last.y);
}

function drawFlameLayer(ctx, contour, { extensionRatio, color, alpha, strokeColor = null, lineWidth = 0 }) {
    const outerPoints = getFlameLayerPoints(contour, extensionRatio);
    const basePoints = [...contour.basePoints].reverse();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    traceSmoothPath(ctx, outerPoints);
    traceSmoothPath(ctx, basePoints, false);
    ctx.closePath();
    ctx.fill();
    if (strokeColor && lineWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/**
 * 공 표면에 붙은 하나의 화염 실루엣을 만든다.
 * 정지 시에는 상단 외곽이, 이동 중에는 속도 반대쪽 외곽이 불꽃으로 밀려난다.
 */
export function createRebirthFlameContour(ball, visual, { time = 0 } = {}) {
    if (!visual || visual.rebirthCount <= 0) return null;
    const speed = getBallSpeed(ball);
    const speedRatio = Math.min(1, speed / Math.max(1, ball.stats?.baseSpeed ?? 1));
    const direction = getFlameDirection(ball);
    const perpendicular = { x: -direction.y, y: direction.x };
    const rootHalfWidth = Math.max(4, Math.min(ball.radius - 3, ball.radius * 0.92));
    const pointCount = getFlameContourPointCount(visual.stage);
    const tongueCount = Math.max(1, Math.min(4, Math.ceil(visual.flameCount / 2)));
    const baseLength = ball.radius * (0.72 + visual.stage * 0.11) + 8 + speedRatio * ball.radius * 0.45;
    const seed = getBallSeed(ball);
    const basePoints = [];
    const outerPoints = [];

    for (const index of Array.from({ length: pointCount }, (_, pointIndex) => pointIndex)) {
        const progress = index / (pointCount - 1);
        const lateral = -rootHalfWidth + rootHalfWidth * 2 * progress;
        const surfaceForward = Math.sqrt(Math.max(0, ball.radius ** 2 - lateral ** 2)) - 1.5;
        const root = createFlamePoint(ball, direction, perpendicular, lateral, surfaceForward);
        const rootWeight = index === 0 || index === pointCount - 1 ? 0 : Math.sin(progress * Math.PI) ** 0.58;
        const extension =
            baseLength * rootWeight * getFlameTongueIntensity(progress, tongueCount, time, seed + index * 7);
        basePoints.push(root);
        outerPoints.push(createFlamePoint(ball, direction, perpendicular, lateral, surfaceForward + extension));
    }

    return {
        direction,
        basePoints,
        outerPoints,
        tongueCount,
        pointCount,
        maxExtension: Math.max(
            ...outerPoints.map((point, index) =>
                Math.hypot(point.x - basePoints[index].x, point.y - basePoints[index].y)
            )
        )
    };
}

/**
 * 이전 경로 조회 API 호환용. 독립 가닥 대신 단일 실루엣 경계만 반환한다.
 */
export function createRebirthFlamePaths(ball, visual, options) {
    const contour = createRebirthFlameContour(ball, visual, options);
    if (!contour) return [];
    return [
        {
            points: contour.outerPoints,
            root: contour.basePoints[0],
            direction: contour.direction,
            alpha: 1,
            basePoints: contour.basePoints
        }
    ];
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
    const speedRatio = Math.min(1, getBallSpeed(ball) / Math.max(1, ball.stats?.baseSpeed ?? 1));
    const contour = createRebirthFlameContour(ball, visual, { time });
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
    ctx.lineJoin = "round";
    drawFlameLayer(ctx, contour, {
        extensionRatio: 1,
        color: "#e74716",
        alpha: 0.84,
        strokeColor: "#b72812",
        lineWidth: 1.2 + visual.stage * 0.16
    });
    drawFlameLayer(ctx, contour, {
        extensionRatio: 0.72,
        color: "#ff942b",
        alpha: 0.92
    });
    drawFlameLayer(ctx, contour, {
        extensionRatio: 0.38,
        color: visual.color,
        alpha: 0.95
    });
    drawFlameLayer(ctx, contour, {
        extensionRatio: 0.18,
        color: "#fff2b0",
        alpha: 0.92
    });
    ctx.globalCompositeOperation = "source-over";

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = visual.color;
    ctx.font = "900 12px Bahnschrift, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", x, y - ball.radius * 0.42);
    ctx.restore();
}
