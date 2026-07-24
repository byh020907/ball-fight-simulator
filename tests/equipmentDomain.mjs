import assert from "node:assert/strict";
import { createDefaultPlayerProfile, migratePlayerProfile, PROFILE_VERSION } from "../src/playerProfile.js";
import {
    EQUIPMENT_TEMPLATES,
    calculateCombinationCost,
    getEquipmentTemplate,
    validateEquipmentTemplateRegistry
} from "../src/hunting/equipmentTemplates.js";
import {
    addEquipmentQuantity,
    craftEquipmentTemplate,
    equipEquipmentTemplate,
    getEquipmentRecipePreview,
    getEquippedEquipmentTemplateIds,
    getEquippedEquipmentStats,
    removeEquipmentQuantity,
    sortEquipmentInventory
} from "../src/hunting/equipmentInventory.js";
import {
    CombatEquipmentSet,
    EquipmentChargeStore,
    EquipmentCooldown,
    EquipmentMovementDistanceTracker,
    EquipmentTimedWindow
} from "../src/hunting/equipmentRuntime.js";
import { Ability } from "../src/abilities/ability.js";
import { AbilitySet } from "../src/abilities/abilitySet.js";
import { applyEquipmentStats } from "../src/hunting/equipmentConfig.js";
import { createRoster } from "../src/roster.js";
import { BattleBall } from "../src/entities/battleBall.js";
import { Vector2 } from "../src/core.js";

assert.equal(EQUIPMENT_TEMPLATES.length, 39);
assert.deepEqual(
    EQUIPMENT_TEMPLATES.reduce(
        (counts, template) => ({ ...counts, [template.tier]: (counts[template.tier] ?? 0) + 1 }),
        {}
    ),
    { basic: 15, intermediate: 12, completed: 12 }
);
assert.equal(validateEquipmentTemplateRegistry().valid, true);
assert.ok(EQUIPMENT_TEMPLATES.every((template) => template.recipe.length <= 3));
assert.equal(calculateCombinationCost([getEquipmentTemplate("attack_sword"), getEquipmentTemplate("crit_cloak")]), 100);

const profile = createDefaultPlayerProfile();
profile.hunting.shards = 1_000;
assert.equal(addEquipmentQuantity(profile, "attack_sword", 100).count, 100);
assert.equal(addEquipmentQuantity(profile, "attack_sword").reason, "capacity");
assert.equal(removeEquipmentQuantity(profile, "attack_sword", 98).count, 2);
assert.equal(addEquipmentQuantity(profile, "crit_cloak", 2).count, 2);
const preview = getEquipmentRecipePreview(profile, "intermediate_attack_crit");
assert.equal(preview.canCraft, true);
assert.equal(preview.combineCost, 100);
assert.equal(craftEquipmentTemplate(profile, "intermediate_attack_crit").ok, true);
assert.equal(profile.equipment.inventory.intermediate_attack_crit, 1);
assert.equal(profile.hunting.shards, 900);
assert.equal(equipEquipmentTemplate(profile, "intermediate_attack_crit", 0).ok, true);
assert.equal(getEquippedEquipmentStats(profile).damage, 2);
assert.equal(getEquippedEquipmentStats(profile).criticalChance, 21);
sortEquipmentInventory(profile);

for (const template of EQUIPMENT_TEMPLATES.filter((candidate) => candidate.tier === "basic").slice(0, 5)) {
    addEquipmentQuantity(profile, template.id);
    assert.equal(equipEquipmentTemplate(profile, template.id).ok, true);
}
assert.equal(equipEquipmentTemplate(profile, "attack_sword").reason, "slot");

const completeProfile = createDefaultPlayerProfile();
addEquipmentQuantity(completeProfile, "completed_ability_crit", 2);
assert.equal(equipEquipmentTemplate(completeProfile, "completed_ability_crit", 0).ok, true);
assert.equal(equipEquipmentTemplate(completeProfile, "completed_ability_crit", 1).reason, "completed_duplicate");

const v11 = { ...createDefaultPlayerProfile(), version: 11 };
assert.deepEqual(migratePlayerProfile(v11).equipment, createDefaultPlayerProfile().equipment);
const roundTrip = migratePlayerProfile(createDefaultPlayerProfile());
assert.equal(roundTrip.version, PROFILE_VERSION);
assert.deepEqual(roundTrip.equipment, createDefaultPlayerProfile().equipment);
const persistedEquipment = migratePlayerProfile({
    ...createDefaultPlayerProfile(),
    equipment: {
        inventory: { attack_sword: 1 },
        equipped: ["attack_sword", null, null, null, null, null],
        stats: { damage: 999 },
        recipe: ["attack_sword"],
        passive: { id: "ability_crit" }
    }
}).equipment;
assert.deepEqual(persistedEquipment, {
    inventory: { attack_sword: 1 },
    equipped: ["attack_sword", null, null, null, null, null]
});
assert.equal(/"(stats|recipe|passive)"/.test(JSON.stringify(persistedEquipment)), false);

const runtimeOwner = { id: "runtime-owner" };
const duplicateRuntimeSet = new CombatEquipmentSet(runtimeOwner, ["attack_sword", "attack_sword"]);
assert.equal(duplicateRuntimeSet.activeRuntimes.length, 2);
assert.notEqual(duplicateRuntimeSet.runtimes[0], duplicateRuntimeSet.runtimes[1]);
assert.notEqual(duplicateRuntimeSet.runtimes[0].charge, duplicateRuntimeSet.runtimes[1].charge);
duplicateRuntimeSet.runtimes[0].charge.gain();
assert.equal(duplicateRuntimeSet.runtimes[0].charge.current, 1);
assert.equal(duplicateRuntimeSet.runtimes[1].charge.current, 0);

const completedRuntimeSet = new CombatEquipmentSet(runtimeOwner, ["completed_ability_crit", "completed_vital_heat"]);
assert.notEqual(completedRuntimeSet.runtimes[0].cooldown, completedRuntimeSet.runtimes[1].cooldown);
assert.equal(completedRuntimeSet.runtimes[0].template, getEquipmentTemplate("completed_ability_crit"));

const charge = new EquipmentChargeStore({ maximum: 2, initial: 1 });
assert.equal(charge.gain(3), 1);
assert.equal(charge.consume(2), true);
const cooldown = new EquipmentCooldown(2);
assert.equal(cooldown.ready, true);
cooldown.trigger();
cooldown.tick(2);
assert.equal(cooldown.ready, true);
const window = new EquipmentTimedWindow();
window.open(1);
window.tick(1);
assert.equal(window.active, false);
const distance = new EquipmentMovementDistanceTracker(10);
assert.equal(distance.add(12, "teleport"), false);
assert.equal(distance.distance, 0);
assert.equal(distance.add(10, "dash"), true);
assert.equal(distance.consumeThreshold(), true);

const observedEvents = [];
const observedRuntime = completedRuntimeSet.runtimes[0];
observedRuntime.passive = Object.fromEntries(
    ["update", "abilityUsed", "enemyCollisionResolved", "staticBounce", "validMovement", "battleEnded"].map(
        (eventName) => [eventName, () => observedEvents.push(eventName)]
    )
);
completedRuntimeSet.update(0.1, {});
completedRuntimeSet.abilityUsed({});
completedRuntimeSet.enemyCollisionResolved({});
completedRuntimeSet.staticBounce({});
completedRuntimeSet.validMovement({});
completedRuntimeSet.battleEnded({});
assert.deepEqual(observedEvents, [
    "update",
    "abilityUsed",
    "enemyCollisionResolved",
    "staticBounce",
    "validMovement",
    "battleEnded"
]);

let equipmentDamageOptions = null;
const damageTarget = {
    takeDamage(_amount, _source, _label, options) {
        equipmentDamageOptions = options;
        completedRuntimeSet.enemyCollisionResolved({ damage: options.equipmentDamage });
        return { actualDamage: 3, absorbedDamage: 0, isCritical: false };
    }
};
assert.equal(completedRuntimeSet.dealEquipmentDamage(damageTarget, 3).actualDamage, 3);
assert.equal(equipmentDamageOptions.equipmentDamage.origin, "equipment");
assert.equal(observedEvents.filter((eventName) => eventName === "enemyCollisionResolved").length, 1);

const abilityOwner = { combatEquipment: { abilityUsed: () => observedEvents.push("ability-used-once") } };
const ability = new Ability(abilityOwner, {}, 1);
new AbilitySet(abilityOwner, { primary: ability });
ability.setCooldownRemaining(0);
ability.resetCooldown();
ability.setCooldownRemaining(0);
ability.tickStandby(0.1);
assert.equal(observedEvents.filter((eventName) => eventName === "ability-used-once").length, 1);

assert.deepEqual(getEquippedEquipmentTemplateIds({ equipment: persistedEquipment }), [
    "attack_sword",
    null,
    null,
    null,
    null,
    null
]);
assert.equal(
    /"(stats|recipe|passive(Id)?|cooldown|charge|timer|distance)"/.test(JSON.stringify(persistedEquipment)),
    false
);

const combatProfile = createDefaultPlayerProfile();
addEquipmentQuantity(combatProfile, "attack_sword", 2);
equipEquipmentTemplate(combatProfile, "attack_sword", 0);
equipEquipmentTemplate(combatProfile, "attack_sword", 1);
const combatSpec = applyEquipmentStats(createRoster()[0], combatProfile);
const firstBattleBall = new BattleBall(combatSpec, new Vector2(0, 0));
const secondBattleBall = new BattleBall(combatSpec, new Vector2(0, 0));
assert.equal(firstBattleBall.combatEquipment.activeRuntimes.length, 2);
assert.notEqual(firstBattleBall.combatEquipment.runtimes[0], firstBattleBall.combatEquipment.runtimes[1]);
assert.notEqual(firstBattleBall.combatEquipment.runtimes[0], secondBattleBall.combatEquipment.runtimes[0]);

firstBattleBall.stats.criticalChance = 1;
const equipmentDamageTarget = new BattleBall(combatSpec, new Vector2(0, 0));
const originalRandom = Math.random;
let equipmentDamageResult;
try {
    Math.random = () => 0;
    equipmentDamageResult = firstBattleBall.combatEquipment.dealEquipmentDamage(equipmentDamageTarget, 10);
} finally {
    Math.random = originalRandom;
}
assert.equal(equipmentDamageResult.isCritical, false);

const movementEvents = [];
const movementBall = new BattleBall(combatSpec, new Vector2(0, 0));
movementBall.velocity = new Vector2(12, 0);
movementBall.combatEquipment.validMovement = (context) => movementEvents.push(context);
movementBall.update(1, {
    elapsed: 0,
    getOpponent: () => null,
    keepInsideArena: (fighter) => {
        fighter.position = new Vector2(0, 0);
    }
});
assert.equal(movementEvents.length, 1);
assert.ok(movementEvents[0].distance > 0);
assert.equal(movementBall.position.x, 0);

console.log("[equipment-domain] ok");
