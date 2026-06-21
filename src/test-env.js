/**
 * Canvas + 애니메이션 루프 + Simulation.entities 렌더 파이프라인.
 *
 * 모든 엔티티는 Simulation.entities에서 관리되며,
 * onUpdate / onRender 후크로 추가 로직을 주입합니다.
 *
 * 사용법:
 *   const env = new TestEnv(canvas, sim);
 *   env.statusEl = document.getElementById("status");
 *   env.onRender = (ctx) => { ... };
 *   env.start();
 */

export class TestEnv {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} sim Simulation whose entities are rendered each frame.
     */
    constructor(canvas, sim) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        /** Simulation whose entities are rendered each frame. */
        this.sim = sim;
        /** Optional status element to update each frame. */
        this.statusEl = null;
        this._lastTime = 0;
        this._animId = null;
    }

    /** Called each frame. Receives (dt). */
    onUpdate(dt) {}

    /** Called after all sim entities are drawn. Receives (ctx, dt). */
    onRender(ctx, dt) {}

    /** Start the animation loop. */
    start() {
        const loop = (time) => {
            const dt = this._lastTime ? Math.min(0.05, (time - this._lastTime) / 1000) : 0.016;
            this._lastTime = time;
            this._update(dt);
            this._render(dt);
            this._animId = requestAnimationFrame(loop);
        };
        this._animId = requestAnimationFrame(loop);
    }

    stop() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────

    _update(dt) {
        this.onUpdate(dt);
    }

    _render(dt) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render all sim entities (fighters, projectiles, effects, test objects)
        if (this.sim) {
            for (const e of this.sim.entities) {
                e.draw?.(ctx);
            }
        }

        this.onRender(ctx, dt);
    }
}
