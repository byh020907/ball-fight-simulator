export const HERO_COMBAT_CONFIG = Object.freeze({
    growth: Object.freeze({
        stackCap: 5,
        stackInterval: 1,
        gainFlashDuration: 0.16,
        releaseFlashDuration: 0.28
    }),
    core: Object.freeze({
        maximumActivePerOwner: 5,
        lifetime: 8,
        speedMinMultiplier: 0.72,
        speedMaxMultiplier: 0.96,
        collectionGraceDuration: 0.16
    }),
    magnet: Object.freeze({
        baseRadiusMultiplier: 2,
        baseResponseRate: 5,
        upgradedRadiusMultiplier: 3,
        upgradedResponseRate: 8,
        attractionSpeedMultiplier: 1.35
    }),
    pursuit: Object.freeze({
        interval: 0.5,
        duration: 0.5,
        speedMultiplier: 1.3
    }),
    armor: Object.freeze({
        shieldPerCoreMaxHpRatio: 0.05,
        maximumShieldMaxHpRatio: 0.5,
        hitFlashDuration: 0.2
    }),
    counter: Object.freeze({
        cooldown: 0.5,
        damageMultiplier: 0.5,
        speedMultiplier: 1.5,
        lifetime: 1.2,
        radius: 9
    }),
    shieldBreak: Object.freeze({
        damageMultiplier: 0.75,
        radius: 190,
        knockbackSpeed: 540,
        knockbackDuration: 0.35,
        visualDuration: 0.45
    })
});
