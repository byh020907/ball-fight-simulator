import { Vector2 } from "../core.js";
import { ELEMENTAL_PALETTE } from "../abilities/elementalistRecipes.js";
import { drawFlameParticlePlume, drawFlameQuadParticles, getRebirthVisualProfile } from "../rebirth/rebirthVisuals.js";
import { drawElectricArc } from "./electricArc.js";
import { getVisibleLineWidth } from "./effectVisibility.js";
import { createFlowFieldVisual, drawFlowFieldVisual, updateFlowFieldVisual } from "./flowFieldVisual.js";

export const ELEMENTAL_CHANNEL_VISUAL_CONFIG = Object.freeze({
    fire: Object.freeze({
        singleParticleCount: 26,
        compositeParticleCount: 16,
        singleTrailParticleCount: 30,
        compositeTrailParticleCount: 20,
        trailCycleSpeed: 0.82,
        trailWidth: 18,
        trailParticleSize: 5.5
    }),
    electric: Object.freeze({ branchCount: 3, branchRadius: 42 }),
    frost: Object.freeze({
        shardCount: 7,
        outerDistance: 64,
        innerDistance: 12,
        singleTravelCount: 13,
        compositeTravelCount: 8,
        travelCycleSpeed: 0.92,
        travelWidth: 18,
        travelShardSize: 4.5
    }),
    wind: Object.freeze({
        singleStreamCount: 16,
        compositeStreamCount: 11,
        radiusPadding: 58,
        pointLimit: 9,
        innerRadiusRatio: 0.72,
        tangentWeight: 3,
        inwardWeight: 1,
        maximumAcceleration: 560,
        baseSpeedBoost: 1.9,
        innerSpeedBoost: 2.8,
        rotationSpeed: 1.4,
        shadowColor: "#257750",
        singleTravelCount: 16,
        compositeTravelCount: 10,
        travelCycleSpeed: 1.08,
        travelWidth: 25,
        travelWispLength: 12
    }),
    earth: Object.freeze({
        rockCount: 7,
        dustCount: 6,
        outerDistance: 58,
        innerDistance: 14,
        singleTravelCount: 12,
        compositeTravelCount: 7,
        travelCycleSpeed: 0.76,
        travelWidth: 14,
        travelRockSize: 4.5
    })
});

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function getElementIntensity(elementCount, index) {
    if (elementCount === 1) return 1;
    return index === 0 ? 0.86 : 0.72;
}

function getTravelBasis(channel) {
    const source = channel.source?.position;
    const target = channel.target?.position;
    if (!source || !target) return null;
    const path = Vector2.subtract(target, source);
    if (path.length() <= 1e-9) return null;
    const direction = path.clone().normalize();
    return {
        source,
        path,
        direction,
        perpendicular: new Vector2(-direction.y, direction.x),
        angle: Math.atan2(direction.y, direction.x)
    };
}

function getTravelProgress(elapsed, speed, index, count) {
    return (elapsed * speed + (index + 0.35) / count) % 1;
}

function getTravelPoint(basis, progress, lane, wave) {
    const center = basis.source.clone().add(basis.path.clone().scale(progress));
    const widthEnvelope = Math.sin(progress * Math.PI);
    const offset = (lane + Math.sin(progress * Math.PI * 2 + wave) * Math.abs(lane) * 0.32) * widthEnvelope;
    return center.add(basis.perpendicular.clone().scale(offset));
}

function createFlameVisual(particleCount) {
    return Object.freeze({
        ...getRebirthVisualProfile(1),
        particleCount
    });
}

function createFireTrailParticle(index, particleCount) {
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.fire;
    const progress = (index + 0.35) / particleCount;
    return {
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0,
        size: config.trailParticleSize * (0.82 + (index % 4) * 0.08),
        rotation: 0,
        age: progress,
        lifetime: 1,
        seed: 173 + index * 19,
        index,
        lane: (((index * 37) % 11) / 10) * 2 - 1,
        speedScale: 0.86 + (index % 5) * 0.035
    };
}

function createFireState(isComposite) {
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.fire;
    const trailParticleCount = isComposite ? config.compositeTrailParticleCount : config.singleTrailParticleCount;
    return {
        stateOwner: {},
        visual: createFlameVisual(isComposite ? config.compositeParticleCount : config.singleParticleCount),
        trailParticles: Array.from({ length: trailParticleCount }, (_, index) =>
            createFireTrailParticle(index, trailParticleCount)
        )
    };
}

function updateFireTrailParticles(fire, source, target, delta) {
    if (!source?.position || !target?.position) return;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.fire;
    const path = Vector2.subtract(target.position, source.position);
    const direction = path.clone().normalize();
    const perpendicular = new Vector2(-direction.y, direction.x);
    const pathAngle = Math.atan2(path.y, path.x);
    fire.trailParticles.forEach((particle) => {
        particle.age = (particle.age + delta * config.trailCycleSpeed * particle.speedScale) % particle.lifetime;
        const progress = particle.age / particle.lifetime;
        const center = source.position.clone().add(path.clone().scale(progress));
        const widthEnvelope = Math.sin(progress * Math.PI);
        const flicker = Math.sin(progress * Math.PI * 5 + particle.index * 1.7) * config.trailWidth * 0.22;
        const offset = (particle.lane * config.trailWidth + flicker) * widthEnvelope;
        particle.x = center.x + perpendicular.x * offset;
        particle.y = center.y + perpendicular.y * offset;
        particle.rotation = pathAngle + Math.PI / 4 + Math.sin(particle.index + progress * 8) * 0.3;
    });
}

function createWindState(target, isComposite) {
    const radius = target.radius + ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind.radiusPadding;
    const streamCount = isComposite
        ? ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind.compositeStreamCount
        : ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind.singleStreamCount;
    return {
        elapsed: 0,
        flowField: createFlowFieldVisual(target.position, {
            radius,
            streamCount,
            pointLimit: ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind.pointLimit
        })
    };
}

export function createElementalChannelVisualState(source, target, elements) {
    const isComposite = elements.length > 1;
    const state = {
        elapsed: 0,
        fire: elements.includes("fire") ? createFireState(isComposite) : null,
        wind: elements.includes("wind") ? createWindState(target, isComposite) : null
    };
    if (state.fire) updateFireTrailParticles(state.fire, source, target, 0);
    return state;
}

function getWindAccelerationAt(center, position, radius) {
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind;
    const inward = Vector2.subtract(center, position);
    const distance = inward.length();
    if (distance > radius) return new Vector2();
    if (distance <= 1e-9) inward.add(new Vector2(1, 0));
    inward.normalize();
    const tangent = new Vector2(-inward.y, inward.x);
    const direction = tangent.scale(config.tangentWeight).add(inward.scale(config.inwardWeight)).normalize();
    const ratio = clamp01(1 - distance / radius);
    return direction.scale(config.maximumAcceleration * ratio * ratio);
}

export function updateElementalChannelVisualState(state, source, target, delta) {
    state.elapsed += delta;
    if (state.fire) updateFireTrailParticles(state.fire, source, target, delta);
    if (!state.wind) return;
    const field = state.wind.flowField;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind;
    updateFlowFieldVisual(field, {
        center: target.position,
        delta,
        innerRadius: target.radius * config.innerRadiusRatio,
        rotation: state.elapsed * config.rotationSpeed,
        outerPadding: target.radius,
        getAccelerationAt: (position) => getWindAccelerationAt(target.position, position, field.radius),
        getSpeedBoost: (distance) =>
            config.baseSpeedBoost + clamp01(1 - distance / field.radius) * config.innerSpeedBoost
    });
}

function drawElectricIdentity(ctx, channel, progress, intensity) {
    const target = channel.target;
    const origin = channel.source?.position ?? target.position;
    ctx.save();
    ctx.globalAlpha = intensity;
    drawElectricArc(ctx, origin, target.position, {
        time: progress * 2.8,
        color: ELEMENTAL_PALETTE.electric
    });
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.electric;
    Array.from({ length: config.branchCount }, (_, index) => index).forEach((index) => {
        const angle = progress * Math.PI * 3 + (Math.PI * 2 * index) / config.branchCount;
        const inner = Vector2.add(target.position, Vector2.fromAngle(angle, target.radius * 0.62));
        const outer = Vector2.add(target.position, Vector2.fromAngle(angle + 0.38, config.branchRadius));
        drawElectricArc(ctx, inner, outer, {
            time: progress * 3.4 + index,
            color: ELEMENTAL_PALETTE.electric
        });
    });
    ctx.restore();
}

function drawFrostShard(ctx, size) {
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.45);
    ctx.lineTo(size * 0.72, 0);
    ctx.lineTo(0, size * 1.45);
    ctx.lineTo(-size * 0.72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.48, -size * 0.3);
    ctx.stroke();
}

function drawFrostTravel(ctx, channel, elapsed, intensity, isComposite) {
    const basis = getTravelBasis(channel);
    if (!basis) return;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.frost;
    const count = isComposite ? config.compositeTravelCount : config.singleTravelCount;
    ctx.save();
    ctx.fillStyle = ELEMENTAL_PALETTE.frost;
    ctx.strokeStyle = "#edf3ff";
    ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.2);
    Array.from({ length: count }, (_, index) => index).forEach((index) => {
        const travelProgress = getTravelProgress(elapsed, config.travelCycleSpeed, index, count);
        const lane = (((index * 5) % 7) / 6 - 0.5) * config.travelWidth;
        const point = getTravelPoint(basis, travelProgress, lane, index * 1.73);
        ctx.save();
        ctx.globalAlpha = intensity * (0.48 + Math.sin(travelProgress * Math.PI) * 0.42);
        ctx.translate(point.x, point.y);
        ctx.rotate(basis.angle + Math.PI / 2 + Math.sin(index + elapsed * 7) * 0.24);
        drawFrostShard(ctx, config.travelShardSize * (0.82 + (index % 3) * 0.12));
        ctx.restore();
    });
    ctx.restore();
}

function drawFrostIdentity(ctx, channel, progress, intensity, phaseOffset) {
    const target = channel.target;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.frost;
    const convergence = 1 - Math.sin(progress * Math.PI * 0.5) * 0.82;
    const distance = target.radius + config.innerDistance + config.outerDistance * convergence;
    ctx.save();
    ctx.fillStyle = "rgba(132, 176, 255, 0.78)";
    ctx.strokeStyle = "#edf3ff";
    ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.5);
    ctx.globalAlpha = intensity;
    Array.from({ length: config.shardCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.shardCount - progress * Math.PI * 0.62 + phaseOffset * 0.35;
        const stagger = 1 + ((index % 3) - 1) * 0.08;
        ctx.save();
        ctx.translate(
            target.position.x + Math.cos(angle) * distance * stagger,
            target.position.y + Math.sin(angle) * distance * stagger
        );
        ctx.rotate(angle + Math.PI / 2);
        drawFrostShard(ctx, 6 + (index % 2) * 2);
        ctx.restore();
    });
    ctx.strokeStyle = ELEMENTAL_PALETTE.frost;
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
    ctx.beginPath();
    Array.from({ length: config.shardCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.shardCount - Math.PI / 2;
        const radius = target.radius + 7 + (index % 2) * 4;
        const x = target.position.x + Math.cos(angle) * radius;
        const y = target.position.y + Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

function drawRock(ctx, size, seed) {
    ctx.beginPath();
    Array.from({ length: 6 }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / 6;
        const radius = size * (0.74 + ((seed + index * 3) % 5) * 0.08);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawEarthTravel(ctx, channel, elapsed, intensity, isComposite) {
    const basis = getTravelBasis(channel);
    if (!basis) return;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.earth;
    const count = isComposite ? config.compositeTravelCount : config.singleTravelCount;
    ctx.save();
    ctx.fillStyle = "#9b7044";
    ctx.strokeStyle = "#4c3525";
    ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.4);
    Array.from({ length: count }, (_, index) => index).forEach((index) => {
        const travelProgress = getTravelProgress(elapsed, config.travelCycleSpeed, index, count);
        const lane = (((index * 3) % 5) / 4 - 0.5) * config.travelWidth;
        const point = getTravelPoint(basis, travelProgress, lane, index * 2.1);
        const hop = Math.sin(travelProgress * Math.PI * 3 + index * 0.8);
        ctx.save();
        ctx.globalAlpha = intensity * (0.42 + Math.sin(travelProgress * Math.PI) * 0.5);
        ctx.translate(point.x, point.y + hop * config.travelWidth * 0.28);
        ctx.rotate(basis.angle + elapsed * 1.8 + index);
        drawRock(ctx, config.travelRockSize * (0.78 + (index % 3) * 0.16), index);
        ctx.restore();

        ctx.fillStyle = "rgba(197, 155, 97, 0.38)";
        ctx.beginPath();
        ctx.arc(
            point.x - basis.direction.x * 8,
            point.y - basis.direction.y * 8,
            2.2 + (index % 3) * 0.7,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = "#9b7044";
    });
    ctx.restore();
}

function drawEarthIdentity(ctx, channel, progress, intensity, phaseOffset) {
    const target = channel.target;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.earth;
    const impact = Math.sin(progress * Math.PI * 0.5);
    const distance = target.radius + config.innerDistance + config.outerDistance * (1 - impact);
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.fillStyle = "#9b7044";
    ctx.strokeStyle = "#4c3525";
    ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.7);
    Array.from({ length: config.rockCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.rockCount + progress * 0.42 + phaseOffset * 0.28;
        const lift = Math.sin(progress * Math.PI + index * 1.7) * 8;
        ctx.save();
        ctx.translate(
            target.position.x + Math.cos(angle) * distance,
            target.position.y + Math.sin(angle) * distance - lift
        );
        ctx.rotate(angle + progress * 1.3);
        drawRock(ctx, 7 + (index % 3) * 1.5, index);
        ctx.restore();
    });
    ctx.fillStyle = "rgba(197, 155, 97, 0.42)";
    Array.from({ length: config.dustCount }, (_, index) => index).forEach((index) => {
        const angle = (Math.PI * 2 * index) / config.dustCount - progress * 0.9;
        const dustDistance = target.radius + 12 + impact * (18 + (index % 2) * 7);
        ctx.beginPath();
        ctx.arc(
            target.position.x + Math.cos(angle) * dustDistance,
            target.position.y + Math.sin(angle) * dustDistance,
            3 + (index % 3),
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
    ctx.strokeStyle = ELEMENTAL_PALETTE.earth;
    ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4);
    ctx.beginPath();
    ctx.arc(target.position.x, target.position.y, target.radius + 10, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    ctx.restore();
}

function drawWindIdentity(ctx, channel, state, intensity) {
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind;
    ctx.save();
    drawFlowFieldVisual(ctx, state.wind.flowField, {
        center: channel.target.position,
        color: config.shadowColor,
        lineWidth: 4.8,
        baseAlpha: 0.38 * intensity,
        innerAlpha: 0.34 * intensity
    });
    drawFlowFieldVisual(ctx, state.wind.flowField, {
        center: channel.target.position,
        color: ELEMENTAL_PALETTE.wind,
        lineWidth: 2,
        baseAlpha: 0.74 * intensity,
        innerAlpha: 0.24 * intensity
    });
    ctx.restore();
}

function drawWindTravel(ctx, channel, elapsed, intensity, isComposite) {
    const basis = getTravelBasis(channel);
    if (!basis) return;
    const config = ELEMENTAL_CHANNEL_VISUAL_CONFIG.wind;
    const count = isComposite ? config.compositeTravelCount : config.singleTravelCount;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = ELEMENTAL_PALETTE.wind;
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.4);
    Array.from({ length: count }, (_, index) => index).forEach((index) => {
        const travelProgress = getTravelProgress(elapsed, config.travelCycleSpeed, index, count);
        const lane = (((index * 7) % 9) / 8 - 0.5) * config.travelWidth;
        const point = getTravelPoint(basis, travelProgress, lane, index * 1.37);
        const curl = Math.sin(elapsed * 8 + index * 1.9) * config.travelWispLength * 0.55;
        ctx.save();
        ctx.globalAlpha = intensity * (0.34 + Math.sin(travelProgress * Math.PI) * 0.5);
        ctx.translate(point.x, point.y);
        ctx.rotate(basis.angle);
        ctx.beginPath();
        ctx.moveTo(-config.travelWispLength, 0);
        ctx.quadraticCurveTo(0, curl, config.travelWispLength, 0);
        ctx.stroke();
        ctx.restore();
    });
    ctx.restore();
}

export function drawElementalChannelIdentity(ctx, channel, progress, state) {
    const isComposite = channel.elements.length > 1;
    channel.elements.forEach((element, index) => {
        const intensity = getElementIntensity(channel.elements.length, index);
        if (element === "fire") {
            drawFlameQuadParticles(ctx, state.fire.trailParticles, state.fire.visual);
            drawFlameParticlePlume(ctx, channel.target, state.fire.visual, state.elapsed, {
                stateOwner: state.fire.stateOwner
            });
        } else if (element === "electric") {
            drawElectricIdentity(ctx, channel, progress, intensity);
        } else if (element === "frost") {
            drawFrostTravel(ctx, channel, state.elapsed, intensity, isComposite);
            drawFrostIdentity(ctx, channel, progress, intensity, index);
        } else if (element === "wind") {
            drawWindTravel(ctx, channel, state.elapsed, intensity, isComposite);
            drawWindIdentity(ctx, channel, state, intensity);
        } else if (element === "earth") {
            drawEarthTravel(ctx, channel, state.elapsed, intensity, isComposite);
            drawEarthIdentity(ctx, channel, progress, intensity, index);
        }
    });
}
