import { DRAG_COMBAT_CONFIG } from "./config.js";
import { getSlingshotVector } from "./vectorMath.js";

export class DragInputState {
    constructor(config = DRAG_COMBAT_CONFIG.input) {
        this.config = config;
        this.reset();
    }
    reset() {
        this.state = "idle";
        this.pointerId = null;
        this.start = null;
        this.current = null;
        this.aimElapsed = 0;
        this.cooldownRemaining = 0;
        this.inputLockRemaining = 0;
        this.lastSnapshot = null;
        this.realTime = 0;
    }
    begin(pointerId, point) {
        if (
            this.state !== "idle" ||
            this.cooldownRemaining > 0 ||
            this.inputLockRemaining > 0 ||
            !Number.isFinite(point?.x) ||
            !Number.isFinite(point?.y)
        )
            return null;
        this.state = "aiming";
        this.pointerId = pointerId;
        this.start = { ...point };
        this.current = { ...point };
        this.aimElapsed = 0;
        return { type: "begin" };
    }
    move(pointerId, point) {
        if (
            this.state !== "aiming" ||
            pointerId !== this.pointerId ||
            !Number.isFinite(point?.x) ||
            !Number.isFinite(point?.y)
        )
            return null;
        this.current = { ...point };
        this.lastSnapshot = getSlingshotVector(this.start, this.current, this.config);
        return this.lastSnapshot;
    }
    release(pointerId) {
        if (this.state !== "aiming" || pointerId !== this.pointerId) return null;
        return this.#finish("release");
    }
    cancel(pointerId) {
        if (this.state !== "aiming" || pointerId !== this.pointerId) return null;
        this.#idle();
        return { type: "cancel" };
    }
    lock(seconds) {
        this.inputLockRemaining = Math.max(this.inputLockRemaining, Number.isFinite(seconds) ? seconds : 0);
    }
    tick(realDelta) {
        const delta = Math.max(0, Number.isFinite(realDelta) ? realDelta : 0);
        this.realTime += delta;
        this.cooldownRemaining = Math.max(0, this.cooldownRemaining - delta);
        this.inputLockRemaining = Math.max(0, this.inputLockRemaining - delta);
        if (this.state !== "aiming") return null;
        this.aimElapsed += delta;
        if (this.aimElapsed >= this.config.maxAimSeconds) return this.#finish("auto-launch");
        return null;
    }
    #finish(source) {
        const snapshot = getSlingshotVector(this.start, this.current, this.config);
        this.lastSnapshot = snapshot;
        this.#idle();
        if (!snapshot.active) return { type: "cancel" };
        this.cooldownRemaining = this.config.cooldownSeconds;
        return { type: "launch", source, snapshot, cooldownReadyAt: this.realTime + this.config.cooldownSeconds };
    }
    #idle() {
        this.state = "idle";
        this.pointerId = null;
        this.start = null;
        this.current = null;
        this.aimElapsed = 0;
    }
}
