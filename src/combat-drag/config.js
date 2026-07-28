export const DRAG_COMBAT_CONFIG = Object.freeze({
    input: Object.freeze({ deadZonePx: 24, maxPullPx: 140, maxAimSeconds: 1.2 }),
    shot: Object.freeze({
        minSpeedRatio: 1.65,
        maxSpeedRatio: 4.8,
        releaseSpeedMultiplier: 1,
        shotMaxSeconds: 2.4,
        shotSlowSpeed: 90,
        shotSlowBaseSpeedRatio: 0.3,
        shotSlowSeconds: 0.18,
        bounceDebounceSeconds: 0.08
    }),
    shield: Object.freeze({
        durationSeconds: 0.8,
        frontIncomingMultiplier: 1.5,
        frontRecoilSpeedRatio: 1.6,
        frontInputLockSeconds: 0.27,
        ricochetOneMultiplier: 1,
        ricochetTwoMultiplier: 1.45,
        ricochetThreeOrMoreMultiplier: 1.9,
        ricochetThreeOrMoreStaggerSeconds: 0.45
    }),
    enemy: Object.freeze({
        windupSeconds: 1,
        flightMaxSeconds: 1.8,
        attackSpeedMin: 520,
        attackSpeedRatio: 2.05,
        attackDamageMultiplier: 1.35,
        enemyHealthMultiplier: 0.88,
        enemyGroupHealthExponent: 3
    })
});

export const DRAG_RELEASE_SPEED_TUNING = Object.freeze({
    defaultMultiplier: 1,
    minMultiplier: 0.6,
    maxMultiplier: 1.8,
    step: 0.05
});

export function clampDragReleaseSpeedMultiplier(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DRAG_RELEASE_SPEED_TUNING.defaultMultiplier;
    return Math.min(
        DRAG_RELEASE_SPEED_TUNING.maxMultiplier,
        Math.max(DRAG_RELEASE_SPEED_TUNING.minMultiplier, numeric)
    );
}

export function createDragCombatConfig(releaseSpeedMultiplier = DRAG_RELEASE_SPEED_TUNING.defaultMultiplier) {
    return Object.freeze({
        ...DRAG_COMBAT_CONFIG,
        shot: Object.freeze({
            ...DRAG_COMBAT_CONFIG.shot,
            releaseSpeedMultiplier: clampDragReleaseSpeedMultiplier(releaseSpeedMultiplier)
        })
    });
}

export function getDragLaunchSpeed(baseSpeed, strength, shotConfig = DRAG_COMBAT_CONFIG.shot) {
    const safeBaseSpeed = Math.max(0, Number.isFinite(baseSpeed) ? baseSpeed : 0);
    const safeStrength = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0));
    const minSpeedRatio = Math.max(0, Number.isFinite(shotConfig?.minSpeedRatio) ? shotConfig.minSpeedRatio : 0);
    const maxSpeedRatio = Math.max(
        minSpeedRatio,
        Number.isFinite(shotConfig?.maxSpeedRatio) ? shotConfig.maxSpeedRatio : minSpeedRatio
    );
    const releaseSpeedMultiplier = clampDragReleaseSpeedMultiplier(shotConfig?.releaseSpeedMultiplier);
    return safeBaseSpeed * (minSpeedRatio + (maxSpeedRatio - minSpeedRatio) * safeStrength) * releaseSpeedMultiplier;
}

export function getDragEnemyHealthMultiplier(alliedCount, hostileCount, config = DRAG_COMBAT_CONFIG.enemy) {
    const allies = Math.max(1, Number.isFinite(alliedCount) ? alliedCount : 1);
    const hostiles = Math.max(1, Number.isFinite(hostileCount) ? hostileCount : 1);
    const teamRatio = Math.min(1, allies / hostiles);
    return config.enemyHealthMultiplier * teamRatio ** config.enemyGroupHealthExponent;
}
