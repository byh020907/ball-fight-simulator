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

registerTag("attack_sword", "공격 · 금 간 장검 (가칭)", (ctx, cx, cy) => {
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

registerTag("attack_greatsword", "높은 공격 · 중대검 (가칭)", (ctx, cx, cy) => {
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

registerTag("health_crystal", "HP · 생명 수정 (가칭)", (ctx, cx, cy) => {
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

registerTag("health_belt", "높은 HP · 거인의 허리띠 (가칭)", (ctx, cx, cy) => {
    const S = 0.06;
    ctx.beginPath();
    ctx.rect(cx - S * 8.0, cy - S * 3.0, S * 16.0, S * 6.0);
    sf(ctx, "#553322", "#885533", 0.05);

    ctx.beginPath();
    ctx.rect(cx - S * 3.5, cy - S * 5.0, S * 7.0, S * 10.0);
    sf(ctx, "#886622", "#bb9944", 0.04);

    ctx.beginPath();
    ctx.rect(cx - S * 1.5, cy - S * 2.5, S * 3.0, S * 5.0);
    sf(ctx, "#881111", "#cc3333", 0.03);
});

registerTag("defense_leather", "방어 · 가죽 갑옷 (가칭)", (ctx, cx, cy) => {
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

registerTag("defense_chain", "높은 방어 · 쇠사슬 조끼 (가칭)", (ctx, cx, cy) => {
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

registerTag("speed_boots", "속도 · 가벼운 장화 (가칭)", (ctx, cx, cy) => {
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

registerTag("speed_wing", "높은 속도 · 날개 장식 (가칭)", (ctx, cx, cy) => {
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

registerTag("haste_mote", "스킬 가속 · 마력 티끌 (가칭)", (ctx, cx, cy) => {
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

registerTag("haste_kindlegem", "높은 스킬 가속 · 점화석 (가칭)", (ctx, cx, cy) => {
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

registerTag("crit_cloak", "치명타 · 명중 망토 (가칭)", (ctx, cx, cy) => {
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

registerTag("crit_twin_blades", "높은 치명타 · 쌍날 부적 (가칭)", (ctx, cx, cy) => {
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

registerTag("mass_weight", "질량 · 무거운 추 (가칭)", (ctx, cx, cy) => {
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

registerTag("wall_spring", "벽 반사 속도 · 압축 스프링 (가칭)", (ctx, cx, cy) => {
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

registerTag("collision_gyro", "충돌 · 충격 자이로 (가칭)", (ctx, cx, cy) => {
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
