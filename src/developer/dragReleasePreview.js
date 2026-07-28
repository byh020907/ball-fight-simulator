import {
    createDragCombatConfig,
    DRAG_COMBAT_CONFIG,
    getChargeRatio,
    getDragLaunchSpeed,
    getSlingshotVector
} from "../combat-drag/index.js";
import { resolveLinearVelocityPolicy } from "../physics/linearVelocityPolicy.js";

export const DRAG_RELEASE_PREVIEW_CONFIG = Object.freeze({
    width: 640,
    height: 360,
    targetRadius: 26,
    maximumPixelRatio: 2,
    maximumFrameDelta: 1 / 20,
    wallInset: 10,
    start: Object.freeze({ x: 138, y: 250 }),
    target: Object.freeze({ x: 515, y: 105 })
});

const DEFAULT_PREVIEW_FIGHTER = Object.freeze({
    id: "preview",
    name: "테스트 공",
    color: "#64deea",
    baseSpeed: 405,
    baseRadius: 50,
    mass: 1,
    level: 1
});

function normalizePreviewFighter(fighter) {
    return {
        id: fighter?.id ?? DEFAULT_PREVIEW_FIGHTER.id,
        name: fighter?.name ?? DEFAULT_PREVIEW_FIGHTER.name,
        color: /^#[0-9a-f]{6}$/i.test(fighter?.color) ? fighter.color : DEFAULT_PREVIEW_FIGHTER.color,
        baseSpeed:
            Number.isFinite(fighter?.baseSpeed) && fighter.baseSpeed > 0
                ? fighter.baseSpeed
                : DEFAULT_PREVIEW_FIGHTER.baseSpeed,
        baseRadius:
            Number.isFinite(fighter?.baseRadius) && fighter.baseRadius > 0
                ? fighter.baseRadius
                : DEFAULT_PREVIEW_FIGHTER.baseRadius,
        mass: Number.isFinite(fighter?.mass) && fighter.mass > 0 ? fighter.mass : DEFAULT_PREVIEW_FIGHTER.mass,
        level: Math.max(1, Math.floor(Number(fighter?.level) || DEFAULT_PREVIEW_FIGHTER.level))
    };
}

function colorWithAlpha(hex, alpha) {
    const value = Number.parseInt(hex.slice(1), 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

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
    constructor(releaseSpeedMultiplier = 1, fighter = null) {
        this.totalHits = 0;
        this.fighter = normalizePreviewFighter(fighter);
        this.setReleaseSpeedMultiplier(releaseSpeedMultiplier);
        this.reset();
    }

    setReleaseSpeedMultiplier(value) {
        this.config = createDragCombatConfig(value);
        this.releaseSpeedMultiplier = this.config.shot.releaseSpeedMultiplier;
        return this.getSnapshot();
    }

    setFighter(fighter) {
        this.fighter = normalizePreviewFighter(fighter);
        return this.reset();
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
        this.aimElapsed = 0;
        this.chargeStarted = false;
        this.visualElapsed = 0;
        return this.getSnapshot();
    }

    begin(pointerId, point) {
        if (this.dragging || this.isMoving() || !finitePoint(point)) return null;
        if (distanceBetween(point, this.ball) > this.fighter.baseRadius * 1.5) return null;
        this.dragging = true;
        this.pointerId = pointerId;
        this.dragStart = { ...this.ball };
        this.dragCurrent = { ...point };
        this.aimElapsed = 0;
        this.chargeStarted = false;
        return { type: "begin" };
    }

    move(pointerId, point) {
        if (!this.dragging || pointerId !== this.pointerId || !finitePoint(point)) return null;
        this.dragCurrent = { ...point };
        const drag = getSlingshotVector(this.dragStart, this.dragCurrent, DRAG_COMBAT_CONFIG.input);
        if (drag.active) this.chargeStarted = true;
        return drag;
    }

    release(pointerId) {
        if (!this.dragging || pointerId !== this.pointerId) return null;
        const drag = getSlingshotVector(this.dragStart, this.dragCurrent, DRAG_COMBAT_CONFIG.input);
        return this._finishDrag(drag, "release");
    }

    _finishDrag(drag, source) {
        const chargeRatio = getChargeRatio(this.aimElapsed, this.config.input.maxAimSeconds);
        this._clearPointer();
        if (!drag.active) return { type: "cancel" };
        const speed = getDragLaunchSpeed(this.fighter.baseSpeed, chargeRatio, this.config.shot);
        this.velocity = { x: drag.vector.x * speed, y: drag.vector.y * speed };
        this.shotElapsed = 0;
        this.bounceCount = 0;
        this.trail = [];
        this.lastLaunch = { speed, chargeRatio, source };
        return { type: "launch", speed, chargeRatio, source };
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
        this.visualElapsed += elapsed;
        this.hitPulse = Math.max(0, this.hitPulse - elapsed);
        if (this.dragging && this.chargeStarted) {
            this.aimElapsed = Math.min(this.config.input.maxAimSeconds, this.aimElapsed + elapsed);
            if (this.aimElapsed >= this.config.input.maxAimSeconds) {
                const drag = getSlingshotVector(this.dragStart, this.dragCurrent, DRAG_COMBAT_CONFIG.input);
                this._finishDrag(drag, "auto-launch");
            }
        }
        if (!this.isMoving()) return;

        this._applyVelocityPolicy(elapsed);
        this.shotElapsed += elapsed;
        this.trail.push({ ...this.ball });
        if (this.trail.length > 18) this.trail.shift();
        this.ball.x += this.velocity.x * elapsed;
        this.ball.y += this.velocity.y * elapsed;
        this._resolveWallBounces();
        this._resolveTargetHit();

        if (this.shotElapsed >= this.config.shot.shotMaxSeconds) this.reset();
    }

    _applyVelocityPolicy(delta) {
        const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
        if (currentSpeed <= 0) return;
        const transition = resolveLinearVelocityPolicy({
            currentSpeed,
            referenceSpeed: this.fighter.baseSpeed,
            delta
        });
        const scale = transition.nextSpeed / currentSpeed;
        this.velocity.x *= scale;
        this.velocity.y *= scale;
    }

    _resolveWallBounces() {
        const radius = this.fighter.baseRadius;
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
        const hitDistance = this.fighter.baseRadius + DRAG_RELEASE_PREVIEW_CONFIG.targetRadius;
        if (distanceBetween(this.ball, target) > hitDistance) return;
        this.totalHits += 1;
        this.hitPulse = 0.45;
    }

    _clearPointer() {
        this.dragging = false;
        this.pointerId = null;
        this.dragStart = null;
        this.dragCurrent = null;
        this.aimElapsed = 0;
        this.chargeStarted = false;
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
            fighter: { ...this.fighter },
            chargeRatio: getChargeRatio(this.aimElapsed, this.config.input.maxAimSeconds),
            maxAimSeconds: this.config.input.maxAimSeconds,
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
            ctx.fillStyle = colorWithAlpha(this.fighter.color, ((index + 1) / this.trail.length) * 0.24);
            ctx.beginPath();
            ctx.arc(point.x, point.y, this.fighter.baseRadius * 0.72, 0, Math.PI * 2);
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
                drawArrow(
                    ctx,
                    this.ball,
                    drag.vector,
                    68 + getChargeRatio(this.aimElapsed, this.config.input.maxAimSeconds) * 48
                );
            }
            ctx.restore();
        }

        this._drawTelegraphSamples(ctx);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.beginPath();
        ctx.ellipse(
            this.ball.x + 5,
            this.ball.y + this.fighter.baseRadius + 7,
            this.fighter.baseRadius * 1.05,
            this.fighter.baseRadius * 0.32,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = this.fighter.color;
        ctx.strokeStyle = "#e4fdff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.fighter.baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (!this.isMoving()) {
            ctx.fillStyle = "rgba(5, 14, 18, 0.76)";
            ctx.fillRect(20, 18, 340, 80);
            ctx.fillStyle = "#effdff";
            ctx.font = "800 23px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`${this.fighter.name} · ×${this.releaseSpeedMultiplier.toFixed(2)}`, 34, 49);
            ctx.fillStyle = "#a9dbe0";
            ctx.font = "700 18px sans-serif";
            const speed = this.lastLaunch?.speed ?? 0;
            ctx.fillText(
                `기준 ${Math.round(this.fighter.baseSpeed)} · R${Math.round(this.fighter.baseRadius)} · 최근 ${Math.round(speed)}`,
                34,
                80
            );
        }

        if (!this.dragging && !this.isMoving()) {
            ctx.fillStyle = "rgba(5, 14, 18, 0.82)";
            ctx.fillRect(118, 301, 404, 42);
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("공을 반대 방향으로 당겼다 놓으세요", preview.width / 2, 329);
        } else if (this.dragging) {
            const chargeRatio = getChargeRatio(this.aimElapsed, this.config.input.maxAimSeconds);
            const speedRatio =
                (this.config.shot.minSpeedRatio +
                    (this.config.shot.maxSpeedRatio - this.config.shot.minSpeedRatio) * chargeRatio) *
                this.config.shot.releaseSpeedMultiplier;
            ctx.fillStyle = "rgba(5, 14, 18, 0.82)";
            ctx.fillRect(145, 301, 350, 42);
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 19px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
                `차징 ${Math.round(chargeRatio * 100)}% · 예상 속도 ×${speedRatio.toFixed(2)}`,
                preview.width / 2,
                329
            );
        }
    }

    _drawTelegraphSamples(ctx) {
        const samples = [
            { y: 36, label: "적 조준", color: "#ff5548", speed: 65 },
            { y: 68, label: "돌진 가속", color: "#ffd166", speed: 180 }
        ];
        ctx.save();
        ctx.font = "800 15px sans-serif";
        ctx.textAlign = "left";
        for (const sample of samples) {
            ctx.fillStyle = sample.color;
            ctx.fillText(sample.label, 396, sample.y + 5);
            ctx.strokeStyle = sample.color;
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 6]);
            ctx.lineDashOffset = -(this.visualElapsed * sample.speed) % 14;
            ctx.beginPath();
            ctx.moveTo(488, sample.y);
            ctx.lineTo(612, sample.y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
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

    start(canvas, tuning = {}) {
        if (!canvas?.getContext || !this.requestFrame) return { ok: false, error: "preview_unavailable" };
        this.stop();
        this.canvas = canvas;
        const releaseSpeedMultiplier = Number.isFinite(tuning) ? tuning : tuning?.value;
        const fighter = Number.isFinite(tuning) ? null : tuning?.fighter;
        this.scene = new DragReleasePreviewScene(releaseSpeedMultiplier, fighter);
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

    setFighter(fighter) {
        if (!this.scene) return { ok: false, error: "preview_unavailable" };
        return { ok: true, ...this.scene.setFighter(fighter) };
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
