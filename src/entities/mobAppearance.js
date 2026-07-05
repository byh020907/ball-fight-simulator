export const BODY_SHAPES = Object.freeze({
    CIRCLE: 0,
    MIN_SIDES: 5,
    MAX_SIDES: 16
});

const FACE_TEMPLATES = Object.freeze({
    default: {
        label: "기본",
        draw(ctx, r) {
            const time = performance.now() / 1000;
            const blink = Math.sin(time * 2.6) > 0.93 ? 0.22 : 1;
            _dotEye(ctx, r, -0.22, -0.08, 0.052, blink);
            _dotEye(ctx, r, 0.22, -0.08, 0.052, blink);
            _arc(ctx, r, 0, 0.16, 0.2, 0.1, Math.PI - 0.1);
        }
    },
    angry: {
        label: "화남",
        draw(ctx, r) {
            _line(ctx, r, [
                [-0.3, -0.12],
                [-0.12, -0.02],
                [0.12, -0.02],
                [0.3, -0.12]
            ]);
            _line(ctx, r, [
                [-0.25, 0.22],
                [-0.1, 0.14],
                [0.1, 0.14],
                [0.25, 0.22]
            ]);
        }
    },
    xeye: {
        label: "X눈",
        draw(ctx, r) {
            const s = 0.08;
            _line(ctx, r, [
                [-0.25 - s, -0.1 - s],
                [-0.25 + s, -0.1 + s]
            ]);
            _line(ctx, r, [
                [-0.25 - s, -0.1 + s],
                [-0.25 + s, -0.1 - s]
            ]);
            _line(ctx, r, [
                [0.25 - s, -0.1 - s],
                [0.25 + s, -0.1 + s]
            ]);
            _line(ctx, r, [
                [0.25 - s, -0.1 + s],
                [0.25 + s, -0.1 - s]
            ]);
            _arc(ctx, r, 0, 0.2, 0.18, 0.15, Math.PI - 0.15);
        }
    },
    ooo: {
        label: "동그라미",
        draw(ctx, r) {
            _dotEye(ctx, r, -0.22, -0.08, 0.065, 1);
            _dotEye(ctx, r, 0.22, -0.08, 0.065, 1);
            _ellipse(ctx, r, 0, 0.18, 0.1, 0.07);
        }
    },
    dash: {
        label: "대시",
        draw(ctx, r) {
            _line(ctx, r, [
                [-0.33, -0.06],
                [-0.1, -0.06]
            ]);
            _line(ctx, r, [
                [0.1, -0.06],
                [0.33, -0.06]
            ]);
            _line(ctx, r, [
                [-0.25, 0.2],
                [0.25, 0.2]
            ]);
        }
    },
    skele: {
        label: "해골",
        draw(ctx, r) {
            _dotEye(ctx, r, -0.2, -0.1, 0.055, 1);
            _dotEye(ctx, r, 0.2, -0.1, 0.055, 1);
            _line(ctx, r, [
                [-0.18, 0.1],
                [-0.1, 0.2],
                [0.1, 0.2],
                [0.18, 0.1]
            ]);
            _line(ctx, r, [
                [0, 0.18],
                [0, 0.28]
            ]);
        }
    },
    cyclops: {
        label: "외눈",
        draw(ctx, r) {
            _ellipse(ctx, r, 0, -0.06, 0.1, 0.12);
            _dotEye(ctx, r, 0, -0.06, 0.04, 1);
            _line(ctx, r, [
                [-0.18, 0.18],
                [0.18, 0.18]
            ]);
        }
    },
    happy: {
        label: "행복",
        draw(ctx, r) {
            _dotEye(ctx, r, -0.22, -0.1, 0.048, 1);
            _dotEye(ctx, r, 0.22, -0.1, 0.048, 1);
            _arc(ctx, r, 0, 0.08, 0.22, 0.2, Math.PI - 0.2);
        }
    }
});

function _dotEye(ctx, r, ex, ey, size, blink) {
    ctx.beginPath();
    ctx.ellipse(ex * r, ey * r, size * r, size * r * blink, 0, 0, Math.PI * 2);
    ctx.fill();
}

function _ellipse(ctx, r, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx * r, cy * r, rx * r, ry * r, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function _arc(ctx, r, cx, cy, radius, start, end) {
    ctx.beginPath();
    ctx.arc(cx * r, cy * r, radius * r, start, end);
    ctx.stroke();
}

function _line(ctx, r, points) {
    ctx.beginPath();
    points.forEach(([px, py], index) => {
        if (index === 0) ctx.moveTo(px * r, py * r);
        else ctx.lineTo(px * r, py * r);
    });
    ctx.stroke();
}

export function getFaceTemplate(name) {
    return FACE_TEMPLATES[name] ?? FACE_TEMPLATES.default;
}

const FACE_NAMES = Object.keys(FACE_TEMPLATES);

export function generateMobAppearance(rng = Math.random) {
    const sides = Math.floor(rng() * (BODY_SHAPES.MAX_SIDES - BODY_SHAPES.MIN_SIDES + 1)) + BODY_SHAPES.MIN_SIDES;
    const face = FACE_NAMES[Math.floor(rng() * FACE_NAMES.length)];
    return { sides, face };
}
