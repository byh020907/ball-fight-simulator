function clampRatio(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function getConvergenceStyle(fighterRadius, progressRatio, minimumOffset) {
    const radius = Math.max(0, Number(fighterRadius) || 0);
    const progress = clampRatio(progressRatio);
    const easedProgress = 1 - (1 - progress) ** 2;
    const maximumOffset = Math.max(38, radius * 1.8);
    return {
        progress,
        radius: radius + minimumOffset + (maximumOffset - minimumOffset) * (1 - easedProgress),
        alpha: 0.16 + 0.8 * progress,
        lineWidth: 2.5 + 3.5 * progress,
        shadowBlur: 10 + 14 * progress
    };
}

export function getChargeConvergenceStyle(fighterRadius, chargeRatio) {
    return getConvergenceStyle(fighterRadius, chargeRatio, 11);
}

export function getDashEndConvergenceStyle(fighterRadius, endProgress) {
    return getConvergenceStyle(fighterRadius, endProgress, 3);
}

function drawConvergence(ctx, fighter, style, color) {
    if (!ctx || !fighter?.position || !Number.isFinite(fighter.position.x) || !Number.isFinite(fighter.position.y)) {
        return false;
    }
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

export function drawChargeConvergence(ctx, fighter, chargeRatio, color) {
    return drawConvergence(ctx, fighter, getChargeConvergenceStyle(fighter?.radius, chargeRatio), color);
}

export function drawDashEndConvergence(ctx, fighter, endProgress, color) {
    return drawConvergence(ctx, fighter, getDashEndConvergenceStyle(fighter?.radius, endProgress), color);
}
