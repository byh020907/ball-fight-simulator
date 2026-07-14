import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const MAX_FLAME_COUNT = Math.max(...REWARD_BALANCE.rebirth.visualStages.map((stage) => stage.flameCount));

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

    const flameCount = Math.min(MAX_FLAME_COUNT, visual.flameCount);
    for (let index = 0; index < flameCount; index += 1) {
        const angle = (Math.PI * 2 * index) / flameCount - Math.PI / 2 + time * 0.35;
        const distance = ball.radius + 9 + (index % 2) * 3;
        const flameLength = 5 + visual.stage * 2 + speedRatio * 6;
        const startX = x + Math.cos(angle) * distance;
        const startY = y + Math.sin(angle) * distance;
        const endX = x + Math.cos(angle) * (distance + flameLength);
        const endY = y + Math.sin(angle) * (distance + flameLength);
        ctx.globalAlpha = 0.58 + ((index + visual.stage) % 3) * 0.1;
        ctx.lineWidth = 2 + visual.stage * 0.35;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = visual.color;
    ctx.font = "900 12px Bahnschrift, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", x, y - ball.radius * 0.42);
    ctx.restore();
}
