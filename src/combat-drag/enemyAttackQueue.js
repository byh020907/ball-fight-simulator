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
        this.idOrder = [];
        this.elapsed = 0;
        this.protectedLaunchNotBefore = 0;
        this.nextProtectedLaunchNotBefore = 0;
        this.nextProtectionCaptured = false;
        this.lastResult = null;
    }
    protectUntil(timestamp) {
        if (this.state === "windup" || this.nextProtectionCaptured || !Number.isFinite(timestamp)) return false;
        this.nextProtectedLaunchNotBefore = timestamp;
        this.nextProtectionCaptured = true;
        return true;
    }
    tick(realDelta, eligibleIds, now = 0) {
        const ids = [...new Set((eligibleIds || []).filter((id) => id !== null && id !== undefined))];
        this.#syncIdOrder(ids);
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
            return (this.lastResult = {
                type: "launch",
                attackerId: this.attackerId,
                protectedLaunchNotBefore: this.protectedLaunchNotBefore
            });
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
        const attackerId = this.#nextEligibleId(ids);
        if (attackerId === null) return null;
        this.state = "windup";
        this.attackerId = attackerId;
        this.elapsed = 0;
        this.protectedLaunchNotBefore = this.nextProtectedLaunchNotBefore;
        this.nextProtectedLaunchNotBefore = 0;
        this.nextProtectionCaptured = false;
        return (this.lastResult = {
            type: "windup",
            attackerId,
            after,
            protectedLaunchNotBefore: this.protectedLaunchNotBefore
        });
    }
    #syncIdOrder(ids) {
        if (!this.idOrder.length) {
            this.idOrder = [...ids];
            return;
        }
        for (const id of ids) {
            if (!this.idOrder.includes(id)) this.idOrder.push(id);
        }
    }
    #nextEligibleId(ids) {
        const order = this.idOrder.length ? this.idOrder : ids;
        for (let offset = 0; offset < order.length; offset += 1) {
            const index = (this.cursor + offset) % order.length;
            if (!ids.includes(order[index])) continue;
            this.cursor = (index + 1) % order.length;
            return order[index];
        }
        this.idOrder = [...ids];
        this.cursor = ids.length > 1 ? 1 : 0;
        return ids[0] ?? null;
    }
}
