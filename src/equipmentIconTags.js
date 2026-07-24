const MAXIMUM_PIXEL_RATIO = 2;

function getCanvasDisplaySize(canvas) {
    const bounds = canvas.getBoundingClientRect?.();
    return {
        width: Math.max(1, bounds?.width || canvas.clientWidth || canvas.width || 1),
        height: Math.max(1, bounds?.height || canvas.clientHeight || canvas.height || 1)
    };
}

function sf(ctx, strokeColor, fillColor, lineWidth) {
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth ?? 0.06;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
    }
}

function drawPolygon(ctx, cx, cy, r, sides, rotation) {
    const angle = rotation ?? 0;
    const step = (Math.PI * 2) / sides;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const px = cx + r * Math.cos(angle + step * i);
        const py = cy + r * Math.sin(angle + step * i);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

const TAG_REGISTRY = new Map();

function registerTag(id, label, draw) {
    TAG_REGISTRY.set(id, { label, draw });
}

function resolveTag(id) {
    return TAG_REGISTRY.get(id) ?? TAG_REGISTRY.get("unknown");
}

registerTag("unknown", "알 수 없음", (ctx, cx, cy) => {
    const r = 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    sf(ctx, "#555555", "#cccccc", 0.07);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.4);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.4);
    ctx.moveTo(cx + r * 0.4, cy - r * 0.4);
    ctx.lineTo(cx - r * 0.4, cy + r * 0.4);
    sf(ctx, "#555555", null, 0.06);
});

registerTag("atk_small", "공격 소형", (ctx, cx, cy) => {
    const guardY = 0.08;
    ctx.fillStyle = "#bb2222";
    ctx.fillRect(cx - 0.2, cy + guardY - 0.025, 0.4, 0.05);
    ctx.fillStyle = "#991111";
    ctx.beginPath();
    ctx.roundRect(cx - 0.04, cy + guardY + 0.03, 0.08, 0.16, 0.02);
    ctx.fill();
    ctx.strokeStyle = "#661111";
    ctx.lineWidth = 0.03;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 0.06, cy + guardY);
    ctx.lineTo(cx + 0.14, cy - 0.02);
    ctx.lineTo(cx + 0.1, cy - 0.14);
    ctx.lineTo(cx + 0.06, cy - 0.28);
    ctx.lineTo(cx - 0.02, cy - 0.22);
    ctx.lineTo(cx - 0.1, cy - 0.3);
    ctx.lineTo(cx - 0.12, cy - 0.14);
    ctx.lineTo(cx - 0.14, cy - 0.04);
    ctx.lineTo(cx - 0.04, cy + guardY);
    ctx.closePath();
    sf(ctx, "#991111", "#dd3333", 0.07);
    ctx.beginPath();
    ctx.moveTo(cx + 0.06, cy - 0.28);
    ctx.lineTo(cx - 0.02, cy - 0.22);
    ctx.lineTo(cx - 0.1, cy - 0.3);
    sf(ctx, "#ff5555", null, 0.04);
});

registerTag("atk_large", "공격 대형", (ctx, cx, cy) => {
    const hw = 0.2;
    const hh = 0.42;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + hh);
    ctx.lineTo(cx - hw * 0.3, cy + hh * 0.3);
    ctx.lineTo(cx, cy - hh);
    ctx.lineTo(cx + hw * 0.3, cy + hh * 0.3);
    ctx.lineTo(cx + hw, cy + hh);
    ctx.closePath();
    sf(ctx, "#991111", "#dd3333", 0.07);
    const guardW = 0.26;
    ctx.fillStyle = "#bb2222";
    ctx.fillRect(cx - guardW, cy + hh * 0.5, guardW * 2, 0.06);
    const gripR = 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy + hh * 0.72, gripR, 0, Math.PI * 2);
    ctx.fillStyle = "#991111";
    ctx.fill();
    ctx.strokeStyle = "#661111";
    ctx.lineWidth = 0.04;
    ctx.stroke();
});

registerTag("hp_small", "HP 소형", (ctx, cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.4);
    ctx.lineTo(cx + 0.1, cy - 0.18);
    ctx.lineTo(cx + 0.18, cy - 0.02);
    ctx.lineTo(cx + 0.12, cy + 0.15);
    ctx.lineTo(cx + 0.04, cy + 0.28);
    ctx.lineTo(cx - 0.06, cy + 0.26);
    ctx.lineTo(cx - 0.16, cy + 0.1);
    ctx.lineTo(cx - 0.14, cy - 0.04);
    ctx.lineTo(cx - 0.08, cy - 0.2);
    ctx.closePath();
    sf(ctx, "#117733", "#33cc55", 0.07);
    ctx.beginPath();
    ctx.moveTo(cx - 0.04, cy - 0.35);
    ctx.lineTo(cx + 0.04, cy - 0.05);
    ctx.lineTo(cx - 0.06, cy + 0.2);
    sf(ctx, "#117733", null, 0.04);
});

registerTag("hp_large", "HP 대형", (ctx, cx, cy) => {
    const r = 0.4;
    drawPolygon(ctx, cx, cy, r, 6, Math.PI / 6);
    sf(ctx, "#117733", "#33cc55", 0.07);
    drawPolygon(ctx, cx, cy, r * 0.55, 6, 0);
    sf(ctx, "#117733", null, 0.04);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy);
    ctx.lineTo(cx + r * 0.4, cy);
    ctx.moveTo(cx, cy - r * 0.4);
    ctx.lineTo(cx, cy + r * 0.4);
    sf(ctx, "#117733", null, 0.035);
});

registerTag("def_small", "방어 소형", (ctx, cx, cy) => {
    const r = 0.38;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    sf(ctx, "#445566", "#778899", 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    sf(ctx, "#445566", null, 0.045);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.55);
    ctx.lineTo(cx, cy + r * 0.55);
    ctx.moveTo(cx - r * 0.55, cy);
    ctx.lineTo(cx + r * 0.55, cy);
    sf(ctx, "#445566", null, 0.035);
});

registerTag("def_large", "방어 대형", (ctx, cx, cy) => {
    const w = 0.4;
    const h = 0.46;
    ctx.beginPath();
    ctx.roundRect(cx - w, cy - h, w * 2, h * 2, 0.06);
    sf(ctx, "#445566", "#778899", 0.07);
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.65, cy - h * 0.6, w * 1.3, h * 1.2, 0.04);
    sf(ctx, "#445566", null, 0.045);
    ctx.fillStyle = "#556677";
    ctx.fillRect(cx - w * 0.2, cy - h * 1.0, w * 0.4, h * 0.2);
});

registerTag("spd_small", "속도 소형", (ctx, cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx + 0.04, cy - 0.42);
    ctx.quadraticCurveTo(cx + 0.24, cy - 0.16, cx + 0.18, cy + 0.08);
    ctx.quadraticCurveTo(cx + 0.1, cy + 0.24, cx + 0.04, cy + 0.32);
    ctx.lineTo(cx - 0.08, cy + 0.22);
    ctx.quadraticCurveTo(cx - 0.16, cy + 0.06, cx - 0.1, cy - 0.12);
    ctx.quadraticCurveTo(cx - 0.06, cy - 0.3, cx + 0.04, cy - 0.42);
    ctx.closePath();
    sf(ctx, "#227799", "#44bbdd", 0.06);
    ctx.beginPath();
    ctx.moveTo(cx + 0.04, cy - 0.4);
    ctx.quadraticCurveTo(cx + 0.08, cy - 0.1, cx + 0.06, cy + 0.3);
    sf(ctx, "#227799", null, 0.04);
    ctx.beginPath();
    ctx.moveTo(cx - 0.02, cy - 0.04);
    ctx.lineTo(cx + 0.06, cy + 0.04);
    sf(ctx, "#ffffff", null, 0.03);
});

registerTag("spd_large", "속도 대형", (ctx, cx, cy) => {
    const R = 0.4;
    for (let i = 0; i < 3; i++) {
        const angle = ((Math.PI * 2) / 3) * i - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(
            cx + Math.cos(angle) * R * 0.45,
            cy + Math.sin(angle) * R * 0.45,
            0.07,
            R * 0.35,
            angle + Math.PI / 2,
            0,
            Math.PI * 2
        );
        sf(ctx, "#227799", "#44bbdd", 0.05);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 0.1, 0, Math.PI * 2);
    sf(ctx, "#227799", "#66ccee", 0.06);
});

registerTag("skill_small", "스킬 가속 소형", (ctx, cx, cy) => {
    const r = 0.35;
    const toothCount = 6;
    const toothDepth = 0.08;
    ctx.beginPath();
    for (let i = 0; i < toothCount; i++) {
        const a = ((Math.PI * 2) / toothCount) * i - Math.PI / 6;
        const a2 = a + Math.PI / toothCount;
        const outerR = r + toothDepth;
        const innerR2 = r;
        const x1 = cx + outerR * Math.cos(a);
        const y1 = cy + outerR * Math.sin(a);
        const x2 = cx + innerR2 * Math.cos(a2);
        const y2 = cy + innerR2 * Math.sin(a2);
        if (i === 0) ctx.moveTo(x1, y1);
        else ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    sf(ctx, "#662288", "#9944bb", 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, 0.08, 0, Math.PI * 2);
    sf(ctx, "#662288", null, 0.045);
});

registerTag("skill_large", "스킬 가속 대형", (ctx, cx, cy) => {
    const r = 0.4;
    const toothCount = 10;
    const toothDepth = 0.07;
    ctx.beginPath();
    for (let i = 0; i < toothCount; i++) {
        const a = ((Math.PI * 2) / toothCount) * i - Math.PI / toothCount;
        const a2 = a + Math.PI / toothCount;
        const outerR = r + toothDepth;
        const innerR2 = r;
        const x1 = cx + outerR * Math.cos(a);
        const y1 = cy + outerR * Math.sin(a);
        const x2 = cx + innerR2 * Math.cos(a2);
        const y2 = cy + innerR2 * Math.sin(a2);
        if (i === 0) ctx.moveTo(x1, y1);
        else ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    sf(ctx, "#662288", "#9944bb", 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    sf(ctx, "#662288", null, 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
    sf(ctx, "#662288", "#bb66dd", 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx + r * 0.5, cy);
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.lineTo(cx, cy + r * 0.5);
    sf(ctx, "#662288", null, 0.03);
});

registerTag("crit_small", "치명타 소형", (ctx, cx, cy) => {
    const r = 0.36;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    sf(ctx, "#886622", "#ddb833", 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
    sf(ctx, "#886622", null, 0.045);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy);
    ctx.lineTo(cx + r * 0.7, cy);
    ctx.moveTo(cx, cy - r * 0.7);
    ctx.lineTo(cx, cy + r * 0.7);
    sf(ctx, "#886622", null, 0.035);
});

registerTag("crit_large", "치명타 대형", (ctx, cx, cy) => {
    const r = 0.42;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    sf(ctx, "#886622", "#ddb833", 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    sf(ctx, "#886622", null, 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.88, cy);
    ctx.lineTo(cx + r * 0.88, cy);
    ctx.moveTo(cx, cy - r * 0.88);
    ctx.lineTo(cx, cy + r * 0.88);
    sf(ctx, "#886622", null, 0.035);
    ctx.beginPath();
    const sr = 0.18;
    for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.35) * sr * 0.3, cy + Math.sin(a - 0.35) * sr * 0.3);
        ctx.lineTo(cx + Math.cos(a) * sr, cy + Math.sin(a) * sr);
        ctx.lineTo(cx + Math.cos(a + 0.35) * sr * 0.3, cy + Math.sin(a + 0.35) * sr * 0.3);
        ctx.closePath();
    }
    sf(ctx, "#ffdd55", "#ffdd55", 0.025);
    ctx.beginPath();
    ctx.arc(cx, cy, 0.03, 0, Math.PI * 2);
    sf(ctx, "#886622", "#ffdd55", 0.025);
});

registerTag("mass", "질량", (ctx, cx, cy) => {
    const hw = 0.28;
    const hh = 0.3;
    ctx.beginPath();
    ctx.roundRect(cx - hw, cy - hh * 0.4, hw * 2, hh * 1.4, 0.04);
    sf(ctx, "#664422", "#aa7744", 0.07);
    const arcR = 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy - hh * 0.55, arcR, Math.PI * 1.1, Math.PI * 1.9);
    sf(ctx, "#664422", null, 0.06);
    ctx.beginPath();
    ctx.roundRect(cx - 0.06, cy + hh * 0.75, 0.12, 0.1, 0.02);
    sf(ctx, "#553311", "#885533", 0.04);
});

registerTag("wallBounce", "벽 반사 속도", (ctx, cx, cy) => {
    const halfW = 0.1;
    const halfH = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy - halfH);
    ctx.lineTo(cx + halfW, cy - halfH);
    sf(ctx, "#117777", null, 0.07);
    const segments = [
        [cx + halfW, cy - halfH],
        [cx - halfW, cy - halfH * 0.6],
        [cx + halfW, cy - halfH * 0.25],
        [cx - halfW, cy + halfH * 0.1],
        [cx + halfW, cy + halfH * 0.45],
        [cx - halfW, cy + halfH * 0.75],
        [cx + halfW, cy + halfH]
    ];
    ctx.beginPath();
    ctx.moveTo(cx + halfW, cy - halfH);
    for (let i = 1; i < segments.length; i++) {
        ctx.lineTo(segments[i][0], segments[i][1]);
    }
    sf(ctx, "#117777", "#44cccc", 0.07);
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy + halfH);
    ctx.lineTo(cx + halfW, cy + halfH);
    sf(ctx, "#117777", null, 0.07);
});

registerTag("crash", "충돌", (ctx, cx, cy) => {
    const R = 0.38;
    const tilt = 0.35;
    for (let ring = 0; ring < 2; ring++) {
        const sign = ring === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(cx + sign * tilt * 0.08, cy - sign * tilt * 0.05, R, R * 0.55, sign * 0.25, 0, Math.PI * 2);
        sf(ctx, "#994422", "#dd7733", 0.06);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 0.08, 0, Math.PI * 2);
    sf(ctx, "#994422", "#ff9944", 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.5, cy + R * 0.25);
    ctx.lineTo(cx + R * 0.5, cy - R * 0.25);
    sf(ctx, "#994422", null, 0.04);
});

export function getRegisteredTags() {
    return Array.from(TAG_REGISTRY.keys()).filter((id) => id !== "unknown");
}

export function getTagLabel(id) {
    return resolveTag(id).label;
}

export function resolveTagDraw(id) {
    return resolveTag(id).draw;
}

export function getRegisteredTagMetadata() {
    return Array.from(TAG_REGISTRY.entries())
        .filter(([id]) => id !== "unknown")
        .map(([id, { label }]) => ({ id, label }));
}

export function getUnknownTagMetadata() {
    const entry = TAG_REGISTRY.get("unknown");
    return { id: "unknown", label: entry ? entry.label : "알 수 없음" };
}

export function renderIconTag(canvas, tagId, { pixelRatio: injectedPixelRatio } = {}) {
    if (!canvas) return false;
    const context = canvas.getContext?.("2d");
    if (!context) return false;

    const { width, height } = getCanvasDisplaySize(canvas);
    const pixelRatio = Math.min(MAXIMUM_PIXEL_RATIO, injectedPixelRatio ?? (globalThis.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const entry = resolveTag(tagId);
    if (!entry) return false;

    const norm = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;

    context.save();
    context.translate(cx, cy);
    context.scale(norm, norm);
    context.translate(-cx, -cy);
    entry.draw(context, cx, cy);
    context.restore();
    return true;
}

export class EquipmentIconTagController {
    constructor(
        canvas,
        {
            ResizeObserverClass = globalThis.ResizeObserver,
            requestFrame = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((callback) => callback())
        } = {}
    ) {
        this.canvas = canvas;
        this.tagId = null;
        this.requestFrame = requestFrame;
        this.renderPending = false;
        this.resizeObserver = ResizeObserverClass ? new ResizeObserverClass(() => this.scheduleRender()) : null;
        this.resizeObserver?.observe(canvas);
    }

    setTag(tagId) {
        this.tagId = tagId;
        this.scheduleRender();
    }

    scheduleRender() {
        if (this.renderPending) return;
        this.renderPending = true;
        this.requestFrame(() => {
            this.renderPending = false;
            renderIconTag(this.canvas, this.tagId);
        });
    }

    destroy() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.canvas = null;
    }
}

export function registerEquipmentIconTagDirective(Alpine) {
    Alpine.directive("equipment-icon-tag", (canvas, { expression }, { evaluateLater, effect, cleanup }) => {
        const controller = new EquipmentIconTagController(canvas);
        const evaluateTag = evaluateLater(expression);
        effect(() =>
            evaluateTag((value) => {
                controller.setTag(value);
            })
        );
        cleanup(() => controller.destroy());
    });
}
