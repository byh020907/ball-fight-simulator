export const LINEAR_VELOCITY_POLICY = Object.freeze({
    recoveryRate: 5.5,
    frictionRetentionPerSecond: 0.65
});

export function resolveLinearVelocityPolicy({
    currentSpeed,
    referenceSpeed,
    delta,
    recoveryBonus = 0,
    policy = LINEAR_VELOCITY_POLICY
} = {}) {
    const current = Math.max(0, Number.isFinite(currentSpeed) ? currentSpeed : 0);
    const reference = Math.max(0, Number.isFinite(referenceSpeed) ? referenceSpeed : 0);
    const elapsed = Math.max(0, Number.isFinite(delta) ? delta : 0);
    if (current <= reference) {
        const bonus = Math.max(0, Number.isFinite(recoveryBonus) ? recoveryBonus : 0);
        const recoveryRate = Math.max(0, Number(policy?.recoveryRate) || 0) * (1 + bonus);
        return {
            mode: "recovery",
            nextSpeed: current + (reference - current) * (1 - Math.exp(-recoveryRate * elapsed)),
            blend: 1 - Math.exp(-recoveryRate * elapsed)
        };
    }

    const retention = Math.max(0, Math.min(1, Number(policy?.frictionRetentionPerSecond) || 0));
    return {
        mode: "friction",
        nextSpeed: Math.max(reference, current * Math.pow(retention, elapsed)),
        blend: 0
    };
}
