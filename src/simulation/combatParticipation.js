export const COMBAT_PARTICIPATION_MODES = Object.freeze({
    ACTIVE: "active",
    STANDBY: "standby",
    SUPPORT: "support",
    WITHDRAWING: "withdrawing"
});

const MODE_POLICIES = Object.freeze({
    [COMBAT_PARTICIPATION_MODES.ACTIVE]: Object.freeze({
        canAct: true,
        canBeTargeted: true,
        countsForResult: true
    }),
    [COMBAT_PARTICIPATION_MODES.STANDBY]: Object.freeze({
        canAct: false,
        canBeTargeted: false,
        countsForResult: false
    }),
    [COMBAT_PARTICIPATION_MODES.SUPPORT]: Object.freeze({
        canAct: true,
        canBeTargeted: true,
        countsForResult: false
    }),
    [COMBAT_PARTICIPATION_MODES.WITHDRAWING]: Object.freeze({
        canAct: false,
        canBeTargeted: true,
        countsForResult: false
    })
});

function normalizeMode(mode) {
    return MODE_POLICIES[mode] ? mode : COMBAT_PARTICIPATION_MODES.ACTIVE;
}

export class CombatParticipation {
    constructor({ mode = COMBAT_PARTICIPATION_MODES.ACTIVE, abilityTimeScale = 1 } = {}) {
        this.mode = normalizeMode(mode);
        this.abilityTimeScale = Number.isFinite(abilityTimeScale) ? Math.max(0, abilityTimeScale) : 1;
    }

    get policy() {
        return MODE_POLICIES[this.mode];
    }

    get canAct() {
        return this.policy.canAct;
    }

    get canBeTargeted() {
        return this.policy.canBeTargeted;
    }

    get countsForResult() {
        return this.policy.countsForResult;
    }

    setMode(mode) {
        this.mode = normalizeMode(mode);
        return this;
    }

    requestWithdrawal() {
        return this.setMode(COMBAT_PARTICIPATION_MODES.WITHDRAWING);
    }

    canLeave(abilities) {
        return this.mode === COMBAT_PARTICIPATION_MODES.WITHDRAWING && abilities?.canSafelyDeactivate?.() !== false;
    }
}
