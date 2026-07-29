export const PROJECTILE_SLASH_VISUAL_DEFAULTS = Object.freeze({
    color: "#ffe66b",
    accentColor: "#fff4b8",
    lengthMultiplier: 2.8,
    curveMultiplier: 1.35,
    lineWidthMultiplier: 0.52,
    echoOffsetMultiplier: 0.48
});

export function drawProjectileSlashVisual(ctx, position, angle, radius, options = {}) {
    const config = { ...PROJECTILE_SLASH_VISUAL_DEFAULTS, ...options };
    const length = radius * config.lengthMultiplier;
    const curve = radius * config.curveMultiplier;
    const alpha = Math.max(0, Math.min(1, config.alpha ?? 1));
    const scale = Math.max(0, config.scale ?? 1);

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";

    ctx.globalAlpha = alpha * 0.42;
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = radius * config.lineWidthMultiplier * 1.8;
    drawSlashCurve(ctx, -radius * config.echoOffsetMultiplier, length, curve);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = radius * config.lineWidthMultiplier;
    drawSlashCurve(ctx, 0, length, curve);
    ctx.restore();
}

function drawSlashCurve(ctx, xOffset, length, curve) {
    ctx.beginPath();
    ctx.moveTo(xOffset, -length * 0.5);
    ctx.quadraticCurveTo(xOffset + curve, 0, xOffset, length * 0.5);
    ctx.stroke();
}
