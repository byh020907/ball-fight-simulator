const ABILITY_DISPLAY_NAMES = Object.freeze({
    none: "Passive",
    archer: "Archer",
    orbit: "Orbit",
    trickster: "Trickster",
    grenade: "Grenade",
    dash: "Dash",
    rage: "Rage",
    spin: "Spin",
    eater: "Eater",
    bat_ball: "Bat Ball",
    hero: "Hero Orb",
    vampire: "Vampire",
    gunner: "Gunner",
    phantom: "Phantom",
    elementalist: "Elementalist",
    hunting_melee: "Melee",
    hunting_mob: "Hunting Mob"
});

export function getAbilityDisplayName(abilityId) {
    return ABILITY_DISPLAY_NAMES[abilityId] ?? abilityId;
}
