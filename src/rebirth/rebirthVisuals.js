import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MAX_FLAME_COUNT = Math.max(...REWARD_BALANCE.rebirth.visualStages.map((stage) => stage.flameCount));
const MAX_CONTOUR_POINT_COUNT = 13;
const FLAME_MOVEMENT_THRESHOLD = 8;
const MIN_FLAME_PARTICLE_COUNT = 6;
const MAX_FLAME_PARTICLE_COUNT = 12;
const FLAME_PARTICLE_THRUST = 340;
const FLAME_PARTICLE_DRAG = 3.6;
const FLAME_PARTICLE_TURBULENCE = 140;
const FLAME_PARTICLE_ATTACHMENT_POWER = 1.8;
const MAX_FLAME_PLUME_ELAPSED = 0.25;
const MAX_FLAME_PLUME_STEP = 1 / 60;
const flamePlumeStates = new WeakMap();

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

function getFlameTargetDirection(ball) {
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

function getFlameParticleCount(visual) {
    return clamp(MIN_FLAME_PARTICLE_COUNT + visual.flameCount, MIN_FLAME_PARTICLE_COUNT, MAX_FLAME_PARTICLE_COUNT);
}

function getFlameEmitter(ball, direction) {
    return {
        x: ball.position.x + direction.x * (ball.radius - 2),
        y: ball.position.y + direction.y * (ball.radius - 2)
    };
}

function getParticleLifetime(seed) {
    return 0.38 + (hashNoise(seed, 41) + 1) * 0.5 * 0.24;
}

function createFlameParticle(ball, emitter, direction, seed, ageProgress = 0) {
    const perpendicular = { x: -direction.y, y: direction.x };
    const lateralNoise = hashNoise(seed, 71);
    const forwardNoise = (hashNoise(seed, 89) + 1) * 0.5;
    const lifetime = getParticleLifetime(seed);
    const age = lifetime * clamp(ageProgress, 0, 0.96);
    const initialForward = ball.radius * (0.06 + ageProgress * (0.68 + forwardNoise * 0.25));
    const lateral = ball.radius * lateralNoise * (0.08 + ageProgress * 0.16);
    const speed = ball.radius * (2.1 + forwardNoise * 0.95);
    return {
        x: emitter.x + direction.x * initialForward + perpendicular.x * lateral,
        y: emitter.y + direction.y * initialForward + perpendicular.y * lateral,
        velocityX: direction.x * speed + perpendicular.x * lateralNoise * ball.radius * 0.4,
        velocityY: direction.y * speed + perpendicular.y * lateralNoise * ball.radius * 0.4,
        age,
        lifetime,
        seed
    };
}

function createFlamePlumeState(ball, visual, direction, time) {
    const emitter = getFlameEmitter(ball, direction);
    const seed = getBallSeed(ball);
    const particleCount = getFlameParticleCount(visual);
    return {
        emitter,
        time,
        nextSeed: seed + particleCount * 19,
        particles: Array.from({ length: particleCount }, (_, index) =>
            createFlameParticle(ball, emitter, direction, seed + index * 19, (index + 0.35) / particleCount)
        )
    };
}

function reconcileFlameParticleCount(state, ball, visual, direction) {
    const particleCount = getFlameParticleCount(visual);
    if (state.particles.length > particleCount) {
        state.particles.length = particleCount;
        return;
    }
    while (state.particles.length < particleCount) {
        const progress = (state.particles.length + 0.35) / particleCount;
        state.particles.push(createFlameParticle(ball, state.emitter, direction, state.nextSeed++, progress));
    }
}

function respawnFlameParticle(state, particle, ball, emitter, direction) {
    const nextParticle = createFlameParticle(ball, emitter, direction, state.nextSeed++);
    Object.assign(particle, nextParticle);
}

function updateFlameParticle(particle, state, ball, emitter, direction, elapsed) {
    const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
    const perpendicular = { x: -direction.y, y: direction.x };
    const turbulence =
        smoothNoise(state.time * 4.2 + particle.age * 3.4, particle.seed + 113) *
        FLAME_PARTICLE_TURBULENCE *
        (0.45 + ageProgress * 0.55);
    particle.velocityX += (direction.x * FLAME_PARTICLE_THRUST + perpendicular.x * turbulence) * elapsed;
    particle.velocityY += (direction.y * FLAME_PARTICLE_THRUST + perpendicular.y * turbulence) * elapsed;
    const drag = Math.exp(-FLAME_PARTICLE_DRAG * elapsed);
    particle.velocityX *= drag;
    particle.velocityY *= drag;
    particle.x += particle.velocityX * elapsed;
    particle.y += particle.velocityY * elapsed;
    particle.age += elapsed;
    if (particle.age >= particle.lifetime) {
        respawnFlameParticle(state, particle, ball, emitter, direction);
    }
}

function getFlamePlumeDirection(state, ball, fallbackDirection) {
    const flow = state.particles.reduce(
        (total, particle) => {
            const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
            const weight = 0.04 + ageProgress ** 2.4;
            return {
                x: total.x + (particle.x - ball.position.x) * weight,
                y: total.y + (particle.y - ball.position.y) * weight
            };
        },
        { x: 0, y: 0 }
    );
    if (Math.hypot(flow.x, flow.y) < Math.max(1, ball.radius * 0.12)) return fallbackDirection;
    return normalizeDirection(flow);
}

function getRebirthFlamePlume(ball, visual, time) {
    const direction = getFlameTargetDirection(ball);
    const previousState = flamePlumeStates.get(ball);
    if (!previousState || time < previousState.time) {
        const state = createFlamePlumeState(ball, visual, direction, time);
        flamePlumeStates.set(ball, state);
        return { direction: getFlamePlumeDirection(state, ball, direction), particles: state.particles };
    }

    const state = previousState;
    reconcileFlameParticleCount(state, ball, visual, direction);
    const elapsed = Math.min(MAX_FLAME_PLUME_ELAPSED, Math.max(0, time - state.time));
    const emitter = getFlameEmitter(ball, direction);
    const emitterShift = { x: emitter.x - state.emitter.x, y: emitter.y - state.emitter.y };
    const emitterDistance = Math.hypot(emitterShift.x, emitterShift.y);
    if (emitterDistance > Math.max(1, ball.radius * 3)) {
        const resetState = createFlamePlumeState(ball, visual, direction, time);
        flamePlumeStates.set(ball, resetState);
        return { direction: getFlamePlumeDirection(resetState, ball, direction), particles: resetState.particles };
    }

    state.particles.forEach((particle) => {
        const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
        const attachment = (1 - ageProgress) ** FLAME_PARTICLE_ATTACHMENT_POWER;
        particle.x += emitterShift.x * attachment;
        particle.y += emitterShift.y * attachment;
    });

    let remaining = elapsed;
    while (remaining > 0) {
        const step = Math.min(MAX_FLAME_PLUME_STEP, remaining);
        state.particles.forEach((particle) => updateFlameParticle(particle, state, ball, emitter, direction, step));
        state.time += step;
        remaining -= step;
    }
    state.time = time;
    state.emitter = emitter;
    return { direction: getFlamePlumeDirection(state, ball, direction), particles: state.particles };
}

export function getRebirthFlameDirection(ball, time = 0) {
    return getRebirthFlamePlume(ball, getRebirthVisualProfile(1), time).direction;
}

function getFlameContourPointCount(stage) {
    return Math.min(MAX_CONTOUR_POINT_COUNT, 9 + Math.max(0, stage));
}

function getFlameTongueIntensity(progress, tongueCount, time, seed, flickerStrength) {
    const mainCrown = Math.sin(progress * Math.PI) ** 1.1;
    const secondaryTongues = Math.abs(Math.sin(progress * tongueCount * Math.PI));
    const broadFlow = smoothNoise(time * (2 + flickerStrength * 1.4) + progress * 2.4, seed);
    const fineFlow = smoothNoise(time * (4.6 + flickerStrength * 2.2) + progress * 5.8, seed + 29);
    return clamp(
        0.54 + mainCrown * 0.3 + secondaryTongues * 0.18 + (broadFlow * 0.68 + fineFlow * 0.32) * flickerStrength,
        0.2,
        1.42
    );
}

function getFlameLateralFlicker(progress, time, seed, flickerStrength) {
    const broadSway = smoothNoise(time * (1.6 + flickerStrength * 1.8) + progress * 3.2, seed + 53);
    const fineSway = smoothNoise(time * (4.1 + flickerStrength * 2.6) + progress * 7.6, seed + 79);
    return (broadSway * 0.7 + fineSway * 0.3) * flickerStrength;
}

function createFlamePoint(ball, direction, perpendicular, lateral, forward) {
    return {
        x: ball.position.x + perpendicular.x * lateral + direction.x * forward,
        y: ball.position.y + perpendicular.y * lateral + direction.y * forward
    };
}

function getQuadraticPoint(start, control, end, progress) {
    const inverseProgress = 1 - progress;
    return {
        x: inverseProgress ** 2 * start.x + 2 * inverseProgress * progress * control.x + progress ** 2 * end.x,
        y: inverseProgress ** 2 * start.y + 2 * inverseProgress * progress * control.y + progress ** 2 * end.y
    };
}

function getQuadraticDirection(start, control, end, progress) {
    return normalizeDirection({
        x: 2 * (1 - progress) * (control.x - start.x) + 2 * progress * (end.x - control.x),
        y: 2 * (1 - progress) * (control.y - start.y) + 2 * progress * (end.y - control.y)
    });
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

function drawFlamePlumeParticles(ctx, particles, visual, ball) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    particles.forEach((particle) => {
        const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
        const heat = 1 - ageProgress;
        const radius = Math.max(1.7, ball.radius * (0.038 + heat * 0.038));
        const alpha = (0.14 + heat * 0.27) * (0.8 + visual.stage * 0.05);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#e74716";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.82;
        ctx.fillStyle = "#ffad3c";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius * 0.56, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

/**
 * 공 표면에 붙은 하나의 화염 실루엣을 만든다.
 * 정지 시에는 상단 외곽이, 이동 중에는 속도 반대쪽 외곽이 불꽃으로 밀려난다.
 */
export function createRebirthFlameContour(
    ball,
    visual,
    { time = 0, direction = getFlameTargetDirection(ball), trailDirection = direction } = {}
) {
    if (!visual || visual.rebirthCount <= 0) return null;
    const speed = getBallSpeed(ball);
    const speedRatio = Math.min(1, speed / Math.max(1, ball.stats?.baseSpeed ?? 1));
    const perpendicular = { x: -direction.y, y: direction.x };
    const rootHalfWidth = Math.max(4, Math.min(ball.radius - 3, ball.radius * 0.92));
    const pointCount = getFlameContourPointCount(visual.stage);
    const tongueCount = Math.max(1, Math.min(4, Math.ceil(visual.flameCount / 2)));
    const flickerStrength = visual.flickerStrength;
    const baseLength = ball.radius * (0.72 + visual.stage * 0.11) + 8 + speedRatio * ball.radius * 0.45;
    const seed = getBallSeed(ball);
    const samples = Array.from({ length: pointCount }, (_, index) => {
        const progress = index / (pointCount - 1);
        const lateral = -rootHalfWidth + rootHalfWidth * 2 * progress;
        return {
            index,
            progress,
            lateral,
            surfaceForward: Math.sqrt(Math.max(0, ball.radius ** 2 - lateral ** 2)) - 1.5,
            rootWeight: index === 0 || index === pointCount - 1 ? 0 : Math.sin(progress * Math.PI) ** 0.58
        };
    });
    const basePoints = samples.map(({ lateral, surfaceForward }) =>
        createFlamePoint(ball, direction, perpendicular, lateral, surfaceForward)
    );
    const rootCenter = createFlamePoint(ball, direction, perpendicular, 0, ball.radius - 1.5);
    const tipIntensity = getFlameTongueIntensity(0.5, tongueCount, time, seed + pointCount * 7, flickerStrength);
    const tipLength = baseLength * tipIntensity;
    const tip = {
        x: rootCenter.x + direction.x * tipLength * 0.34 + trailDirection.x * tipLength * 0.66,
        y: rootCenter.y + direction.y * tipLength * 0.34 + trailDirection.y * tipLength * 0.66
    };
    const turnDifference = 1 - (direction.x * trailDirection.x + direction.y * trailDirection.y);
    const curveBlend = smoothStep(0.03, 0.35, turnDifference);
    const outerPoints = samples.map(({ index, progress, lateral, surfaceForward, rootWeight }) => {
        const localIntensity = getFlameTongueIntensity(progress, tongueCount, time, seed + index * 7, flickerStrength);
        const extension = baseLength * rootWeight * localIntensity;
        const lateralFlicker =
            ball.radius *
            rootWeight *
            (0.04 + flickerStrength * 0.1) *
            getFlameLateralFlicker(progress, time, seed + index * 11, flickerStrength);
        const alignedPoint = createFlamePoint(
            ball,
            direction,
            perpendicular,
            lateral + lateralFlicker,
            surfaceForward + extension
        );
        const isLeftEdge = progress <= 0.5;
        const start = isLeftEdge ? basePoints[0] : basePoints.at(-1);
        const edgeSign = isLeftEdge ? -1 : 1;
        const control = {
            x: start.x + direction.x * tipLength * 0.46 + perpendicular.x * edgeSign * rootHalfWidth * 0.18,
            y: start.y + direction.y * tipLength * 0.46 + perpendicular.y * edgeSign * rootHalfWidth * 0.18
        };
        const edgeProgress = isLeftEdge ? progress * 2 : (1 - progress) * 2;
        const point = getQuadraticPoint(start, control, tip, edgeProgress);
        const tangent = getQuadraticDirection(start, control, tip, edgeProgress);
        const normal = { x: -tangent.y, y: tangent.x };
        const edgeFlicker = rootWeight * (localIntensity - tipIntensity) * baseLength * 0.28;
        point.x += tangent.x * edgeFlicker + normal.x * edgeSign * lateralFlicker;
        point.y += tangent.y * edgeFlicker + normal.y * edgeSign * lateralFlicker;
        return {
            x: alignedPoint.x * (1 - curveBlend) + point.x * curveBlend,
            y: alignedPoint.y * (1 - curveBlend) + point.y * curveBlend
        };
    });

    return {
        direction,
        trailDirection,
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
        flickerStrength: stage.flickerStrength,
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
    const direction = getFlameTargetDirection(ball);
    const plume = getRebirthFlamePlume(ball, visual, time);
    const trailDirection = plume.direction;
    const contour = createRebirthFlameContour(ball, visual, { time, direction, trailDirection });
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
    drawFlamePlumeParticles(ctx, plume.particles, visual, ball);
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
