import { drawTerrain } from "./terrain/index.js";
import { RENDER_LAYERS } from "./core.js";
import { ArenaCamera } from "./camera.js";

const FOREST_BACKGROUND_CONFIG = Object.freeze({
    BASE_AREA: 1280 * 1280,
    BUSH_COUNT: 30,
    CANOPY_SHADOW_COUNT: 10,
    LEAF_COUNT: 36,
    SEED: 77
});

// ── Canvas renderer (unchanged) ─────────────────────────────────────────────

export class ArenaRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.camera = new ArenaCamera();
    }

    clear() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderPlayerPreview(previewBall, fighter, selectionAnimTime = 999) {
        this.clear();

        if (!previewBall || !fighter) return;

        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = previewBall.position.y;
        const progress = Math.min(selectionAnimTime / 0.5, 1);
        const scale = progress < 1 ? 1 - Math.exp(-5.5 * progress) * Math.cos(11 * progress) : 1;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // selection ring
        if (progress < 1) {
            const ringR = previewBall.radius * 1.5 + (1 - progress) * 30;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = fighter.color;
            ctx.lineWidth = 3 * (1 - progress) + 1;
            ctx.globalAlpha = 0.5 * (1 - progress);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        previewBall.draw(ctx);
        ctx.restore();

        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#202020";
        ctx.font = "900 28px Bahnschrift, Segoe UI, sans-serif";
        ctx.fillText("내 캐릭터", cx, previewBall.position.y + previewBall.radius + 48);
        ctx.font = "700 22px Bahnschrift, Segoe UI, sans-serif";
        ctx.fillStyle = fighter.color;
        ctx.fillText(fighter.name, cx, previewBall.position.y + previewBall.radius + 82);
        ctx.restore();
    }

    renderPlayerPreviewSwap(previewSim, fighter) {
        this.clear();

        if (!previewSim || !fighter) return;

        const ctx = this.ctx;
        ctx.save();
        const shake = previewSim.screenShake;
        if (shake) {
            const progress = shake.remaining / shake.duration;
            const strength = shake.strength * progress;
            ctx.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
        }

        previewSim.draw(ctx);
        ctx.restore();
    }

    render(simulation) {
        this.clear();

        const ctx = this.ctx;
        ctx.save();
        const shake = simulation.screenShake;
        if (shake) {
            const progress = shake.remaining / shake.duration;
            const strength = shake.strength * progress;
            ctx.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
        }

        const view = this.camera.getViewTransform(this.canvas, simulation);
        this.camera.apply(ctx, this.canvas, simulation);
        this._drawArenaBackground(ctx, simulation);
        drawTerrain(ctx, simulation.terrain, simulation.elapsed);
        ctx.strokeStyle = "#d7dce6";
        ctx.lineWidth = Math.max(2, 2 / view.scale);
        ctx.strokeRect(0, 0, simulation.width, simulation.height);

        for (const pass of ArenaRenderer.renderPasses) {
            for (const e of simulation.entities) {
                if (e.renderLayer === pass.layer) e.draw(ctx, simulation);
            }
        }

        ctx.restore();
    }

    _drawArenaBackground(ctx, simulation) {
        ctx.save();
        try {
            const theme = simulation.arenaTheme;
            if (theme === "cave") {
                this._drawCaveBackground(ctx, simulation);
            } else if (theme === "forest") {
                this._drawForestBackground(ctx, simulation);
            } else if (theme === "desert") {
                this._drawDesertBackground(ctx, simulation);
            } else {
                ctx.fillStyle = "#f5f5f5";
                ctx.fillRect(0, 0, simulation.width, simulation.height);
            }
        } finally {
            ctx.restore();
        }
    }

    _drawCaveBackground(ctx, simulation) {
        const w = simulation.width;
        const h = simulation.height;
        // 밝은 암석 바닥 — 이름표 #444444 대비 약 4.5:1
        ctx.fillStyle = "#9a928b";
        ctx.fillRect(0, 0, w, h);

        // 암석 균열선
        ctx.strokeStyle = "#7f7770";
        ctx.lineWidth = 3;
        const seed = 42;
        for (const i of Array.from({ length: 18 }, (_, n) => n)) {
            const sx = (i * 173 + seed) % w;
            const sy = (i * 241 + seed * 3) % h;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const ex = Math.min(w, Math.max(0, sx + ((i * 97) % 160) - 80));
            const ey = Math.min(h, Math.max(0, sy + ((i * 131) % 120) - 60));
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

        // 광물 반점
        ctx.fillStyle = "#b5ada4";
        for (const i of Array.from({ length: 25 }, (_, n) => n)) {
            const cx = (i * 311 + seed * 7) % w;
            const cy = (i * 197 + seed * 11) % h;
            const r = 3 + ((i * 53) % 8);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawForestBackground(ctx, simulation) {
        const w = simulation.width;
        const h = simulation.height;
        const config = FOREST_BACKGROUND_CONFIG;
        const areaScale = Math.max(1, (w * h) / config.BASE_AREA);
        // 밝은 녹색 바닥 — 이름표 #444444 대비 약 5.5:1
        ctx.fillStyle = "#9fbd7a";
        ctx.fillRect(0, 0, w, h);

        // 덤불 패치
        ctx.fillStyle = "#89aa66";
        for (const i of Array.from({ length: Math.round(config.BUSH_COUNT * areaScale) }, (_, n) => n)) {
            const cx = (i * 257 + config.SEED) % w;
            const cy = (i * 179 + config.SEED * 5) % h;
            const r = 12 + ((i * 67) % 22);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 나뭇잎 사이로 드리운 둥근 수관 그림자
        ctx.fillStyle = "rgba(82, 116, 62, 0.16)";
        for (const i of Array.from({ length: Math.round(config.CANOPY_SHADOW_COUNT * areaScale) }, (_, n) => n)) {
            const cx = (i * 311 + config.SEED * 3) % w;
            const cy = (i * 227 + config.SEED * 7) % h;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 48 + (i % 4) * 11, 24 + (i % 3) * 8, (i * 0.71) % Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // 지형과 겹쳐도 시선을 빼앗지 않는 작은 낙엽 반점
        for (const i of Array.from({ length: Math.round(config.LEAF_COUNT * areaScale) }, (_, n) => n)) {
            const x = (i * 149 + config.SEED * 11) % w;
            const y = (i * 313 + config.SEED * 13) % h;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((i * 1.31) % Math.PI);
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? "rgba(93, 123, 55, 0.38)" : "rgba(151, 113, 48, 0.3)";
            ctx.fill();
            ctx.restore();
        }
    }

    _drawDesertBackground(ctx, simulation) {
        const w = simulation.width;
        const h = simulation.height;
        // 모래색 바닥 — 이미 밝으므로 미세 조정만
        ctx.fillStyle = "#dcc9a3";
        ctx.fillRect(0, 0, w, h);

        // 모래결 — 가로 웨이브 라인
        ctx.strokeStyle = "#ccb78e";
        ctx.lineWidth = 2;
        const seed = 99;
        for (const row of Array.from({ length: 14 }, (_, n) => n)) {
            const y = (row * 87 + seed) % h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x < w; x += 40) {
                const wy = y + Math.sin((x + row * 31) * 0.03) * 8;
                ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        // 모래알
        ctx.fillStyle = "#c4a87a";
        for (const i of Array.from({ length: 50 }, (_, n) => n)) {
            const cx = (i * 401 + seed * 7) % w;
            const cy = (i * 283 + seed * 13) % h;
            ctx.beginPath();
            ctx.arc(cx, cy, 1.5 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /** Ordered render passes — add/remove/reorder entries to change draw priority. */
    static renderPasses = [
        { layer: RENDER_LAYERS.BACKGROUND },
        { layer: RENDER_LAYERS.FIGHTER },
        { layer: RENDER_LAYERS.FOREGROUND }
    ];
}

// ArenaRenderer 클래스는 canvas 전용으로 유지 (UIController/appStore 완전 제거됨)
