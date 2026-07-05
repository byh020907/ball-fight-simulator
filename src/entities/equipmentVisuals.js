const RARITY_COLORS = Object.freeze({
    common: Object.freeze({ fill: "#cbd5e1", stroke: "#475569", dark: "#1e293b", glow: "rgba(148, 163, 184, 0.28)" }),
    uncommon: Object.freeze({ fill: "#86efac", stroke: "#15803d", dark: "#14532d", glow: "rgba(34, 197, 94, 0.3)" }),
    rare: Object.freeze({ fill: "#fde68a", stroke: "#b45309", dark: "#78350f", glow: "rgba(245, 158, 11, 0.34)" }),
    epic: Object.freeze({ fill: "#d8b4fe", stroke: "#7e22ce", dark: "#4c1d95", glow: "rgba(168, 85, 247, 0.36)" }),
    legendary: Object.freeze({ fill: "#fca5a5", stroke: "#b91c1c", dark: "#7f1d1d", glow: "rgba(239, 68, 68, 0.4)" })
});

function getPalette(item) {
    return RARITY_COLORS[item?.rarity] ?? RARITY_COLORS.common;
}

function getEnhanceScale(item) {
    return 1 + Math.min(5, Math.max(0, item?.enhanceLevel ?? 0)) * 0.035;
}

export function drawEquipmentItems(ctx, ball, items = []) {
    if (!Array.isArray(items) || items.length === 0) return;
    ctx.save();
    try {
        const ordered = [...items].sort((a, b) => getDrawOrder(a) - getDrawOrder(b));
        ordered.forEach((item, index) => drawEquipmentItem(ctx, ball, item, index));
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
        const variant = inferArmorVariant(item);
        drawArmorVariant(ctx, ball, item, variant);
    } else if (drawKey === "accessory") {
        drawAccessory(ctx, ball, item, index);
    }
}

/**
 * 아이템 이름 기반 armor visual variant 추론.
 * 저장 데이터 호환을 위해 item.visualVariant가 없으면 이름으로 판단.
 */
export function inferArmorVariant(item) {
    if (item?.visualVariant) return item.visualVariant;
    const name = item?.name ?? "";
    if (name.includes("방패")) return "shield";
    if (name.includes("천") || name.includes("망토") || name.includes("로브")) return "cloth";
    if (name.includes("가죽") || name.includes("조끼")) return "vest";
    return "plate";
}

// ── Armor variant dispatcher ─────────────────────────────────────────────

function drawArmorVariant(ctx, ball, item, variant) {
    switch (variant) {
        case "cloth":
            drawClothArmor(ctx, ball, item);
            return;
        case "vest":
            drawVestArmor(ctx, ball, item);
            return;
        case "shield":
            drawShieldArmor(ctx, ball, item);
            return;
        case "plate":
        default:
            drawPlateArmor(ctx, ball, item);
            return;
    }
}

// ── Cloth: 얇은 천 띠 1개, 몸 아래쪽. 방패 없음 ───────────────────────

function drawClothArmor(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);

    // 몸 아래쪽 부드러운 천 띠
    const clothR = r * 0.76;
    const clothWidth = Math.max(2.5, r * 0.05 * scale);
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = clothWidth + 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, clothR, Math.PI * 0.78, Math.PI * 1.28);
    ctx.stroke();
    ctx.strokeStyle = palette.fill;
    ctx.lineWidth = clothWidth;
    ctx.beginPath();
    ctx.arc(0, 0, clothR, Math.PI * 0.78, Math.PI * 1.28);
    ctx.stroke();

    // 측면 천 주름 (얇은 짧은 선)
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(1, r * 0.018);
    ctx.beginPath();
    ctx.moveTo(-r * 0.68, r * 0.38);
    ctx.lineTo(-r * 0.58, r * 0.48);
    ctx.moveTo(r * 0.62, r * 0.36);
    ctx.lineTo(r * 0.55, r * 0.46);
    ctx.stroke();

    ctx.restore();
}

// ── Vest: 짧은 가죽 조끼/가슴 보호대. 방패 없음 ───────────────────────

function drawVestArmor(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);

    // 가슴 보호대 (좌우 곡선)
    const vestR = r * 0.82;
    const vestWidth = Math.max(3.5, r * 0.065 * scale);
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = vestWidth + 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, vestR, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.strokeStyle = palette.fill;
    ctx.lineWidth = vestWidth;
    ctx.beginPath();
    ctx.arc(0, 0, vestR, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    // 하단 스트랩
    const strapR = r * 0.72;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2, r * 0.03);
    ctx.beginPath();
    ctx.arc(0, 0, strapR, Math.PI * 0.88, Math.PI * 1.15);
    ctx.stroke();

    ctx.restore();
}

// ── Shield: 방패만 단독 표시. 몸 왼쪽 외곽 ────────────────────────────

function drawShieldArmor(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);

    const shieldX = -r * 1.06;
    const shieldY = r * 0.15;
    const shieldRx = r * 0.33 * scale;
    const shieldRy = r * 0.55 * scale;

    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(3, r * 0.06);
    ctx.beginPath();
    ctx.ellipse(shieldX, shieldY, shieldRx, shieldRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 십자 문양
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(shieldX, shieldY - shieldRy * 0.5);
    ctx.lineTo(shieldX, shieldY + shieldRy * 0.4);
    ctx.moveTo(shieldX - shieldRx * 0.5, shieldY);
    ctx.lineTo(shieldX + shieldRx * 0.5, shieldY);
    ctx.stroke();

    ctx.restore();
}

// ── Plate: 중갑옷 띠 ×2 (상단 + 하단) + 좌측 방패. 풀세트 느낌 ─────

function drawPlateArmor(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);

    // 상단 띠
    const topBandR = r * 0.88;
    const topBandWidth = Math.max(5, r * 0.095 * scale);
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = topBandWidth + 1.5;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(0, 0, topBandR, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = topBandWidth;
    ctx.beginPath();
    ctx.arc(0, 0, topBandR, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();

    // 하단 띠
    const botBandR = r * 0.78;
    const botBandWidth = Math.max(4, r * 0.08 * scale);
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = botBandWidth + 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, botBandR, Math.PI * 0.85, Math.PI * 1.18);
    ctx.stroke();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = botBandWidth;
    ctx.beginPath();
    ctx.arc(0, 0, botBandR, Math.PI * 0.85, Math.PI * 1.18);
    ctx.stroke();

    // 좌측 방패
    const shieldX = -r * 1.08;
    const shieldY = r * 0.18;
    const shieldRx = r * 0.35 * scale;
    const shieldRy = r * 0.58 * scale;

    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(3, r * 0.06);
    ctx.beginPath();
    ctx.ellipse(shieldX, shieldY, shieldRx, shieldRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2, r * 0.035);
    ctx.beginPath();
    ctx.arc(shieldX, shieldY, shieldRx * 0.62, shieldRy * 0.82, 0, Math.PI * 1.65, Math.PI * 0.35);
    ctx.stroke();

    ctx.restore();
}

// ── Weapon: 스피어, 몸 오른쪽 외곽에 장착. 삼각형/날카로운 실루엣 ──────

function drawWeapon(ctx, ball, item) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);

    // shaft 방향: 오른쪽 아래로 뻗은 창
    const shaftStartX = r * 0.72;
    const shaftStartY = r * 0.5;
    const shaftEndX = r * 1.58 * scale;
    const shaftEndY = -r * 0.62 * scale;
    const dx = shaftEndX - shaftStartX;
    const dy = shaftEndY - shaftStartY;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;

    const headBaseX = shaftEndX - ux * r * 0.28;
    const headBaseY = shaftEndY - uy * r * 0.28;
    const headHalf = Math.max(7, r * 0.16);
    const guardX = shaftStartX + ux * r * 0.1;
    const guardY = shaftStartY + uy * r * 0.1;

    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);

    // shaft 외곽선
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(5, r * 0.11);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shaftStartX, shaftStartY);
    ctx.lineTo(headBaseX, headBaseY);
    ctx.stroke();

    // shaft 내부선
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(2.5, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(shaftStartX, shaftStartY);
    ctx.lineTo(headBaseX, headBaseY);
    ctx.stroke();

    // 손잡이 보호대 (가드)
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(3, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(guardX + px * r * 0.22, guardY + py * r * 0.22);
    ctx.lineTo(guardX - px * r * 0.22, guardY - py * r * 0.22);
    ctx.stroke();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(1.5, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(guardX + px * r * 0.22, guardY + py * r * 0.22);
    ctx.lineTo(guardX - px * r * 0.22, guardY - py * r * 0.22);
    ctx.stroke();

    // 창날 (triangle — 날카로운 방향성)
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(2, r * 0.038);
    ctx.beginPath();
    ctx.moveTo(shaftEndX, shaftEndY);
    ctx.lineTo(headBaseX + px * headHalf, headBaseY + py * headHalf);
    ctx.lineTo(headBaseX - ux * r * 0.06, headBaseY - uy * r * 0.06);
    ctx.lineTo(headBaseX - px * headHalf, headBaseY - py * headHalf);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 창날 하이라이트 (짧은 선)
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(1, r * 0.02);
    ctx.beginPath();
    ctx.moveTo(headBaseX + px * headHalf * 0.3, headBaseY + py * headHalf * 0.3);
    ctx.lineTo(shaftEndX - ux * r * 0.05, shaftEndY - uy * r * 0.05);
    ctx.stroke();

    ctx.restore();
}

// ── Accessory: 금속 받침 + 보석 + 하이라이트. 원형/빛점 ─────────────────

const ACCESSORY_ANCHORS = Object.freeze([
    Object.freeze({ x: -0.5, y: -0.42 }),
    Object.freeze({ x: 0.53, y: -0.42 }),
    Object.freeze({ x: -0.46, y: 0.34 }),
    Object.freeze({ x: 0.55, y: 0.34 })
]);

function drawAccessory(ctx, ball, item, slotIndex) {
    const palette = getPalette(item);
    const r = ball.radius;
    const scale = getEnhanceScale(item);
    const anchor = ACCESSORY_ANCHORS[slotIndex % ACCESSORY_ANCHORS.length];
    const cx = ball.position.x + anchor.x * r;
    const cy = ball.position.y + anchor.y * r;
    const gemR = Math.max(4, r * 0.1 * scale);

    ctx.save();

    // 금속 받침 (외곽 링)
    ctx.fillStyle = palette.stroke;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(1.5, r * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, gemR * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 작은 연결 장식
    ctx.fillStyle = palette.fill;
    ctx.beginPath();
    ctx.arc(cx - gemR * 0.8, cy - gemR * 0.8, gemR * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 보석 본체
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(1, r * 0.018);
    ctx.beginPath();
    ctx.arc(cx, cy, gemR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 하이라이트
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(cx - gemR * 0.2, cy - gemR * 0.2, gemR * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
