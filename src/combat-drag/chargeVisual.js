function clampRatio(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

export function getChargeConvergenceStyle(fighterRadius, chargeRatio) {
    const radius = Math.max(0, Number(fighterRadius) || 0);
    const progress = clampRatio(chargeRatio);
    const easedProgress = 1 - (1 - progress) ** 2;
    const maximumOffset = Math.max(38, radius * 1.8);
    const minimumOffset = 11;
    return {
        progress,
        radius: radius + minimumOffset + (maximumOffset - minimumOffset) * (1 - easedProgress),
        alpha: 0.16 + 0.8 * progress,
        lineWidth: 2.5 + 3.5 * progress,
        shadowBlur: 10 + 14 * progress
    };
}

export function drawChargeConvergence(ctx, fighter, chargeRatio, color) {
    if (!ctx || !fighter?.position || !Number.isFinite(fighter.position.x) || !Number.isFinite(fighter.position.y)) {
        return false;
    }
    const style = getChargeConvergenceStyle(fighter.radius, chargeRatio);
    ctx.save();
    try {
        ctx.globalAlpha = style.alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = style.lineWidth;
        ctx.shadowColor = color;
        ctx.shadowBlur = style.shadowBlur;
        ctx.beginPath();
        ctx.arc(fighter.position.x, fighter.position.y, style.radius, 0, Math.PI * 2);
        ctx.stroke();
    } finally {
        ctx.restore();
    }
    return true;
}
