export const DRAG_COMBAT_CONFIG = Object.freeze({
    input: Object.freeze({ deadZonePx: 24, maxPullPx: 140, maxAimSeconds: 1.2, cooldownSeconds: 2 }),
    shot: Object.freeze({
        minSpeedRatio: 0.85,
        maxSpeedRatio: 2.2,
        shotMaxSeconds: 2.4,
        shotSlowSpeed: 90,
        shotSlowSeconds: 0.2,
        bounceDebounceSeconds: 0.08
    }),
    shield: Object.freeze({
        frontIncomingMultiplier: 1.5,
        frontRecoilSpeedRatio: 1.6,
        frontInputLockSeconds: 0.45,
        ricochetOneMultiplier: 1,
        ricochetTwoMultiplier: 1.45,
        ricochetThreeOrMoreMultiplier: 1.9,
        ricochetThreeOrMoreStaggerSeconds: 0.45
    }),
    enemy: Object.freeze({
        windupSeconds: 1,
        flightMaxSeconds: 1.8,
        attackSpeedMin: 520,
        attackSpeedRatio: 1.8,
        attackDamageMultiplier: 1.35,
        enemyHealthMultiplier: 0.5,
        enemyGroupHealthExponent: 3
    })
});

export function getDragEnemyHealthMultiplier(alliedCount, hostileCount, config = DRAG_COMBAT_CONFIG.enemy) {
    const allies = Math.max(1, Number.isFinite(alliedCount) ? alliedCount : 1);
    const hostiles = Math.max(1, Number.isFinite(hostileCount) ? hostileCount : 1);
    const teamRatio = Math.min(1, allies / hostiles);
    return config.enemyHealthMultiplier * teamRatio ** config.enemyGroupHealthExponent;
}
