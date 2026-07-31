export const COMMAND_RESOURCE_CONFIG = Object.freeze({
    maximum: 2,
    initial: 1,
    recoveryPerSecond: 1 / 8,
    abilityUseGain: 0.35,
    launchCost: 1,
    dragDamageMultiplier: 0.65
});

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export class CommandResource {
    constructor(config = {}) {
        this.config = Object.freeze({ ...COMMAND_RESOURCE_CONFIG, ...config });
        this.ownerId = null;
        this.amount = 0;
    }

    resetForOwner(owner) {
        const ownerId = typeof owner === "string" ? owner : (owner?.id ?? null);
        if (!ownerId || ownerId === this.ownerId) return false;
        this.ownerId = ownerId;
        this.amount = clamp(this.config.initial, 0, this.config.maximum);
        return true;
    }

    tick(delta) {
        if (!this.ownerId || !Number.isFinite(delta) || delta <= 0) return this.snapshot();
        this.amount = clamp(this.amount + delta * this.config.recoveryPerSecond, 0, this.config.maximum);
        return this.snapshot();
    }

    gainFromAbilityUse(ownerId) {
        if (!ownerId || ownerId !== this.ownerId) return false;
        this.amount = clamp(this.amount + this.config.abilityUseGain, 0, this.config.maximum);
        return true;
    }

    canSpend(cost = this.config.launchCost) {
        return Number.isFinite(cost) && cost > 0 && this.amount >= cost;
    }

    spend(cost = this.config.launchCost) {
        if (!this.canSpend(cost)) return false;
        this.amount -= cost;
        return true;
    }

    snapshot() {
        return Object.freeze({
            ownerId: this.ownerId,
            amount: this.amount,
            maximum: this.config.maximum,
            launchCost: this.config.launchCost
        });
    }
}
