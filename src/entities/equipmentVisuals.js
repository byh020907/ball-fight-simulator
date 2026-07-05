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

function slotOffset(slotIndex, count, baseAngle, spread) {
    if (count <= 1) return baseAngle;
    const step = spread / (count - 1);
    return baseAngle - spread / 2 + step * slotIndex;
}

export function drawEquipmentItems(ctx, ball, items = []) {
    if (!Array.isArray(items) || items.length === 0) return;
    ctx.save();
    try {
        const ordered = [...items].sort((a, b) => getDrawOrder(a) - getDrawOrder(b));
        for (let i = 0; i < ordered.length; i++) {
            drawEquipmentItem(ctx, ball, ordered[i], i);
        }
    } finally {
        ctx.restore();
    }
}

function getDrawOrder(item) {
    if (item.slot === "armor") return 0;
    if (item.slot === "weapon") return 1;
    return 2;
}

function drawEquipmentItem(ctx, ball, item, index) {
    if (!item || !ball) return;
    const drawKey = item.draw ?? item.slot;
    if (drawKey === "weapon") {
        drawWeapon(ctx, ball, item);
    } else if (drawKey === "armor") {
        drawArmor(ctx, ball, item);
    } else if (drawKey === "accessory") {
        drawAccessory(ctx, ball, item, index);
    }
}

// ── Weapon: blade beside body, pointed outward ───────────────────────────

function drawWeapon(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);
    const angle = 0.75; // 오른쪽 하단 방향, 얼굴 영역 피함
    const bladeBase = r * 0.82;
    const bladeTip = r * 1.55 * scale;
    const bladeWidth = Math.max(5, r * 0.1);
    const handleInner = r * 0.38;
    const handleOuter = r * 0.78;

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);
    ctx.rotate(angle);

    // 손잡이
    ctx.strokeStyle = "#555";
    ctx.lineWidth = Math.max(3, r * 0.06);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(handleInner, bladeWidth * 0.15);
    ctx.lineTo(handleOuter, bladeWidth * 0.15);
    ctx.moveTo(handleOuter, -bladeWidth * 0.15);
    ctx.lineTo(handleInner, -bladeWidth * 0.15);
    ctx.stroke();

    // 칼날
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = Math.max(2, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(bladeBase, -bladeWidth);
    ctx.lineTo(bladeTip, 0);
    ctx.lineTo(bladeBase, bladeWidth);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 칼날 중앙선
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    ctx.moveTo(bladeBase, 0);
    ctx.lineTo(bladeTip * 0.85, 0);
    ctx.stroke();

    ctx.restore();
}

// ── Armor: shoulder plates + chest band, avoids face center ──────────────

function drawArmor(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);

    // 어깨 보호대 (좌우 상단 호)
    const shoulderR = r * 1.06;
    const shoulderThick = Math.max(3, r * 0.09 * scale);
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = shoulderThick;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, shoulderR, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, shoulderR, Math.PI * 0.45, Math.PI * 0.85);
    ctx.stroke();

    // 하단 흉갑 호 (가슴 아래쪽, 얼굴 영역 피함)
    const chestR = r * 0.92;
    ctx.strokeStyle = palette.fill;
    ctx.lineWidth = Math.max(4, r * 0.1 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, chestR, Math.PI * 0.95, Math.PI * 1.08);
    ctx.stroke();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2, r * 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, chestR + 1, Math.PI * 0.94, Math.PI * 1.09);
    ctx.stroke();

    ctx.restore();
}

// ── Accessory: gem on body perimeter ring, face area avoided ─────────────

const ACCESSORY_ANGLES = [Math.PI * 1.28, Math.PI * 0.72, Math.PI * 0.35, Math.PI * 1.65];

function drawAccessory(ctx, ball, item, slotIndex) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);
    const angle = ACCESSORY_ANGLES[slotIndex % ACCESSORY_ANGLES.length];
    const dist = r * 1.15;
    const cx = ball.position.x + Math.cos(angle) * dist;
    const cy = ball.position.y + Math.sin(angle) * dist;
    const gemR = Math.max(4, r * 0.12 * scale);

    ctx.save();

    // 연결 링크
    ctx.strokeStyle = "#888";
    ctx.lineWidth = Math.max(1.5, r * 0.025);
    ctx.beginPath();
    ctx.moveTo(ball.position.x + Math.cos(angle) * r * 0.88, ball.position.y + Math.sin(angle) * r * 0.88);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // 보석 본체
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = Math.max(1.5, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx, cy - gemR);
    ctx.lineTo(cx + gemR * 0.7, cy);
    ctx.lineTo(cx, cy + gemR);
    ctx.lineTo(cx - gemR * 0.7, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 하이라이트
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(cx - gemR * 0.2, cy - gemR * 0.2, gemR * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
