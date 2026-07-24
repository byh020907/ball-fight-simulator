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
    getEquippedEquipmentStats,
    removeEquipmentQuantity,
    sortEquipmentInventory
} from "../src/hunting/equipmentInventory.js";

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

console.log("[equipment-domain] ok");
