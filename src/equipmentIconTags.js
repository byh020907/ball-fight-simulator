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
    Array.from({ length: sides }, (_, i) => {
        const px = cx + r * Math.cos(angle + step * i);
        const py = cy + r * Math.sin(angle + step * i);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.closePath();
}

function drawOpenPath(ctx, points, stroke, lw) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
    sf(ctx, stroke, null, lw);
}

function drawClosedPath(ctx, points, stroke, fill, lw) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    sf(ctx, stroke, fill, lw);
}

function rotatePoints(points, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map((p) => [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos]);
}

function drawSingleDagger(ctx, cx, cy, S, angle, bladeColor, guardFill, guardStroke, gripFill, gripStroke) {
    const blade = rotatePoints(
        [
            [0, -S * 5.0],
            [-S * 1.2, -S * 0.5],
            [S * 1.2, -S * 0.5]
        ],
        angle
    );
    drawClosedPath(
        ctx,
        blade.map((p) => [cx + p[0], cy + p[1]]),
        bladeColor,
        bladeColor,
        0.04
    );
    const guard = rotatePoints(
        [
            [-S * 1.8, -S * 0.2],
            [S * 1.8, -S * 0.2],
            [S * 1.8, S * 0.25],
            [-S * 1.8, S * 0.25]
        ],
        angle
    );
    drawClosedPath(
        ctx,
        guard.map((p) => [cx + p[0], cy + p[1]]),
        guardStroke,
        guardFill,
        0.03
    );
    const gripPoints = rotatePoints(
        [
            [-S * 0.5, S * 0.35],
            [S * 0.5, S * 0.35],
            [S * 0.5, S * 2.5],
            [-S * 0.5, S * 2.5]
        ],
        angle
    );
    drawClosedPath(
        ctx,
        gripPoints.map((p) => [cx + p[0], cy + p[1]]),
        gripStroke,
        gripFill,
        0.03
    );
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

registerTag("attack_sword", "공격 · 금 간 장검", (ctx, cx, cy) => {
    const S = 0.06;
    const pBlade = [
        [cx + S * 0.5, cy + S * 1.2],
        [cx + S * 4.8, cy - S * 4.0],
        [cx + S * 3.2, cy - S * 5.6],
        [cx - S * 2.2, cy - S * 0.8],
        [cx - S * 0.5, cy + S * 0.8]
    ];
    drawClosedPath(ctx, pBlade, "#333344", "#c0c4d0", 0.06);

    drawOpenPath(
        ctx,
        [
            [cx + S * 2.2, cy - S * 2.2],
            [cx + S * 1.4, cy - S * 1.6],
            [cx + S * 2.4, cy - S * 0.8]
        ],
        "#222222",
        0.04
    );

    ctx.beginPath();
    ctx.rect(cx - S * 2.8, cy + S * 1.0, S * 5.6, S * 1.0);
    sf(ctx, "#5a4a2a", "#8a7a5a", 0.03);

    ctx.beginPath();
    ctx.rect(cx - S * 1.0, cy + S * 2.0, S * 2.0, S * 3.2);
    sf(ctx, "#4a2a1a", "#7a5a3a", 0.03);
});

registerTag("attack_greatsword", "높은 공격 · 무거운 대검", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx, cy - S * 7.0],
            [cx + S * 4.5, cy - S * 4.5],
            [cx + S * 3.5, cy - S * 2.5],
            [cx + S * 2.0, cy + S * 0.5],
            [cx - S * 2.5, cy + S * 0.5],
            [cx - S * 4.0, cy - S * 4.5]
        ],
        "#444466",
        "#a0a4bc",
        0.06
    );
    ctx.beginPath();
    ctx.rect(cx - S * 5.0, cy + S * 1.0, S * 10.0, S * 1.2);
    sf(ctx, "#4a3a1a", "#6a5a3a", 0.03);
    ctx.beginPath();
    ctx.rect(cx - S * 1.2, cy + S * 2.2, S * 2.4, S * 4.0);
    sf(ctx, "#4a2a1a", "#7a5a3a", 0.03);
    ctx.fillStyle = "#5a5a7a";
    ctx.beginPath();
    ctx.arc(cx, cy + S * 6.5, S * 2.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a5a";
    ctx.lineWidth = 0.03;
    ctx.stroke();
});

registerTag("health_crystal", "HP · 생명 수정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx, cy - S * 7.0],
            [cx + S * 4.5, cy - S * 2.5],
            [cx + S * 3.0, cy + S * 3.5],
            [cx, cy + S * 6.5],
            [cx - S * 3.0, cy + S * 3.5],
            [cx - S * 4.5, cy - S * 2.5]
        ],
        "#551111",
        "#cc4444",
        0.06
    );

    drawOpenPath(
        ctx,
        [
            [cx, cy - S * 7.0],
            [cx + S * 1.5, cy - S * 2.5],
            [cx, cy + S * 1.5]
        ],
        "#ff6666",
        0.04
    );

    drawOpenPath(
        ctx,
        [
            [cx + S * 4.5, cy - S * 2.5],
            [cx + S * 1.5, cy + S * 1.0]
        ],
        "#881111",
        0.03
    );
});

registerTag("health_belt", "높은 HP · 맥동 허리띠", (ctx, cx, cy) => {
    const S = 0.06;

    const leftBand = [
        [cx + S * -7.0, cy + S * -3.5],
        [cx + S * -4.0, cy + S * -1.8],
        [cx + S * -1.0, cy + S * -0.2],
        [cx + S * -1.0, cy + S * 2.0],
        [cx + S * -4.0, cy + S * 1.6],
        [cx + S * -7.0, cy + S * 1.2]
    ];
    drawClosedPath(ctx, leftBand, "#1a0808", "#4a1818", 0.06);

    const rightBand = [
        [cx + S * 7.0, cy + S * -3.5],
        [cx + S * 4.0, cy + S * -1.8],
        [cx + S * 1.0, cy + S * -0.2],
        [cx + S * 1.0, cy + S * 2.0],
        [cx + S * 4.0, cy + S * 1.6],
        [cx + S * 7.0, cy + S * 1.2]
    ];
    drawClosedPath(ctx, rightBand, "#1a0808", "#4a1818", 0.06);

    const leftBronze = [
        [cx + S * -5.5, cy + S * -2.5],
        [cx + S * -3.0, cy + S * -1.2],
        [cx + S * -1.8, cy + S * -0.1],
        [cx + S * -1.8, cy + S * 1.5],
        [cx + S * -3.5, cy + S * 1.2],
        [cx + S * -5.5, cy + S * 0.6]
    ];
    drawClosedPath(ctx, leftBronze, "#1a0808", "#7a6a3a", 0.05);

    const rightBronze = [
        [cx + S * 5.5, cy + S * -2.5],
        [cx + S * 3.0, cy + S * -1.2],
        [cx + S * 1.8, cy + S * -0.1],
        [cx + S * 1.8, cy + S * 1.5],
        [cx + S * 3.5, cy + S * 1.2],
        [cx + S * 5.5, cy + S * 0.6]
    ];
    drawClosedPath(ctx, rightBronze, "#1a0808", "#7a6a3a", 0.05);

    ctx.beginPath();
    ctx.arc(cx, cy + S * 0.8, S * 2.8, 0, Math.PI * 2);
    sf(ctx, "#1a0808", "#9a8a5a", 0.06);

    ctx.beginPath();
    ctx.arc(cx, cy + S * 0.8, S * 1.6, 0, Math.PI * 2);
    sf(ctx, "#1a0808", "#cc2222", 0.05);

    drawOpenPath(
        ctx,
        [
            [cx + S * -0.8, cy + S * 0.1],
            [cx, cy + S * 0.6],
            [cx + S * 0.8, cy + S * 0.1]
        ],
        "#ff6666",
        0.04
    );
});

registerTag("defense_leather", "방어 · 가죽 갑옷", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 2.0, cy - S * 6.5],
            [cx - S * 5.5, cy - S * 5.0],
            [cx - S * 5.0, cy - S * 1.5],
            [cx - S * 4.5, cy + S * 4.0],
            [cx, cy + S * 6.0],
            [cx + S * 4.5, cy + S * 4.0],
            [cx + S * 5.0, cy - S * 1.5],
            [cx + S * 5.5, cy - S * 5.0],
            [cx + S * 2.0, cy - S * 6.5],
            [cx, cy - S * 5.0]
        ],
        "#664422",
        "#ccaa77",
        0.06
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 2.0, cy - S * 6.5],
            [cx, cy - S * 5.0],
            [cx + S * 2.0, cy - S * 6.5]
        ],
        "#443311",
        0.035
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 3.5, cy - S * 2.0],
            [cx + S * 3.5, cy - S * 2.0]
        ],
        "#886633",
        0.03
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 3.0, cy + S * 1.0],
            [cx + S * 3.0, cy + S * 1.0]
        ],
        "#886633",
        0.03
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 2.5, cy + S * 3.5],
            [cx + S * 2.5, cy + S * 3.5]
        ],
        "#886633",
        0.03
    );
});

registerTag("defense_chain", "높은 방어 · 쇠사슬 조끼", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 2.0, cy - S * 6.5],
            [cx - S * 5.5, cy - S * 4.5],
            [cx - S * 5.0, cy - S * 0.5],
            [cx - S * 4.0, cy + S * 5.0],
            [cx, cy + S * 6.0],
            [cx + S * 4.0, cy + S * 5.0],
            [cx + S * 5.0, cy - S * 0.5],
            [cx + S * 5.5, cy - S * 4.5],
            [cx + S * 2.0, cy - S * 6.5],
            [cx, cy - S * 4.5]
        ],
        "#3a4a6a",
        "#6a7a9a",
        0.05
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 2.0, cy - S * 6.5],
            [cx, cy - S * 4.5],
            [cx + S * 2.0, cy - S * 6.5]
        ],
        "#2a3a5a",
        0.035
    );
    const links = [
        [cx - S * 2.5, cy - S * 2.5],
        [cx + S * 2.5, cy - S * 2.5],
        [cx - S * 3.0, cy + S * 0.5],
        [cx, cy + S * 0.5],
        [cx + S * 3.0, cy + S * 0.5],
        [cx - S * 2.5, cy + S * 3.5],
        [cx + S * 2.5, cy + S * 3.5]
    ];
    links.forEach(([lx, ly]) => {
        ctx.beginPath();
        ctx.arc(lx, ly, S * 1.5, 0, Math.PI * 1.0);
        sf(ctx, "#4a5a7a", null, 0.035);
        ctx.beginPath();
        ctx.arc(lx, ly + S * 0.3, S * 1.3, Math.PI * 1.0, Math.PI * 2.0);
        sf(ctx, "#5a6a8a", null, 0.035);
    });
});

registerTag("speed_boots", "속도 · 가벼운 장화", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 1.5, cy - S * 7.0],
            [cx + S * 4.5, cy - S * 7.0],
            [cx + S * 5.0, cy - S * 3.0],
            [cx + S * 5.5, cy + S * 1.0],
            [cx + S * 7.0, cy + S * 3.5],
            [cx + S * 5.5, cy + S * 5.5],
            [cx - S * 3.5, cy + S * 6.5],
            [cx - S * 5.0, cy + S * 4.5],
            [cx - S * 4.0, cy + S * 1.0],
            [cx - S * 3.0, cy - S * 2.5]
        ],
        "#333333",
        "#5a5a5a",
        0.05
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 1.5, cy - S * 7.0],
            [cx + S * 4.5, cy - S * 7.0]
        ],
        "#aaaaaa",
        0.035
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 3.5, cy + S * 6.5],
            [cx + S * 5.5, cy + S * 5.5]
        ],
        "#333333",
        0.06
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 4.0, cy - S * 0.5],
            [cx + S * 4.0, cy - S * 0.5]
        ],
        "#777777",
        0.025
    );
});

registerTag("speed_wing", "높은 속도 · 날개깃", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx, cy - S * 6.0],
            [cx - S * 3.0, cy - S * 4.5],
            [cx - S * 6.5, cy - S * 1.5],
            [cx - S * 7.0, cy + S * 1.0],
            [cx - S * 5.5, cy + S * 2.0],
            [cx - S * 6.0, cy + S * 4.5],
            [cx - S * 4.0, cy + S * 5.5],
            [cx - S * 4.5, cy + S * 7.0],
            [cx - S * 2.0, cy + S * 6.0],
            [cx, cy + S * 3.0]
        ],
        "#555577",
        "#cccdde",
        0.05
    );

    drawOpenPath(
        ctx,
        [
            [cx, cy - S * 6.0],
            [cx - S * 3.5, cy - S * 2.0],
            [cx - S * 5.5, cy + S * 2.0]
        ],
        "#777799",
        0.03
    );

    drawOpenPath(
        ctx,
        [
            [cx, cy - S * 6.0],
            [cx - S * 4.0, cy + S * 0.0],
            [cx - S * 4.5, cy + S * 4.5]
        ],
        "#777799",
        0.03
    );

    drawOpenPath(
        ctx,
        [
            [cx, cy - S * 6.0],
            [cx - S * 2.5, cy + S * 2.0],
            [cx - S * 2.5, cy + S * 6.0]
        ],
        "#777799",
        0.03
    );
});

registerTag("haste_mote", "스킬 가속 · 마력 구슬", (ctx, cx, cy) => {
    const S = 0.06;
    const ringR = S * 6.0;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    sf(ctx, "#444444", null, 0.06);

    ctx.clearRect(cx - ringR * 0.7, cy - ringR * 1.2, ringR * 1.4, ringR * 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy - S * 0.5, ringR * 0.85, 0, Math.PI * 2);
    sf(ctx, "#444444", null, 0.06);

    ctx.beginPath();
    ctx.arc(cx + S * 0.5, cy, S * 4.5, 0, Math.PI * 2);
    sf(ctx, "#551177", "#aa44dd", 0.06);

    ctx.beginPath();
    ctx.arc(cx + S * 1.0, cy - S * 0.5, S * 2.0, 0, Math.PI * 2);
    sf(ctx, "#7733aa", "#dd77ff", 0.04);
});

registerTag("haste_kindlegem", "높은 스킬 가속 · 점화석", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx, cy - S * 7.0],
            [cx + S * 5.5, cy - S * 3.0],
            [cx + S * 4.0, cy + S * 4.0],
            [cx, cy + S * 6.5],
            [cx - S * 4.0, cy + S * 4.0],
            [cx - S * 5.5, cy - S * 3.0]
        ],
        "#662211",
        "#dd6633",
        0.06
    );

    const spiral = Array.from({ length: 24 }, (_, i) => {
        const t = i / 24;
        const angle = t * Math.PI * 4;
        const rad = S * 4.0 * (1 - t * 0.5);
        const px = cx + Math.cos(angle) * rad * 0.5;
        const py = cy - Math.sin(angle) * rad * 0.3 + S * 1.0;
        return [px, py];
    });
    ctx.beginPath();
    drawOpenPath(ctx, spiral, "#ffcc55", 0.04);

    ctx.beginPath();
    ctx.arc(cx + S * 0.5, cy - S * 0.5, S * 1.5, 0, Math.PI * 2);
    sf(ctx, "#cc5511", "#ff8844", 0.035);
});

registerTag("crit_cloak", "치명타 · 행운 망토", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 2.0, cy - S * 6.0],
            [cx + S * 2.0, cy - S * 6.0],
            [cx + S * 5.0, cy + S * 1.0],
            [cx + S * 6.5, cy + S * 4.0],
            [cx + S * 5.5, cy + S * 7.0],
            [cx + S * 4.0, cy + S * 6.5],
            [cx + S * 2.5, cy + S * 4.5],
            [cx, cy + S * 5.5],
            [cx - S * 2.5, cy + S * 4.5],
            [cx - S * 4.0, cy + S * 6.5],
            [cx - S * 5.5, cy + S * 7.0],
            [cx - S * 6.5, cy + S * 4.0],
            [cx - S * 5.0, cy + S * 1.0]
        ],
        "#442266",
        "#8844aa",
        0.06
    );

    ctx.fillStyle = "#bb9944";
    ctx.beginPath();
    ctx.arc(cx, cy - S * 5.5, S * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#886622";
    ctx.lineWidth = 0.03;
    ctx.stroke();

    drawOpenPath(
        ctx,
        [
            [cx - S * 1.5, cy - S * 4.0],
            [cx - S * 2.5, cy + S * 1.0],
            [cx, cy + S * 0.5]
        ],
        "#663388",
        0.03
    );

    drawOpenPath(
        ctx,
        [
            [cx + S * 1.5, cy - S * 4.0],
            [cx + S * 2.5, cy + S * 1.0],
            [cx, cy + S * 0.5]
        ],
        "#663388",
        0.03
    );
});

registerTag("crit_twin_blades", "높은 치명타 · 쌍날 부적", (ctx, cx, cy) => {
    const S = 0.06;
    const a1 = -0.55;
    const a2 = 0.55;
    drawSingleDagger(ctx, cx, cy, S, a1, "#886611", "#886611", "#664400", "#aa8833", "#553300");
    drawSingleDagger(ctx, cx, cy, S, a2, "#886611", "#886611", "#664400", "#aa8833", "#553300");
    ctx.fillStyle = "#cc3333";
    ctx.beginPath();
    ctx.arc(cx, cy - S * 1.0, S * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#881111";
    ctx.lineWidth = 0.035;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - S * 1.0, S * 0.6, 0, Math.PI * 2);
    sf(ctx, "#ffcc44", "#ffcc44", 0.025);
});

registerTag("mass_weight", "질량 · 무쇠 추", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 3.0, cy - S * 2.0],
            [cx - S * 2.5, cy - S * 6.5],
            [cx, cy - S * 7.5],
            [cx + S * 2.5, cy - S * 6.5],
            [cx + S * 3.0, cy - S * 2.0],
            [cx + S * 3.0, cy - S * 2.0]
        ],
        "#333333",
        "#555555",
        0.05
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 4.5, cy - S * 2.0],
            [cx + S * 4.5, cy - S * 2.0],
            [cx + S * 5.0, cy + S * 6.0],
            [cx - S * 5.0, cy + S * 6.0]
        ],
        "#333333",
        "#5a5a5a",
        0.05
    );
    ctx.beginPath();
    ctx.rect(cx - S * 3.5, cy - S * 1.5, S * 1.5, S * 6.5);
    sf(ctx, "#555555", "#777777", 0.025);
});

registerTag("wall_spring", "벽 반사 속도 · 압축 스프링", (ctx, cx, cy) => {
    const S = 0.06;
    ctx.beginPath();
    ctx.rect(cx - S * 6.0, cy - S * 7.5, S * 12.0, S * 2.0);
    sf(ctx, "#444444", "#777777", 0.04);

    ctx.beginPath();
    ctx.rect(cx - S * 6.0, cy + S * 5.5, S * 12.0, S * 2.0);
    sf(ctx, "#444444", "#777777", 0.04);

    const coils = Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        const x = cx - S * 5.0 + t * S * 10.0;
        const y = i % 2 === 0 ? cy - S * 4.5 : cy + S * 4.5;
        return [x, y];
    });
    drawOpenPath(ctx, coils, "#338888", 0.06);

    coils.slice(0, -1).forEach((_, i) => {
        const xm = (coils[i][0] + coils[i + 1][0]) / 2;
        const ym = (coils[i][1] + coils[i + 1][1]) / 2;
        ctx.beginPath();
        ctx.arc(xm, ym, S * 1.2, 0, Math.PI * 2);
        sf(ctx, "#226666", "#44aaaa", 0.035);
    });
});

registerTag("collision_gyro", "충돌 · 충격 자이로", (ctx, cx, cy) => {
    const S = 0.06;
    const ringR = S * 5.5;
    [1, -1].forEach((sign) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, ringR, ringR * 0.5, sign * 0.5, 0, Math.PI * 2);
        sf(ctx, "#cc6622", null, 0.055);
    });
    drawClosedPath(
        ctx,
        [
            [cx, cy - S * 3.5],
            [cx + S * 3.0, cy - S * 0.5],
            [cx + S * 2.0, cy + S * 1.5],
            [cx, cy + S * 2.5],
            [cx - S * 2.0, cy + S * 1.5],
            [cx - S * 3.0, cy - S * 0.5]
        ],
        "#333333",
        "#555555",
        0.045
    );
    ctx.fillStyle = "#ff8833";
    ctx.beginPath();
    ctx.arc(cx, cy - S * 0.5, S * 1.2, 0, Math.PI * 2);
    ctx.fill();
    [1, -1].forEach((pinSign) => {
        ctx.fillStyle = "#444444";
        ctx.beginPath();
        ctx.arc(cx + pinSign * S * 5.5, cy - pinSign * S * 1.5, S * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 0.03;
        ctx.stroke();
    });
    drawClosedPath(
        ctx,
        [
            [cx + S * 5.0, cy - S * 3.0],
            [cx + S * 7.5, cy - S * 5.0],
            [cx + S * 6.5, cy - S * 2.5],
            [cx + S * 7.5, cy]
        ],
        "#cc6622",
        "#ff8833",
        0.04
    );
});

registerTag("intermediate_attack_crit", "중간 · 공격·치명타 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 4.8, cy + S * 4.8],
            [cx - S * 1.6, cy - S * 5.8],
            [cx + S * 3.5, cy - S * 2.4],
            [cx + S * 1.1, cy + S * 5.4]
        ],
        "#272039",
        "#c1c7d5",
        0.06
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 2.2, cy - S * 1.3],
            [cx - S * 0.7, cy - S * 0.1],
            [cx - S * 1.7, cy + S * 1.6]
        ],
        "#555b6d",
        0.035
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 5.7, cy + S * 2.1],
            [cx + S * 3.1, cy + S * 5.0],
            [cx + S * 3.7, cy + S * 6.9],
            [cx - S * 5.1, cy + S * 4.0]
        ],
        "#3c2359",
        "#76509d",
        0.05
    );
    [-3.4, -0.4, 2.5].forEach((x) => {
        ctx.beginPath();
        ctx.arc(cx + S * x, cy + S * 4.1, S * 0.8, 0, Math.PI * 2);
        sf(ctx, "#24202d", "#c3a64a", 0.03);
    });
    drawClosedPath(
        ctx,
        [
            [cx + S * 2.3, cy + S * 2.4],
            [cx + S * 4.7, cy + S * 4.6],
            [cx + S * 3.5, cy + S * 6.7],
            [cx + S * 1.3, cy + S * 4.4]
        ],
        "#342344",
        "#a843b2",
        0.04
    );
});

registerTag("intermediate_attack_haste", "중간 · 공격·스킬 가속 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 5.8, cy + S * 2.0],
            [cx + S * 5.7, cy - S * 6.2],
            [cx + S * 4.4, cy - S * 1.3],
            [cx - S * 3.4, cy + S * 5.0]
        ],
        "#2d3040",
        "#9ca7ba",
        0.065
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 3.8, cy + S * 1.4],
            [cx + S * 3.4, cy - S * 3.8]
        ],
        "#596274",
        0.04
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 4.4, cy + S * 3.3],
            [cx - S * 1.9, cy + S * 5.8],
            [cx - S * 3.6, cy + S * 7.0],
            [cx - S * 6.0, cy + S * 4.5]
        ],
        "#2a1b22",
        "#70435d",
        0.05
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 4.8, cy + S * 2.2],
            [cx - S * 1.6, cy + S * 5.7]
        ],
        "#d0af51",
        0.07
    );
    ctx.beginPath();
    ctx.arc(cx - S * 1.9, cy + S * 3.9, S * 1.7, 0, Math.PI * 2);
    sf(ctx, "#382054", "#bb63df", 0.045);
    ctx.beginPath();
    ctx.arc(cx - S * 1.9, cy + S * 3.9, S * 0.65, 0, Math.PI * 2);
    sf(ctx, "#6d3693", "#e19aff", 0.025);
});

registerTag("intermediate_attack_speed", "중간 · 공격·속도 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 3.8, cy + S * 5.8],
            [cx - S * 1.6, cy - S * 6.2],
            [cx + S * 2.3, cy - S * 2.5],
            [cx + S * 0.9, cy + S * 5.4]
        ],
        "#283041",
        "#bdc8d4",
        0.055
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 0.9, cy + S * 0.3],
            [cx + S * 2.6, cy + S * 0.9],
            [cx + S * 6.4, cy + S * 5.8],
            [cx + S * 1.2, cy + S * 4.3]
        ],
        "#4b3d5c",
        "#d2d6df",
        0.05
    );
    drawOpenPath(
        ctx,
        [
            [cx + S * 1.0, cy + S * 1.3],
            [cx + S * 5.1, cy + S * 5.0]
        ],
        "#777f97",
        0.03
    );
    [1.5, 4.0].forEach((x, i) => {
        ctx.beginPath();
        ctx.arc(cx + S * x, cy + S * (2.0 + i * 2.1), S * 0.75, 0, Math.PI * 2);
        sf(ctx, "#34313e", "#c69b40", 0.025);
    });
    drawClosedPath(
        ctx,
        [
            [cx - S * 4.7, cy + S * 3.7],
            [cx - S * 1.5, cy + S * 4.0],
            [cx - S * 1.8, cy + S * 5.8],
            [cx - S * 5.2, cy + S * 5.3]
        ],
        "#2a2432",
        "#67504a",
        0.04
    );
});

registerTag("intermediate_attack_health", "중간 · 공격·HP · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 6.8, cy + S * 2.8],
            [cx + S * 4.8, cy - S * 5.0],
            [cx + S * 6.4, cy - S * 2.4],
            [cx - S * 4.2, cy + S * 5.5]
        ],
        "#34313a",
        "#a7afbb",
        0.06
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 3.5, cy + S * 2.0],
            [cx + S * 3.7, cy - S * 2.7]
        ],
        "#575d6b",
        0.04
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 6.8, cy + S * 1.3],
            [cx - S * 3.7, cy + S * 4.5],
            [cx - S * 5.2, cy + S * 6.3],
            [cx - S * 7.5, cy + S * 3.8]
        ],
        "#422d25",
        "#795343",
        0.05
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 0.8, cy - S * 3.3],
            [cx + S * 1.7, cy - S * 3.0],
            [cx + S * 2.2, cy - S * 0.3],
            [cx - S * 0.3, cy + S * 0.1]
        ],
        "#60402a",
        "#b9915d",
        0.045
    );
    drawClosedPath(
        ctx,
        [
            [cx + S * 0.4, cy - S * 3.1],
            [cx + S * 2.0, cy - S * 1.5],
            [cx + S * 0.4, cy + S * 0.1],
            [cx - S * 1.1, cy - S * 1.5]
        ],
        "#651b26",
        "#dc4e57",
        0.04
    );
});

registerTag("intermediate_health_defense", "중간 · HP·방어 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 2.1, cy - S * 6.3],
            [cx - S * 5.6, cy - S * 4.1],
            [cx - S * 4.2, cy + S * 5.2],
            [cx, cy + S * 6.7],
            [cx + S * 4.2, cy + S * 5.2],
            [cx + S * 5.6, cy - S * 4.1],
            [cx + S * 2.1, cy - S * 6.3]
        ],
        "#4d301e",
        "#b88b58",
        0.06
    );
    drawClosedPath(
        ctx,
        [
            [cx, cy - S * 4.8],
            [cx + S * 2.0, cy - S * 2.2],
            [cx + S * 1.4, cy + S * 2.1],
            [cx, cy + S * 3.6],
            [cx - S * 1.4, cy + S * 2.1],
            [cx - S * 2.0, cy - S * 2.2]
        ],
        "#661c26",
        "#d54853",
        0.045
    );
    [-3.4, 3.4].forEach((x) =>
        drawOpenPath(
            ctx,
            [
                [cx + S * x, cy - S * 2.0],
                [cx + S * (x * 0.75), cy + S * 3.7]
            ],
            "#e0b67b",
            0.035
        )
    );
});

registerTag("intermediate_health_haste", "중간 · HP·스킬 가속 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawOpenPath(
        ctx,
        [
            [cx - S * 6.5, cy - S * 2.2],
            [cx - S * 3.0, cy - S * 3.0],
            [cx, cy - S * 0.8],
            [cx + S * 3.0, cy - S * 3.0],
            [cx + S * 6.5, cy - S * 2.2]
        ],
        "#6b2c32",
        0.15
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 6.5, cy - S * 2.2],
            [cx - S * 3.0, cy - S * 3.0],
            [cx, cy - S * 0.8],
            [cx + S * 3.0, cy - S * 3.0],
            [cx + S * 6.5, cy - S * 2.2]
        ],
        "#9b4544",
        0.09
    );
    ctx.beginPath();
    ctx.arc(cx, cy - S * 0.6, S * 2.3, 0, Math.PI * 2);
    sf(ctx, "#3a1f29", "#d55352", 0.045);
    drawClosedPath(
        ctx,
        [
            [cx + S * 3.0, cy - S * 6.2],
            [cx + S * 5.6, cy - S * 4.5],
            [cx + S * 4.5, cy - S * 1.5],
            [cx + S * 1.9, cy - S * 3.2]
        ],
        "#63341f",
        "#e07535",
        0.045
    );
    [3.2, 4.8].forEach((x) =>
        drawOpenPath(
            ctx,
            [
                [cx + S * x, cy - S * 1.4],
                [cx + S * x, cy + S * 4.8]
            ],
            "#443442",
            0.055
        )
    );
    drawOpenPath(
        ctx,
        [
            [cx + S * 2.4, cy + S * 4.8],
            [cx + S * 3.2, cy + S * 5.8],
            [cx + S * 4.0, cy + S * 4.8],
            [cx + S * 4.8, cy + S * 5.8]
        ],
        "#c56930",
        0.045
    );
});

registerTag("intermediate_defense_wall", "중간 · 방어·벽 반사 속도 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 5.8, cy - S * 5.6],
            [cx + S * 2.5, cy - S * 4.7],
            [cx + S * 4.6, cy + S * 4.8],
            [cx - S * 4.6, cy + S * 6.0]
        ],
        "#4d321e",
        "#b68c5a",
        0.065
    );
    [-2.6, 1.2].forEach((x) => {
        const coil = Array.from({ length: 6 }, (_, i) => [
            cx + S * (x + (i % 2 ? 1.4 : 0)),
            cy - S * 3.0 + S * i * 1.6
        ]);
        drawOpenPath(ctx, coil, "#2f8692", 0.06);
    });
    drawClosedPath(
        ctx,
        [
            [cx - S * 6.7, cy - S * 4.0],
            [cx - S * 4.9, cy - S * 4.0],
            [cx - S * 4.5, cy + S * 5.1],
            [cx - S * 6.2, cy + S * 5.2]
        ],
        "#303b40",
        "#69767a",
        0.04
    );
});

registerTag("intermediate_defense_mass", "중간 · 방어·질량 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 2.0, cy - S * 6.2],
            [cx - S * 5.1, cy - S * 3.5],
            [cx - S * 4.1, cy + S * 5.7],
            [cx, cy + S * 6.6],
            [cx + S * 4.1, cy + S * 5.7],
            [cx + S * 5.1, cy - S * 3.5],
            [cx + S * 2.0, cy - S * 6.2]
        ],
        "#35435b",
        "#7e8da5",
        0.055
    );
    [
        [-2.5, -1.6],
        [2.5, -1.6],
        [-2.2, 2.0],
        [2.2, 2.0]
    ].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(cx + S * x, cy + S * y, S * 1.2, 0, Math.PI * 2);
        sf(ctx, "#35435b", null, 0.035);
    });
    drawClosedPath(
        ctx,
        [
            [cx - S * 3.6, cy - S * 0.7],
            [cx + S * 3.6, cy - S * 0.7],
            [cx + S * 3.2, cy + S * 4.6],
            [cx - S * 3.2, cy + S * 4.6]
        ],
        "#30343c",
        "#6c7078",
        0.045
    );
    ctx.beginPath();
    ctx.arc(cx, cy + S * 1.7, S * 2.5, 0, Math.PI * 2);
    sf(ctx, "#292b31", "#484b50", 0.045);
    [-2.4, 2.4].forEach((x) => {
        ctx.beginPath();
        ctx.arc(cx + S * x, cy + S * 2.0, S * 0.65, 0, Math.PI * 2);
        sf(ctx, "#282a2e", "#b5a65a", 0.025);
    });
});

registerTag("intermediate_speed_wall", "중간 · 속도·벽 반사 속도 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 2.7, cy - S * 6.6],
            [cx + S * 2.7, cy - S * 6.6],
            [cx + S * 3.5, cy + S * 0.7],
            [cx + S * 6.5, cy + S * 3.3],
            [cx + S * 5.0, cy + S * 5.8],
            [cx - S * 4.8, cy + S * 6.2],
            [cx - S * 4.0, cy + S * 1.7]
        ],
        "#30343a",
        "#747980",
        0.06
    );
    const coils = Array.from({ length: 7 }, (_, i) => [cx - S * 2.1 + S * i * 0.75, cy + S * (i % 2 ? -0.5 : 1.8)]);
    drawOpenPath(ctx, coils, "#3ca3a3", 0.07);
    drawOpenPath(
        ctx,
        [
            [cx - S * 3.0, cy - S * 1.0],
            [cx + S * 2.4, cy - S * 1.0]
        ],
        "#a77d4c",
        0.055
    );
    [-2.5, 2.0].forEach((x) => {
        ctx.beginPath();
        ctx.arc(cx + S * x, cy - S * 1.0, S * 0.55, 0, Math.PI * 2);
        sf(ctx, "#342a25", "#d0a958", 0.025);
    });
});

registerTag("intermediate_speed_angular", "중간 · 속도·회전 충격 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.6, cy, S * 5.8, S * 2.4, -0.35, 0.15, Math.PI * 1.85);
    sf(ctx, "#c56b29", null, 0.065);
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.6, cy, S * 4.5, S * 1.8, -0.35, 0.1, Math.PI * 1.9);
    sf(ctx, "#8d4824", null, 0.045);
    drawClosedPath(
        ctx,
        [
            [cx + S * 1.8, cy - S * 5.2],
            [cx + S * 5.6, cy - S * 1.6],
            [cx + S * 3.6, cy + S * 0.1],
            [cx + S * 0.6, cy - S * 2.6]
        ],
        "#5a6275",
        "#d0d6df",
        0.045
    );
    drawOpenPath(
        ctx,
        [
            [cx + S * 1.5, cy - S * 3.4],
            [cx + S * 4.3, cy - S * 1.5]
        ],
        "#7f8799",
        0.03
    );
    ctx.beginPath();
    ctx.arc(cx - S * 0.6, cy, S * 1.4, 0, Math.PI * 2);
    sf(ctx, "#3c3434", "#e37b31", 0.04);
    ctx.beginPath();
    ctx.arc(cx + S * 2.3, cy - S * 1.2, S * 0.65, 0, Math.PI * 2);
    sf(ctx, "#33343d", "#c29e4e", 0.025);
});

registerTag("intermediate_haste_angular", "중간 · 스킬 가속·회전 충격 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    [
        [S * 5.8, S * 2.5, 0.45],
        [S * 4.2, S * 1.7, -0.45]
    ].forEach(([rx, ry, rot]) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rot, 0.2, Math.PI * 1.8);
        sf(ctx, "#a94f29", null, 0.06);
    });
    drawClosedPath(
        ctx,
        [
            [cx - S * 1.7, cy - S * 1.7],
            [cx + S * 1.7, cy - S * 1.7],
            [cx + S * 1.7, cy + S * 1.7],
            [cx - S * 1.7, cy + S * 1.7]
        ],
        "#393b42",
        "#666a73",
        0.04
    );
    drawClosedPath(
        ctx,
        [
            [cx, cy + S * 1.7],
            [cx + S * 2.4, cy + S * 4.8],
            [cx, cy + S * 6.3],
            [cx - S * 2.4, cy + S * 4.8]
        ],
        "#71311e",
        "#df6a2c",
        0.045
    );
    drawOpenPath(
        ctx,
        [
            [cx - S * 4.2, cy + S * 2.6],
            [cx, cy + S * 5.8],
            [cx + S * 4.2, cy + S * 2.6]
        ],
        "#4b4052",
        0.045
    );
});

registerTag("intermediate_crit_mass", "중간 · 치명타·질량 · 명칭 미정", (ctx, cx, cy) => {
    const S = 0.06;
    drawClosedPath(
        ctx,
        [
            [cx - S * 4.6, cy - S * 2.8],
            [cx + S * 3.6, cy - S * 4.2],
            [cx + S * 5.3, cy + S * 1.8],
            [cx - S * 2.8, cy + S * 4.1]
        ],
        "#2d3036",
        "#565961",
        0.06
    );
    drawClosedPath(
        ctx,
        [
            [cx - S * 3.5, cy - S * 1.0],
            [cx - S * 7.2, cy - S * 5.6],
            [cx - S * 5.8, cy + S * 1.7],
            [cx - S * 3.1, cy + S * 2.4]
        ],
        "#74500f",
        "#d5a12e",
        0.05
    );
    drawClosedPath(
        ctx,
        [
            [cx + S * 2.8, cy - S * 1.8],
            [cx + S * 6.7, cy + S * 3.2],
            [cx + S * 4.7, cy + S * 4.5],
            [cx + S * 1.8, cy + S * 1.2]
        ],
        "#74500f",
        "#d5a12e",
        0.05
    );
    [-3.0, 1.7, 4.0].forEach((x, index) => {
        ctx.beginPath();
        ctx.arc(cx + S * x, cy + S * (index === 0 ? 0.1 : -0.2), S * 0.72, 0, Math.PI * 2);
        sf(ctx, "#292a2e", "#c7a142", 0.025);
    });
    ctx.beginPath();
    ctx.arc(cx + S * 4.6, cy + S * 4.5, S * 1.5, 0, Math.PI * 2);
    sf(ctx, "#303038", null, 0.055);
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
