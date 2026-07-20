function normalizeLifeCount(value) {
    return Math.max(1, Math.floor(Number(value) || 1));
}

/** 한 전투에서 특정 전투원에게만 적용되는 추가 생명 상태를 소유한다. */
export class CombatLifePool {
    constructor({ fighterId, total = 1 } = {}) {
        this.fighterId = fighterId ?? null;
        this.total = normalizeLifeCount(total);
        this.remaining = this.total;
    }

    belongsTo(fighter) {
        return Boolean(fighter && this.fighterId && fighter.id === this.fighterId);
    }

    canRevive(fighter) {
        return this.belongsTo(fighter) && this.remaining > 1;
    }

    consume(fighter) {
        if (!this.belongsTo(fighter) || this.remaining <= 0) return null;
        const canRevive = this.canRevive(fighter);
        this.remaining -= 1;
        return { ...this.getState(), canRevive };
    }

    getState(fighterId = this.fighterId) {
        if (!this.fighterId || fighterId !== this.fighterId) return null;
        return {
            fighterId: this.fighterId,
            total: this.total,
            remaining: this.remaining
        };
    }
}
