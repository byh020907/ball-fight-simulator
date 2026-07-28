import { DRAG_COMBAT_CONFIG } from "./config.js";
import { getSlingshotVector } from "./vectorMath.js";
import { getChargeRatio } from "./chargeMath.js";

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
        this.chargeStarted = false;
        this.inputLockRemaining = 0;
        this.lastSnapshot = null;
        this.realTime = 0;
    }
    begin(pointerId, point) {
        if (
            this.state !== "idle" ||
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
        this.chargeStarted = false;
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
        if (this.lastSnapshot.active) this.chargeStarted = true;
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
        this.inputLockRemaining = Math.max(0, this.inputLockRemaining - delta);
        if (this.state !== "aiming") return null;
        if (this.chargeStarted) this.aimElapsed += delta;
        if (this.chargeStarted && this.aimElapsed >= this.config.maxAimSeconds) return this.#finish("auto-launch");
        return null;
    }
    #finish(source) {
        const snapshot = getSlingshotVector(this.start, this.current, this.config);
        const chargeRatio = getChargeRatio(this.aimElapsed, this.config.maxAimSeconds);
        this.lastSnapshot = snapshot;
        this.#idle();
        if (!snapshot.active) return { type: "cancel" };
        return { type: "launch", source, snapshot: { ...snapshot, chargeRatio } };
    }
    #idle() {
        this.state = "idle";
        this.pointerId = null;
        this.start = null;
        this.current = null;
        this.aimElapsed = 0;
        this.chargeStarted = false;
    }
}
