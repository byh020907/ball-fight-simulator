import { DRAG_COMBAT_CONFIG } from "./config.js";
import { getRicochetDamageMultiplier, isShieldFront } from "./vectorMath.js";

export class PlayerShotState {
    constructor(config = DRAG_COMBAT_CONFIG) {
        this.config = config;
        this.reset();
    }
    begin(fighterId, shieldForwards = new Map()) {
        this.fighterId = fighterId;
        this.shieldForwards = new Map(shieldForwards);
        this.bounceCount = 0;
        this.elapsed = 0;
        this.slowElapsed = 0;
        this.recentSurface = null;
        this.active = true;
    }
    bounce(surfaceKey, elapsed) {
        if (
            !this.active ||
            !surfaceKey ||
            !Number.isFinite(elapsed) ||
            elapsed < 0 ||
            (this.recentSurface && elapsed < this.recentSurface.time)
        )
            return false;
        if (
            this.recentSurface?.key === surfaceKey &&
            elapsed - this.recentSurface.time < this.config.shot.bounceDebounceSeconds
        )
            return false;
        this.recentSurface = { key: surfaceKey, time: elapsed };
        this.bounceCount += 1;
        return true;
    }
    collide({ fighterId, relation, targetToContact }) {
        if (!this.active) return null;
        if (relation === "ally") return this.#finish({ type: "ally-stop" });
        const forward = this.shieldForwards.get(fighterId);
        if (forward && isShieldFront(forward, targetToContact))
            return this.#finish({
                type: "shield-counter",
                outgoingMultiplier: 0,
                incomingMultiplier: this.config.shield.frontIncomingMultiplier,
                recoilSpeedRatio: this.config.shield.frontRecoilSpeedRatio,
                inputLockSeconds: this.config.shield.frontInputLockSeconds
            });
        if (relation === "enemy" && this.bounceCount >= 1)
            return this.#finish({
                type: "rear-hit",
                damageMultiplier: getRicochetDamageMultiplier(this.bounceCount),
                staggerSeconds: this.bounceCount >= 3 ? this.config.shield.ricochetThreeOrMoreStaggerSeconds : 0
            });
        return this.#finish({ type: "plain-hit" });
    }
    tick(realDelta, speed) {
        if (!this.active) return null;
        const delta = Math.max(0, Number.isFinite(realDelta) ? realDelta : 0);
        this.elapsed += delta;
        this.slowElapsed =
            Number.isFinite(speed) && speed <= this.config.shot.shotSlowSpeed ? this.slowElapsed + delta : 0;
        if (this.slowElapsed >= this.config.shot.shotSlowSeconds) return this.#end("slow-stop");
        if (this.elapsed >= this.config.shot.shotMaxSeconds) return this.#end("timeout");
        return null;
    }
    #end(type) {
        return this.#finish({ type });
    }
    #finish(result) {
        const snapshot = { ...result, bounceCount: this.bounceCount };
        this.reset();
        return snapshot;
    }
    reset() {
        this.active = false;
        this.fighterId = null;
        this.shieldForwards = new Map();
        this.bounceCount = 0;
        this.elapsed = 0;
        this.slowElapsed = 0;
        this.recentSurface = null;
    }
}
