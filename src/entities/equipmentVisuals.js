const RARITY_COLORS = Object.freeze({
    common: "#e2e8f0",
    uncommon: "#4ade80",
    rare: "#fbbf24",
    epic: "#c084fc",
    legendary: "#fb7185"
});

const DASH_COUNT_BY_EQUIPMENT_COUNT = Object.freeze([0, 6, 12, 18, 24]);
const RING_RADIUS_RATIO = 0.68;
const DASH_FILL_RATIO = 0.56;
const BASE_DASH_ALPHA = 0.86;
const ENHANCE_ALPHA_STEP = 0.025;
const MAX_ENHANCE_LEVEL = 5;

function getDashAlpha(item) {
    const enhanceLevel = Math.min(MAX_ENHANCE_LEVEL, Math.max(0, item?.enhanceLevel ?? 0));
    return Math.min(0.96, BASE_DASH_ALPHA + enhanceLevel * ENHANCE_ALPHA_STEP);
}

function getDashCount(itemCount) {
    const clampedCount = Math.min(DASH_COUNT_BY_EQUIPMENT_COUNT.length - 1, Math.max(0, itemCount));
    return DASH_COUNT_BY_EQUIPMENT_COUNT[clampedCount];
}

export function getEquipmentRingDashes(items = [], ballRadius = 0) {
    const activeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];
    const dashCount = getDashCount(activeItems.length);
    if (dashCount === 0 || ballRadius <= 0) return [];

    const step = (Math.PI * 2) / dashCount;
    const dashOffset = (step * (1 - DASH_FILL_RATIO)) / 2;
    const ringRadius = ballRadius * RING_RADIUS_RATIO;

    return Array.from({ length: dashCount }, (_, index) => {
        const item = activeItems[index % activeItems.length];
        const startAngle = -Math.PI / 2 + index * step + dashOffset;
        return {
            startAngle,
            endAngle: startAngle + step * DASH_FILL_RATIO,
            radius: ringRadius,
            color: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common,
            alpha: getDashAlpha(item)
        };
    });
}

export function drawEquipmentItems(ctx, ball, items = []) {
    if (!ball) return;
    const dashes = getEquipmentRingDashes(items, ball.radius);
    if (dashes.length === 0) return;

    ctx.save();
    try {
        ctx.translate(ball.position.x, ball.position.y);
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1.4, Math.min(3.2, ball.radius * 0.065));

        for (const dash of dashes) {
            ctx.globalAlpha = dash.alpha;
            ctx.strokeStyle = dash.color;
            ctx.beginPath();
            ctx.arc(0, 0, dash.radius, dash.startAngle, dash.endAngle);
            ctx.stroke();
        }
    } finally {
        ctx.restore();
    }
}
