import { HUNTING_FLOW_CONFIG } from "./huntingFlowConfig.js";

const DEFAULT_SCHEDULER = Object.freeze({
    now: () => performance.now(),
    setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
    clearInterval: (timerId) => globalThis.clearInterval(timerId)
});

export class HuntingAutoAdvance {
    constructor({ onStateChange, scheduler = DEFAULT_SCHEDULER } = {}) {
        this.onStateChange = onStateChange;
        this.scheduler = scheduler;
        this.timerId = null;
        this.deadline = 0;
        this.durationMs = 0;
        this.action = null;
        this.label = "계속 진행";
    }

    start(action, { label = "계속 진행", delayMs = HUNTING_FLOW_CONFIG.autoAdvanceDelayMs } = {}) {
        this.cancel();
        if (typeof action !== "function") return false;

        this.action = action;
        this.label = label;
        this.durationMs = Math.max(0, delayMs);
        this.deadline = this.scheduler.now() + this.durationMs;
        this._publish();
        this.timerId = this.scheduler.setInterval(() => this._tick(), HUNTING_FLOW_CONFIG.autoAdvanceTickMs);
        return true;
    }

    skip() {
        return this._complete();
    }

    cancel() {
        if (this.timerId !== null) this.scheduler.clearInterval(this.timerId);
        this.timerId = null;
        this.deadline = 0;
        this.durationMs = 0;
        this.action = null;
        this.onStateChange?.({ active: false, label: "", remainingMs: 0, progress: 0 });
    }

    _tick() {
        if (!this.action) return;
        if (this.scheduler.now() >= this.deadline) {
            this._complete();
            return;
        }
        this._publish();
    }

    _complete() {
        if (!this.action) return false;
        const action = this.action;
        this.cancel();
        action();
        return true;
    }

    _publish() {
        const remainingMs = Math.max(0, this.deadline - this.scheduler.now());
        this.onStateChange?.({
            active: true,
            label: this.label,
            remainingMs,
            progress: this.durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / this.durationMs)) : 0
        });
    }
}
