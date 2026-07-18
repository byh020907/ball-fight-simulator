import archer from "./definitions/archer.js";
import orbit from "./definitions/orbit.js";
import trickster from "./definitions/trickster.js";
import grenade from "./definitions/grenade.js";
import dash from "./definitions/dash.js";
import rage from "./definitions/rage.js";
import spin from "./definitions/spin.js";
import eater from "./definitions/eater.js";
import batBall from "./definitions/batBall.js";
import vampire from "./definitions/vampire.js";
import gunner from "./definitions/gunner.js";
import phantom from "./definitions/phantom.js";
import hero from "./definitions/hero.js";
import elementalist from "./definitions/elementalist.js";

export const CHARACTER_DEFINITIONS = Object.freeze([
    archer,
    orbit,
    trickster,
    grenade,
    dash,
    rage,
    spin,
    eater,
    batBall,
    vampire,
    gunner,
    phantom,
    hero,
    elementalist
]);

const REQUIRED_FIELDS = Object.freeze([
    "key",
    "id",
    "displayName",
    "title",
    "abilityId",
    "abilityDisplayName",
    "abilityClass",
    "roster",
    "levelRewards",
    "abilityGrowth",
    "abilityUpgrade",
    "mastery",
    "availability",
    "rebirth",
    "collection"
]);

export function validateCharacterDefinitions(definitions = CHARACTER_DEFINITIONS) {
    const ids = new Set();
    const abilityIds = new Set();
    const keys = new Set();
    for (const definition of definitions) {
        const missing = REQUIRED_FIELDS.filter((field) => definition?.[field] == null);
        if (missing.length > 0)
            throw new Error(`Character definition ${definition?.id ?? "<unknown>"} missing: ${missing}`);
        if (ids.has(definition.id) || abilityIds.has(definition.abilityId) || keys.has(definition.key)) {
            throw new Error(`Duplicate character definition: ${definition.id}`);
        }
        if (!Array.isArray(definition.levelRewards) || definition.levelRewards.length === 0) {
            throw new Error(`Character definition ${definition.id} requires level rewards`);
        }
        if (
            !Array.isArray(definition.abilityGrowth) ||
            definition.abilityGrowth.length !== 4 ||
            definition.abilityGrowth.some((growth, index) => growth.abilityTier !== index)
        ) {
            throw new Error(`Character definition ${definition.id} requires four ordered ability growth tiers`);
        }
        ids.add(definition.id);
        abilityIds.add(definition.abilityId);
        keys.add(definition.key);
    }
    return true;
}

validateCharacterDefinitions();

const BY_ID = new Map(CHARACTER_DEFINITIONS.map((definition) => [definition.id, definition]));
const BY_ABILITY = new Map(CHARACTER_DEFINITIONS.map((definition) => [definition.abilityId, definition]));

export const FIGHTER_IDS = Object.freeze(
    Object.fromEntries(CHARACTER_DEFINITIONS.map((definition) => [definition.key, definition.id]))
);

export function getCharacterDefinition(id) {
    return BY_ID.get(id) ?? null;
}

export function getCharacterDefinitionByAbility(abilityId) {
    return BY_ABILITY.get(abilityId) ?? null;
}

export function filterCharacterDefinitions(predicate = () => true) {
    return CHARACTER_DEFINITIONS.filter(predicate);
}
