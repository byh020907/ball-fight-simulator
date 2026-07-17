import { getVisibleLineWidth } from "./effectVisibility.js";

const TAU = Math.PI * 2;

export const LASER_CASTER_PHASES = Object.freeze({
    MATERIALIZE: "materialize",
    CHARGE: "charge",
    FIRE: "fire",
    DISSIPATE: "dissipate"
});

export const LASER_CASTER_PALETTE = Object.freeze({
    body: "#5f2630",
    bodyHighlight: "#ff7648",
    outline: "#2b151d",
    lens: "#fff3d8",
    lensCore: "#ff4d4d",
    aim: "#ff8b4b",
    fire: "#fff6df",
    particle: "#ff9a43"
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 레이저를 조준·발사하는 모든 주체가 공유하는 순수 시각 상태입니다.
 * renderer는 이 객체 외의 게임 상태를 읽지 않습니다.
 */
export function createLaserCasterVisualState({
    origin,
    angle,
    phase,
    phaseProgress,
    scale = 1,
    palette = LASER_CASTER_PALETTE,
    aimLength = 140
}) {
    return {
        origin: { x: origin.x, y: origin.y },
        angle,
        phase,
        phaseProgress: clamp(phaseProgress, 0, 1),
        scale,
        palette,
        aimLength: Math.max(0, aimLength)
    };
}

/** 공통 cyclops 캐스터의 발사 원점은 입력 origin과 정확히 일치합니다. */
export function getLaserCasterFireOrigin({ origin }) {
    return { x: origin.x, y: origin.y };
}

/**
 * 순수 Canvas component: cyclops 실루엣, 눈 렌즈, 조준선, 발사 광원과 소멸 파편만 그립니다.
 * owner, target, simulation, AI, 피해 상태를 읽거나 만들지 않습니다.
 */
export function drawLaserCasterVisual(ctx, state) {
    const { origin, angle, phase, phaseProgress, scale, palette, aimLength } = state;
    const radius = 24 * scale;
    const bodyAlpha = getBodyAlpha(phase, phaseProgress);

    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);

    if (phase === LASER_CASTER_PHASES.MATERIALIZE) drawMaterializeFlash(ctx, radius, phaseProgress, palette);
    if (phase === LASER_CASTER_PHASES.DISSIPATE) drawDissipateParticles(ctx, radius, phaseProgress, palette);

    if (bodyAlpha > 0) {
        drawCyclopsSilhouette(ctx, radius, bodyAlpha, palette);
        drawCyclopsLens(ctx, radius, phase, phaseProgress, bodyAlpha, palette);
    }
    if (phase === LASER_CASTER_PHASES.MATERIALIZE || phase === LASER_CASTER_PHASES.CHARGE) {
        drawAimLine(ctx, aimLength, phaseProgress, palette);
    }
    if (phase === LASER_CASTER_PHASES.FIRE) drawFireOrigin(ctx, radius, phaseProgress, palette);

    ctx.restore();
}

function getBodyAlpha(phase, progress) {
    if (phase === LASER_CASTER_PHASES.MATERIALIZE) return 0.28 + progress * 0.72;
    if (phase === LASER_CASTER_PHASES.DISSIPATE) return 1 - progress;
    return 1;
}

function drawCyclopsSilhouette(ctx, radius, alpha, palette) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = palette.body;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", Math.max(2, radius * 0.12));
    ctx.beginPath();
    ctx.ellipse(-radius * 0.56, 0, radius * 0.72, radius * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.bodyHighlight;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.78, -radius * 0.16, radius * 0.24, radius * 0.17, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
}

function drawCyclopsLens(ctx, radius, phase, progress, alpha, palette) {
    const lensRadius = radius * (phase === LASER_CASTER_PHASES.FIRE ? 0.31 + progress * 0.06 : 0.27);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = palette.lens;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", Math.max(2, radius * 0.08));
    ctx.beginPath();
    ctx.arc(0, 0, lensRadius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.lensCore;
    ctx.beginPath();
    ctx.arc(0, 0, lensRadius * 0.46, 0, TAU);
    ctx.fill();
    ctx.restore();
}

function drawMaterializeFlash(ctx, radius, progress, palette) {
    const flashRadius = radius * (1.7 - progress * 0.62);
    ctx.save();
    ctx.globalAlpha *= 0.72 * (1 - progress);
    ctx.strokeStyle = palette.aim;
    ctx.lineWidth = getVisibleLineWidth(ctx, "standard", Math.max(2, radius * 0.1));
    ctx.beginPath();
    ctx.arc(-radius * 0.42, 0, flashRadius, 0, TAU);
    ctx.stroke();
    ctx.restore();
}

function drawAimLine(ctx, aimLength, progress, palette) {
    ctx.save();
    ctx.globalAlpha *= 0.52 + progress * 0.3;
    ctx.strokeStyle = palette.aim;
    ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 2);
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(aimLength, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawFireOrigin(ctx, radius, progress, palette) {
    ctx.save();
    ctx.globalAlpha *= 0.92 - progress * 0.18;
    ctx.fillStyle = palette.fire;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.33 + progress * 0.09), 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.lensCore;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.17, 0, TAU);
    ctx.fill();
    ctx.restore();
}

function drawDissipateParticles(ctx, radius, progress, palette) {
    ctx.save();
    ctx.globalAlpha *= 1 - progress;
    ctx.fillStyle = palette.particle;
    Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * TAU + progress * 1.8;
        const distance = radius * (0.45 + progress * (0.9 + (index % 3) * 0.18));
        const size = Math.max(1.5, radius * (0.11 - progress * 0.05));
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * distance - radius * 0.35, Math.sin(angle) * distance, size, 0, TAU);
        ctx.fill();
    });
    ctx.restore();
}
