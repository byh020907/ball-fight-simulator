export const BASE_SPEED_MULTIPLIER = 1.5;

const DEFAULT_AVAILABILITY = Object.freeze({ unlockType: null });
const DEFAULT_REBIRTH = Object.freeze({ actionEligible: true, subAction: null });

function freezeRoster(config) {
    const stats = Object.freeze({
        ...config.stats,
        speed: config.stats.speed * BASE_SPEED_MULTIPLIER
    });
    return Object.freeze({
        id: config.id,
        name: config.name,
        title: config.title,
        description: config.description,
        color: config.color,
        face: config.face ?? config.id,
        ability: config.abilityId ?? config.id,
        ...(config.physicsMaterial ? { physicsMaterial: config.physicsMaterial } : {}),
        stats
    });
}

function createAbilityGrowth(config, levelRewards) {
    const baseGrowth = Object.freeze({
        level: 1,
        abilityTier: 0,
        gameText: config.baseAbilityText ?? config.description
    });
    const evolvedGrowth = levelRewards
        .filter((reward) => Number.isInteger(reward.abilityTier) && reward.abilityTier > 0)
        .map((reward) =>
            Object.freeze({
                level: reward.level,
                abilityTier: reward.abilityTier,
                gameText: reward.gameText
            })
        );
    return Object.freeze([baseGrowth, ...evolvedGrowth]);
}

function freezeLevelRewards(levelRewards) {
    if (!Array.isArray(levelRewards)) return Object.freeze([]);
    return Object.freeze(levelRewards.map((reward) => Object.freeze({ ...reward })));
}

function freezeAbilityUpgrade(abilityUpgrade) {
    if (!abilityUpgrade || !Array.isArray(abilityUpgrade.tiers)) return null;
    return Object.freeze({
        ...(abilityUpgrade.base ? { base: Object.freeze({ ...abilityUpgrade.base }) } : {}),
        tiers: Object.freeze(abilityUpgrade.tiers.map((tier) => Object.freeze({ ...tier })))
    });
}

export function createCharacterDefinition(config) {
    const abilityId = config.abilityId ?? config.id;
    const levelRewards = freezeLevelRewards(config.levelRewards);
    const abilityUpgrade = freezeAbilityUpgrade(config.abilityUpgrade);
    return Object.freeze({
        key: config.key,
        id: config.id,
        displayName: config.name,
        title: config.title,
        abilityId,
        abilityDisplayName: config.abilityDisplayName,
        abilityClass: config.abilityClass,
        roster: freezeRoster({ ...config, abilityId }),
        levelRewards,
        abilityGrowth: createAbilityGrowth(config, levelRewards),
        abilityUpgrade,
        mastery: Object.freeze({ ...config.mastery }),
        availability: Object.freeze({ ...DEFAULT_AVAILABILITY, ...config.availability }),
        rebirth: Object.freeze({ ...DEFAULT_REBIRTH, ...config.rebirth }),
        collection: Object.freeze({ description: config.description })
    });
}
