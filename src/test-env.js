/**
 * 재사용 가능한 단일 엔티티 테스트 환경.
 *
 * Canvas + 애니메이션 루프 + update/render 파이프라인을 추상화합니다.
 * 각 테스트 페이지에서는 필요한 객체를 add()하고
 * onRender(ctx) 만 구현하면 됩니다.
 *
 * 사용법:
 *   const env = new TestEnv(canvas);
 *   env.statusEl = document.getElementById("status");
 *   env.add(someEntityWithUpdateDraw);
 *   env.onRender = (ctx) => { ... };
 *   env.start();
 */

export class TestEnv {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} [sim] Optional mock simulation passed as 2nd arg to entity.update(dt, sim).
     */
    constructor(canvas, sim) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        /** @type {Array<{update?:(dt:number, sim?:any)=>void, draw?:(ctx:CanvasRenderingContext2D)=>void}>} */
        this.entities = [];
        /** Mock simulation context passed to entity.update(dt, sim). */
        this.sim = sim ?? null;
        /** Optional status element to update each frame. */
        this.statusEl = null;
        this._lastTime = 0;
        this._animId = null;
    }

    /** Register an object that has update(dt) and/or draw(ctx). */
    add(obj) {
        this.entities.push(obj);
    }

    /** Hook called at the start of each update tick, before entities update. Receives (dt). */
    onUpdate(dt) {}

    /** Hook for custom rendering after entities are drawn. Receives (ctx, dt). */
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

    /** Stop the animation loop. */
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

        for (const e of this.entities) {
            e.draw?.(ctx);
        }

        this.onRender(ctx, dt);
    }
}
