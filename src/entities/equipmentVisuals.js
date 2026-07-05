const RARITY_COLORS = Object.freeze({
    common: Object.freeze({ fill: "#cbd5e1", stroke: "#475569", glow: "rgba(148, 163, 184, 0.28)" }),
    uncommon: Object.freeze({ fill: "#86efac", stroke: "#15803d", glow: "rgba(34, 197, 94, 0.3)" }),
    rare: Object.freeze({ fill: "#fde68a", stroke: "#b45309", glow: "rgba(245, 158, 11, 0.34)" }),
    epic: Object.freeze({ fill: "#d8b4fe", stroke: "#7e22ce", glow: "rgba(168, 85, 247, 0.36)" }),
    legendary: Object.freeze({ fill: "#fca5a5", stroke: "#b91c1c", glow: "rgba(239, 68, 68, 0.4)" })
});

function getPalette(item) {
    return RARITY_COLORS[item?.rarity] ?? RARITY_COLORS.common;
}

function getEnhanceScale(item) {
    return 1 + Math.min(5, Math.max(0, item?.enhanceLevel ?? 0)) * 0.035;
}

function countSlotBefore(items, item, index) {
    return items.slice(0, index).filter((candidate) => candidate.slot === item.slot).length;
}

export function drawEquipmentItems(ctx, ball, items = []) {
    if (!Array.isArray(items) || items.length === 0) return;
    const ordered = [...items].sort((a, b) => getDrawOrder(a) - getDrawOrder(b));
    for (let i = 0; i < ordered.length; i++) {
        drawEquipmentItem(ctx, ball, ordered[i], countSlotBefore(ordered, ordered[i], i));
    }
}

function getDrawOrder(item) {
    if (item.slot === "armor") return 0;
    if (item.slot === "weapon") return 1;
    return 2;
}

function drawEquipmentItem(ctx, ball, item, slotIndex) {
    if (!item || !ball) return;
    const drawKey = item.draw ?? item.slot;
    if (drawKey === "weapon") {
        drawWeapon(ctx, ball, item);
    } else if (drawKey === "armor") {
        drawArmor(ctx, ball, item);
    } else if (drawKey === "accessory") {
        drawAccessory(ctx, ball, item, slotIndex);
    }
}

function drawWeapon(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);
    const bladeStart = r * 0.72;
    const bladeTip = r * 1.62 * scale;
    const bladeHalf = Math.max(5, r * 0.12);
    const handleStart = r * 0.34;
    const handleEnd = r * 0.88;

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);
    ctx.rotate(-0.68);

    ctx.strokeStyle = "#202020";
    ctx.lineWidth = Math.max(3, r * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(handleStart, 0);
    ctx.lineTo(handleEnd, 0);
    ctx.stroke();

    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(5, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(handleStart, 0);
    ctx.lineTo(handleEnd, 0);
    ctx.stroke();

    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = Math.max(2, r * 0.045);
    ctx.beginPath();
    ctx.moveTo(bladeStart, -bladeHalf);
    ctx.lineTo(bladeTip, 0);
    ctx.lineTo(bladeStart, bladeHalf);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.stroke;
    ctx.beginPath();
    ctx.arc(handleEnd, 0, Math.max(4, r * 0.11), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawArmor(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(5, r * 0.12 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    ctx.fillStyle = palette.glow;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.88);
    ctx.lineTo(r * 0.52, -r * 0.56);
    ctx.lineTo(r * 0.36, r * 0.22);
    ctx.lineTo(0, r * 0.58);
    ctx.lineTo(-r * 0.36, r * 0.22);
    ctx.lineTo(-r * 0.52, -r * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawAccessory(ctx, ball, item, slotIndex) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);
    const angle = slotIndex % 2 === 0 ? Math.PI * 0.22 : Math.PI * 0.78;
    const cx = ball.position.x + Math.cos(angle) * r * 1.18;
    const cy = ball.position.y + Math.sin(angle) * r * 1.18;
    const gemR = Math.max(5, r * 0.14 * scale);

    ctx.save();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2, r * 0.035);
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, r * 1.18, angle - 0.25, angle + 0.25);
    ctx.stroke();

    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = Math.max(2, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx, cy - gemR);
    ctx.lineTo(cx + gemR, cy);
    ctx.lineTo(cx, cy + gemR);
    ctx.lineTo(cx - gemR, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(cx - gemR * 0.25, cy - gemR * 0.25, gemR * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
