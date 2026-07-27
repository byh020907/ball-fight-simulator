import { DRAG_COMBAT_CONFIG } from "./config.js";

export class EnemyAttackQueue {
    constructor(config = DRAG_COMBAT_CONFIG.enemy) {
        this.config = config;
        this.reset();
    }
    reset() {
        this.state = "idle";
        this.attackerId = null;
        this.cursor = 0;
        this.elapsed = 0;
        this.protectedLaunchNotBefore = 0;
    }
    protectUntil(timestamp) {
        this.protectedLaunchNotBefore = Number.isFinite(timestamp) ? timestamp : 0;
    }
    tick(realDelta, eligibleIds, now = 0) {
        const ids = [...new Set((eligibleIds || []).filter(Boolean))];
        const delta = Math.max(0, Number.isFinite(realDelta) ? realDelta : 0);
        if (!ids.length) {
            this.reset();
            return null;
        }
        if (this.state === "idle") return this.#start(ids);
        if (!ids.includes(this.attackerId)) {
            this.state = "idle";
            return this.#start(ids);
        }
        this.elapsed += delta;
        if (
            this.state === "windup" &&
            this.elapsed >= this.config.windupSeconds &&
            now >= this.protectedLaunchNotBefore
        ) {
            this.state = "flight";
            this.elapsed = 0;
            return { type: "launch", attackerId: this.attackerId };
        }
        if (this.state === "flight" && this.elapsed >= this.config.flightMaxSeconds) {
            this.state = "idle";
            return this.#start(ids, "timeout");
        }
        return null;
    }
    resolveFlight(reason, eligibleIds) {
        if (this.state !== "flight") return null;
        this.state = "idle";
        return this.#start(eligibleIds || [], reason);
    }
    #start(ids, after) {
        if (!ids.length) return null;
        const attackerId = ids[this.cursor % ids.length];
        this.cursor = (ids.indexOf(attackerId) + 1) % ids.length;
        this.state = "windup";
        this.attackerId = attackerId;
        this.elapsed = 0;
        return { type: "windup", attackerId, after };
    }
}
