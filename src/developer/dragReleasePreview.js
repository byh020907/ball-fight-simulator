import {
    createDragCombatConfig,
    DRAG_COMBAT_CONFIG,
    getDragLaunchSpeed,
    getSlingshotVector
} from "../combat-drag/index.js";

export const DRAG_RELEASE_PREVIEW_CONFIG = Object.freeze({
    width: 640,
    height: 360,
    baseSpeed: 405,
    ballRadius: 22,
    targetRadius: 26,
    maximumPixelRatio: 2,
    maximumFrameDelta: 1 / 20,
    wallInset: 10,
    start: Object.freeze({ x: 138, y: 250 }),
    target: Object.freeze({ x: 515, y: 105 })
});

function finitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawArrow(ctx, origin, direction, length) {
    const tip = { x: origin.x + direction.x * length, y: origin.y + direction.y * length };
    const side = { x: -direction.y, y: direction.x };
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - direction.x * 14 + side.x * 8, tip.y - direction.y * 14 + side.y * 8);
    ctx.lineTo(tip.x - direction.x * 14 - side.x * 8, tip.y - direction.y * 14 - side.y * 8);
    ctx.closePath();
    ctx.fill();
}

export class DragReleasePreviewScene {
    constructor(releaseSpeedMultiplier = 1) {
        this.totalHits = 0;
        this.setReleaseSpeedMultiplier(releaseSpeedMultiplier);
        this.reset();
    }

    setReleaseSpeedMultiplier(value) {
        this.config = createDragCombatConfig(value);
        this.releaseSpeedMultiplier = this.config.shot.releaseSpeedMultiplier;
        return this.getSnapshot();
    }

    reset() {
        this.ball = { ...DRAG_RELEASE_PREVIEW_CONFIG.start };
        this.velocity = { x: 0, y: 0 };
        this.dragging = false;
        this.pointerId = null;
        this.dragStart = null;
        this.dragCurrent = null;
        this.shotElapsed = 0;
        this.bounceCount = 0;
        this.hitPulse = 0;
        this.trail = [];
        this.lastLaunch = null;
        return this.getSnapshot();
    }

    begin(pointerId, point) {
        if (this.dragging || this.isMoving() || !finitePoint(point)) return null;
        if (distanceBetween(point, this.ball) > DRAG_RELEASE_PREVIEW_CONFIG.ballRadius * 1.8) return null;
        this.dragging = true;
        this.pointerId = pointerId;
        this.dragStart = { ...this.ball };
        this.dragCurrent = { ...point };
        return { type: "begin" };
    }

    move(pointerId, point) {
        if (!this.dragging || pointerId !== this.pointerId || !finitePoint(point)) return null;
        this.dragCurrent = { ...point };
        return getSlingshotVector(this.dragStart, this.dragCurrent, DRAG_COMBAT_CONFIG.input);
    }

    release(pointerId) {
        if (!this.dragging || pointerId !== this.pointerId) return null;
        const drag = getSlingshotVector(this.dragStart, this.dragCurrent, DRAG_COMBAT_CONFIG.input);
        this._clearPointer();
        if (!drag.active) return { type: "cancel" };

        const speed = getDragLaunchSpeed(DRAG_RELEASE_PREVIEW_CONFIG.baseSpeed, drag.strength, this.config.shot);
        this.velocity = { x: drag.vector.x * speed, y: drag.vector.y * speed };
        this.shotElapsed = 0;
        this.bounceCount = 0;
        this.trail = [];
        this.lastLaunch = { speed, strength: drag.strength };
        return { type: "launch", speed, strength: drag.strength };
    }

    cancel(pointerId) {
        if (!this.dragging || pointerId !== this.pointerId) return null;
        this._clearPointer();
        return { type: "cancel" };
    }

    isMoving() {
        return Math.hypot(this.velocity?.x ?? 0, this.velocity?.y ?? 0) > 0.01;
    }

    update(delta) {
        const elapsed = Math.min(
            DRAG_RELEASE_PREVIEW_CONFIG.maximumFrameDelta,
            Math.max(0, Number.isFinite(delta) ? delta : 0)
        );
        this.hitPulse = Math.max(0, this.hitPulse - elapsed);
        if (!this.isMoving()) return;

        this.shotElapsed += elapsed;
        this.trail.push({ ...this.ball });
        if (this.trail.length > 18) this.trail.shift();
        this.ball.x += this.velocity.x * elapsed;
        this.ball.y += this.velocity.y * elapsed;
        this._resolveWallBounces();
        this._resolveTargetHit();

        if (this.shotElapsed >= this.config.shot.shotMaxSeconds) this.reset();
    }

    _resolveWallBounces() {
        const radius = DRAG_RELEASE_PREVIEW_CONFIG.ballRadius;
        const min = DRAG_RELEASE_PREVIEW_CONFIG.wallInset + radius;
        const maxX = DRAG_RELEASE_PREVIEW_CONFIG.width - DRAG_RELEASE_PREVIEW_CONFIG.wallInset - radius;
        const maxY = DRAG_RELEASE_PREVIEW_CONFIG.height - DRAG_RELEASE_PREVIEW_CONFIG.wallInset - radius;
        let bounced = false;
        if (this.ball.x < min) {
            this.ball.x = min + (min - this.ball.x);
            this.velocity.x = Math.abs(this.velocity.x);
            bounced = true;
        } else if (this.ball.x > maxX) {
            this.ball.x = maxX - (this.ball.x - maxX);
            this.velocity.x = -Math.abs(this.velocity.x);
            bounced = true;
        }
        if (this.ball.y < min) {
            this.ball.y = min + (min - this.ball.y);
            this.velocity.y = Math.abs(this.velocity.y);
            bounced = true;
        } else if (this.ball.y > maxY) {
            this.ball.y = maxY - (this.ball.y - maxY);
            this.velocity.y = -Math.abs(this.velocity.y);
            bounced = true;
        }
        if (bounced) this.bounceCount += 1;
    }

    _resolveTargetHit() {
        if (this.hitPulse > 0) return;
        const target = DRAG_RELEASE_PREVIEW_CONFIG.target;
        const hitDistance = DRAG_RELEASE_PREVIEW_CONFIG.ballRadius + DRAG_RELEASE_PREVIEW_CONFIG.targetRadius;
        if (distanceBetween(this.ball, target) > hitDistance) return;
        this.totalHits += 1;
        this.hitPulse = 0.45;
    }

    _clearPointer() {
        this.dragging = false;
        this.pointerId = null;
        this.dragStart = null;
        this.dragCurrent = null;
    }

    getSnapshot() {
        return {
            releaseSpeedMultiplier: this.releaseSpeedMultiplier,
            ball: this.ball ? { ...this.ball } : null,
            velocity: this.velocity ? { ...this.velocity } : null,
            dragging: Boolean(this.dragging),
            moving: this.isMoving?.() ?? false,
            bounceCount: this.bounceCount ?? 0,
            totalHits: this.totalHits ?? 0,
            lastLaunch: this.lastLaunch ? { ...this.lastLaunch } : null
        };
    }

    draw(ctx) {
        const preview = DRAG_RELEASE_PREVIEW_CONFIG;
        ctx.fillStyle = "#10212a";
        ctx.fillRect(0, 0, preview.width, preview.height);
        ctx.strokeStyle = "rgba(115, 201, 211, 0.12)";
        ctx.lineWidth = 1;
        for (let x = 80; x < preview.width; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, preview.height);
            ctx.stroke();
        }
        for (let y = 60; y < preview.height; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(preview.width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = "#8edbe3";
        ctx.lineWidth = 5;
        ctx.strokeRect(7, 7, preview.width - 14, preview.height - 14);

        const target = preview.target;
        ctx.save();
        ctx.strokeStyle = this.hitPulse > 0 ? "#fff1a6" : "#ff8b72";
        ctx.fillStyle = this.hitPulse > 0 ? "rgba(255, 241, 166, 0.35)" : "rgba(255, 139, 114, 0.18)";
        ctx.lineWidth = this.hitPulse > 0 ? 8 : 4;
        ctx.beginPath();
        ctx.arc(target.x, target.y, preview.targetRadius + (this.hitPulse > 0 ? 7 : 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffe0d9";
        ctx.font = "800 21px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("표적", target.x, target.y + 5);
        ctx.restore();

        this.trail.forEach((point, index) => {
            ctx.fillStyle = `rgba(100, 222, 234, ${((index + 1) / this.trail.length) * 0.2})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, preview.ballRadius * 0.72, 0, Math.PI * 2);
            ctx.fill();
        });

        if (this.dragging) {
            const drag = getSlingshotVector(this.dragStart, this.dragCurrent, DRAG_COMBAT_CONFIG.input);
            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.arc(this.ball.x, this.ball.y, DRAG_COMBAT_CONFIG.input.maxPullPx, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = "#ffe39a";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(this.ball.x, this.ball.y);
            ctx.lineTo(this.dragCurrent.x, this.dragCurrent.y);
            ctx.stroke();
            if (drag.active) {
                ctx.strokeStyle = "#fff6cc";
                ctx.fillStyle = "#fff6cc";
                drawArrow(ctx, this.ball, drag.vector, 68 + drag.strength * 48);
            }
            ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.beginPath();
        ctx.ellipse(this.ball.x + 5, this.ball.y + preview.ballRadius + 7, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#64deea";
        ctx.strokeStyle = "#e4fdff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, preview.ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "rgba(5, 14, 18, 0.76)";
        ctx.fillRect(20, 18, 280, 80);
        ctx.fillStyle = "#effdff";
        ctx.font = "800 26px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`릴리즈 ×${this.releaseSpeedMultiplier.toFixed(2)}`, 34, 51);
        ctx.fillStyle = "#a9dbe0";
        ctx.font = "700 19px sans-serif";
        const speed = this.lastLaunch?.speed ?? 0;
        ctx.fillText(`최근 ${Math.round(speed)} · 반사 ${this.bounceCount} · 적중 ${this.totalHits}`, 34, 82);

        if (!this.dragging && !this.isMoving()) {
            ctx.fillStyle = "rgba(5, 14, 18, 0.82)";
            ctx.fillRect(118, 301, 404, 42);
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("공을 반대 방향으로 당겼다 놓으세요", preview.width / 2, 329);
        }
    }
}

export class DragReleasePreviewController {
    constructor({
        requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
        cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
        ResizeObserverClass = globalThis.ResizeObserver
    } = {}) {
        this.requestFrame = requestFrame;
        this.cancelFrame = cancelFrame;
        this.ResizeObserverClass = ResizeObserverClass;
        this.frameId = null;
        this.lastFrameTime = null;
        this.canvas = null;
        this.scene = null;
        this.resizeObserver = null;
    }

    start(canvas, releaseSpeedMultiplier = 1) {
        if (!canvas?.getContext || !this.requestFrame) return { ok: false, error: "preview_unavailable" };
        this.stop();
        this.canvas = canvas;
        this.scene = new DragReleasePreviewScene(releaseSpeedMultiplier);
        this.resizeObserver = this.ResizeObserverClass ? new this.ResizeObserverClass(() => this._resize()) : null;
        this.resizeObserver?.observe(canvas);
        this._bindPointerEvents();
        this._resize();
        this.frameId = this.requestFrame((time) => this._renderFrame(time));
        return { ok: true, ...this.scene.getSnapshot() };
    }

    stop() {
        if (this.frameId !== null) this.cancelFrame?.(this.frameId);
        this.resizeObserver?.disconnect();
        this._unbindPointerEvents();
        this.frameId = null;
        this.lastFrameTime = null;
        this.canvas = null;
        this.scene = null;
        this.resizeObserver = null;
        return { ok: true };
    }

    setReleaseSpeedMultiplier(value) {
        if (!this.scene) return { ok: false, error: "preview_unavailable" };
        return { ok: true, ...this.scene.setReleaseSpeedMultiplier(value) };
    }

    reset() {
        if (!this.scene) return { ok: false, error: "preview_unavailable" };
        return { ok: true, ...this.scene.reset() };
    }

    _bindPointerEvents() {
        if (!this.canvas) return;
        this.pointerDownHandler = (event) => {
            if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
            if (!this.scene?.begin(event.pointerId, this._eventPoint(event))) return;
            event.preventDefault();
            this.canvas?.setPointerCapture?.(event.pointerId);
        };
        this.pointerMoveHandler = (event) => {
            if (this.scene?.move(event.pointerId, this._eventPoint(event))) event.preventDefault();
        };
        this.pointerUpHandler = (event) => this._finishPointer(event, "release");
        this.pointerCancelHandler = (event) => this._finishPointer(event, "cancel");
        this.lostPointerCaptureHandler = (event) => this.scene?.cancel(event.pointerId);
        this.canvas.addEventListener("pointerdown", this.pointerDownHandler);
        this.canvas.addEventListener("pointermove", this.pointerMoveHandler);
        this.canvas.addEventListener("pointerup", this.pointerUpHandler);
        this.canvas.addEventListener("pointercancel", this.pointerCancelHandler);
        this.canvas.addEventListener("lostpointercapture", this.lostPointerCaptureHandler);
    }

    _unbindPointerEvents() {
        if (!this.canvas) return;
        this.canvas.removeEventListener("pointerdown", this.pointerDownHandler);
        this.canvas.removeEventListener("pointermove", this.pointerMoveHandler);
        this.canvas.removeEventListener("pointerup", this.pointerUpHandler);
        this.canvas.removeEventListener("pointercancel", this.pointerCancelHandler);
        this.canvas.removeEventListener("lostpointercapture", this.lostPointerCaptureHandler);
        this.pointerDownHandler = null;
        this.pointerMoveHandler = null;
        this.pointerUpHandler = null;
        this.pointerCancelHandler = null;
        this.lostPointerCaptureHandler = null;
    }

    _finishPointer(event, method) {
        const result = this.scene?.[method](event.pointerId);
        if (!result) return;
        event.preventDefault();
        if (this.canvas?.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }

    _eventPoint(event) {
        const bounds = this.canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * DRAG_RELEASE_PREVIEW_CONFIG.width,
            y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * DRAG_RELEASE_PREVIEW_CONFIG.height
        };
    }

    _resize() {
        if (!this.canvas) return;
        const bounds = this.canvas.getBoundingClientRect();
        const pixelRatio = Math.min(DRAG_RELEASE_PREVIEW_CONFIG.maximumPixelRatio, globalThis.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }

    _renderFrame(time) {
        if (!this.canvas || !this.scene) return;
        const delta = this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
        this.lastFrameTime = time;
        this.scene.update(delta);
        const context = this.canvas.getContext("2d");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const scale = Math.min(
            this.canvas.width / DRAG_RELEASE_PREVIEW_CONFIG.width,
            this.canvas.height / DRAG_RELEASE_PREVIEW_CONFIG.height
        );
        const offsetX = (this.canvas.width - DRAG_RELEASE_PREVIEW_CONFIG.width * scale) / 2;
        const offsetY = (this.canvas.height - DRAG_RELEASE_PREVIEW_CONFIG.height * scale) / 2;
        context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
        this.scene.draw(context);
        this.frameId = this.requestFrame((nextTime) => this._renderFrame(nextTime));
    }
}
