/**
 * Canvas + 애니메이션 루프 + entity render 파이프라인.
 *
 * 선택적으로 Simulation 인스턴스를 연결하면 sim.entities도 함께 렌더합니다.
 * sim을 연결해도 env.entities는 별도로 유지되며 onRender에서 추가 렌더 가능.
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
     * @param {object} [sim] Optional Simulation (or mock) — its entities are rendered after env.entities.
     */
    constructor(canvas, sim) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        /** @type {Array<{draw?:(ctx:CanvasRenderingContext2D)=>void, update?:(dt:number, sim?:any)=>void}>} */
        this.entities = [];
        /** Optional Simulation whose entities are rendered each frame. */
        this.sim = sim ?? null;
        /** Optional status element to update each frame. */
        this.statusEl = null;
        this._lastTime = 0;
        this._animId = null;
    }

    /** Register a renderable/updatable object. */
    add(obj) {
        this.entities.push(obj);
    }

    /** Called each frame before entity updates. Receives (dt). */
    onUpdate(dt) {}

    /** Called each frame after all entities are drawn. Receives (ctx, dt). */
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
        for (const e of this.entities) {
            e.update?.(dt, this.sim);
        }
    }

    _render(dt) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. env entities (test-specific, e.g. target)
        for (const e of this.entities) {
            e.draw?.(ctx);
        }

        // 2. sim entities (fighters, projectiles, effects — all have draw)
        if (this.sim) {
            for (const e of this.sim.entities) {
                e.draw?.(ctx);
            }
        }

        // 3. custom overlay
        this.onRender(ctx, dt);
    }
}
