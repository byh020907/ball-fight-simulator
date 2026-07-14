import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MAX_FLAME_COUNT = Math.max(...REWARD_BALANCE.rebirth.visualStages.map((stage) => stage.flameCount));
const FLAME_MOVEMENT_THRESHOLD = 8;
const MIN_FLAME_PARTICLE_COUNT = 56;
const MAX_FLAME_PARTICLE_COUNT = 92;
const MAX_FLAME_REBIRTH_COUNT = 10;
const FLAME_PARTICLE_THRUST = 220;
const FLAME_PARTICLE_DRAG = 3.6;
const FLAME_PARTICLE_TURBULENCE = 104;
const FLAME_PARTICLE_ATTACHMENT_POWER = 1.8;
const FLAME_PARTICLE_ROTATION_FOLLOW = 12;
const FLAME_PARTICLE_ROTATION_DAMPING = 8;
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
    return Math.round(
        MIN_FLAME_PARTICLE_COUNT + (MAX_FLAME_PARTICLE_COUNT - MIN_FLAME_PARTICLE_COUNT) * getFlameGrowth(visual)
    );
}

function getFlameGrowth(visual) {
    return clamp((Math.floor(visual.rebirthCount) - 1) / (MAX_FLAME_REBIRTH_COUNT - 1), 0, 1);
}

function getFlameFlickerStrength(visual) {
    return 0.4 + getFlameGrowth(visual) * 0.36;
}

function getFlameParticleEmitter(ball, anchorAngle) {
    return {
        x: ball.position.x + Math.cos(anchorAngle) * (ball.radius - 2),
        y: ball.position.y + Math.sin(anchorAngle) * (ball.radius - 2)
    };
}

function getRisingFlameParticleDirection(anchorAngle, ageProgress) {
    const surfaceWeight = (1 - ageProgress) ** 1.6 * 0.56;
    const riseWeight = 0.72 + ageProgress * 0.72;
    return normalizeDirection({
        x: Math.cos(anchorAngle) * surfaceWeight,
        y: Math.sin(anchorAngle) * surfaceWeight - riseWeight
    });
}

function getParticleLifetime(seed) {
    return 0.38 + (hashNoise(seed, 41) + 1) * 0.5 * 0.24;
}

function createFlameParticle(ball, seed, ageProgress = 0) {
    const anchorAngle = (hashNoise(seed, 251) + 1) * Math.PI;
    const emitter = getFlameParticleEmitter(ball, anchorAngle);
    const flowDirection = getRisingFlameParticleDirection(anchorAngle, ageProgress);
    const perpendicular = { x: -flowDirection.y, y: flowDirection.x };
    const lateralNoise = hashNoise(seed, 71);
    const forwardNoise = (hashNoise(seed, 89) + 1) * 0.5;
    const lifetime = getParticleLifetime(seed);
    const age = lifetime * clamp(ageProgress, 0, 0.96);
    const initialForward = ball.radius * (0.08 + ageProgress * (1.28 + forwardNoise * 0.3));
    const lateral = ball.radius * lateralNoise * (0.06 + (1 - ageProgress) ** 0.78 * 0.2);
    const speed = ball.radius * (1.9 + forwardNoise * 0.7);
    const velocityX = flowDirection.x * speed + perpendicular.x * lateralNoise * ball.radius * 0.4;
    const velocityY = flowDirection.y * speed + perpendicular.y * lateralNoise * ball.radius * 0.4;
    const size = ball.radius * (0.1 + forwardNoise * 0.05);
    return {
        x: emitter.x + flowDirection.x * initialForward + perpendicular.x * lateral,
        y: emitter.y + flowDirection.y * initialForward + perpendicular.y * lateral,
        velocityX,
        velocityY,
        size,
        anchorAngle,
        emitterX: emitter.x,
        emitterY: emitter.y,
        rotation: Math.atan2(velocityY, velocityX) - Math.PI / 2,
        angularVelocity: hashNoise(seed, 163) * 1.2,
        age,
        lifetime,
        seed
    };
}

function createFlamePlumeState(ball, visual, time) {
    const seed = getBallSeed(ball);
    const particleCount = getFlameParticleCount(visual);
    return {
        position: { x: ball.position.x, y: ball.position.y },
        time,
        nextSeed: seed + particleCount * 19,
        particles: Array.from({ length: particleCount }, (_, index) =>
            createFlameParticle(ball, seed + index * 19, (index + 0.35) / particleCount)
        )
    };
}

function reconcileFlameParticleCount(state, ball, visual) {
    const particleCount = getFlameParticleCount(visual);
    if (state.particles.length > particleCount) {
        state.particles.length = particleCount;
        return;
    }
    while (state.particles.length < particleCount) {
        const progress = (state.particles.length + 0.35) / particleCount;
        state.particles.push(createFlameParticle(ball, state.nextSeed++, progress));
    }
}

function respawnFlameParticle(state, particle, ball) {
    const nextParticle = createFlameParticle(ball, state.nextSeed++);
    Object.assign(particle, nextParticle);
}

function updateFlameParticle(particle, state, ball, visual, elapsed) {
    const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
    const flickerStrength = getFlameFlickerStrength(visual);
    const turbulence =
        smoothNoise(state.time * 4.2 + particle.age * 3.4, particle.seed + 113) *
        FLAME_PARTICLE_TURBULENCE *
        (1 + flickerStrength * 0.35) *
        (0.45 + ageProgress * 0.55);
    particle.velocityX += turbulence * elapsed;
    particle.velocityY -= FLAME_PARTICLE_THRUST * elapsed;
    const drag = Math.exp(-FLAME_PARTICLE_DRAG * elapsed);
    particle.velocityX *= drag;
    particle.velocityY *= drag;
    particle.x += particle.velocityX * elapsed;
    particle.y += particle.velocityY * elapsed;
    const flowRotation = Math.atan2(particle.velocityY, particle.velocityX) - Math.PI / 2;
    const rotationDifference = Math.atan2(
        Math.sin(flowRotation - particle.rotation),
        Math.cos(flowRotation - particle.rotation)
    );
    particle.angularVelocity += rotationDifference * FLAME_PARTICLE_ROTATION_FOLLOW * elapsed;
    particle.angularVelocity *= Math.exp(-FLAME_PARTICLE_ROTATION_DAMPING * elapsed);
    particle.rotation += particle.angularVelocity * elapsed;
    particle.age += elapsed;
    if (particle.age >= particle.lifetime) {
        respawnFlameParticle(state, particle, ball);
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
        const state = createFlamePlumeState(ball, visual, time);
        flamePlumeStates.set(ball, state);
        return { direction: getFlamePlumeDirection(state, ball, direction), particles: state.particles };
    }

    const state = previousState;
    reconcileFlameParticleCount(state, ball, visual);
    const elapsed = Math.min(MAX_FLAME_PLUME_ELAPSED, Math.max(0, time - state.time));
    const ballShift = { x: ball.position.x - state.position.x, y: ball.position.y - state.position.y };
    const ballShiftDistance = Math.hypot(ballShift.x, ballShift.y);
    if (ballShiftDistance > Math.max(1, ball.radius * 3)) {
        const resetState = createFlamePlumeState(ball, visual, time);
        flamePlumeStates.set(ball, resetState);
        return { direction: getFlamePlumeDirection(resetState, ball, direction), particles: resetState.particles };
    }

    state.particles.forEach((particle) => {
        const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
        const attachment = (1 - ageProgress) ** FLAME_PARTICLE_ATTACHMENT_POWER;
        const emitter = getFlameParticleEmitter(ball, particle.anchorAngle);
        particle.x += (emitter.x - particle.emitterX) * attachment;
        particle.y += (emitter.y - particle.emitterY) * attachment;
        particle.emitterX = emitter.x;
        particle.emitterY = emitter.y;
    });

    let remaining = elapsed;
    while (remaining > 0) {
        const step = Math.min(MAX_FLAME_PLUME_STEP, remaining);
        state.particles.forEach((particle) => updateFlameParticle(particle, state, ball, visual, step));
        state.time += step;
        remaining -= step;
    }
    state.time = time;
    state.position = { x: ball.position.x, y: ball.position.y };
    return { direction: getFlamePlumeDirection(state, ball, direction), particles: state.particles };
}

export function getRebirthFlameDirection(ball, time = 0) {
    return getRebirthFlamePlume(ball, getRebirthVisualProfile(1), time).direction;
}

function getFlameParticleColor(ageProgress) {
    if (ageProgress < 0.24) return "#fff2b0";
    if (ageProgress < 0.58) return "#ff942b";
    return "#e74716";
}

function getFlameParticleStyle(particle, visual) {
    const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
    const growth = getFlameGrowth(visual);
    const flicker = 1 + smoothNoise(particle.age * 8.4, particle.seed + 197) * getFlameFlickerStrength(visual) * 0.09;
    return {
        size: particle.size * (1.1 + growth * 0.21) * (1.16 - ageProgress * 0.3) * flicker,
        alpha: clamp((0.54 + (1 - ageProgress) * 0.36) * (0.9 + growth * 0.1), 0.48, 0.96)
    };
}

function drawFlameQuadParticles(ctx, particles, visual) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    [...particles]
        .sort((left, right) => right.age - left.age)
        .forEach((particle) => {
            const ageProgress = clamp(particle.age / particle.lifetime, 0, 1);
            const { size, alpha } = getFlameParticleStyle(particle, visual);
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = getFlameParticleColor(ageProgress);
            ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
            ctx.restore();
        });
    ctx.restore();
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
    const plume = getRebirthFlamePlume(ball, visual, time);
    ctx.save();
    ctx.strokeStyle = visual.color;
    ctx.lineWidth = 1.5 + visual.outlineWidth;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, ball.radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
    drawFlameQuadParticles(ctx, plume.particles, visual);

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = visual.color;
    ctx.font = "900 12px Bahnschrift, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", x, y - ball.radius * 0.42);
    ctx.restore();
}
