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
import {
    calculateDefenseConversionAttackBonus,
    calculateMassExecutionDamage,
    calculateSpeedAngularDamage,
    calculateVitalOverwhelmDamage
} from "../src/hunting/equipmentPassives.js";
import { Ability } from "../src/abilities/ability.js";
import { AbilitySet } from "../src/abilities/abilitySet.js";
import {
    applyEquipmentStats,
    getEquipmentAngularImpulseEffectiveBonus,
    getEquipmentMassEffectiveBonus,
    getEquipmentWallBounceEffectiveBonus
} from "../src/hunting/equipmentConfig.js";
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

const baseCombatSpec = createRoster()[0];
const statProfile = createDefaultPlayerProfile();
const statTemplateIds = [
    "health_crystal",
    "attack_sword",
    "defense_leather",
    "haste_mote",
    "speed_boots",
    "crit_cloak"
];
for (const [slotIndex, templateId] of statTemplateIds.entries()) {
    addEquipmentQuantity(statProfile, templateId);
    equipEquipmentTemplate(statProfile, templateId, slotIndex);
}
const statSpec = applyEquipmentStats(baseCombatSpec, statProfile);
const statSnapshot = statSpec.equipment.combatStats;
assert.equal(statSpec.stats.hp, baseCombatSpec.stats.hp + getEquipmentTemplate("health_crystal").stats.hp);
assert.equal(statSpec.stats.damage, baseCombatSpec.stats.damage + getEquipmentTemplate("attack_sword").stats.damage);
assert.equal(
    statSpec.stats.defense,
    baseCombatSpec.stats.defense + getEquipmentTemplate("defense_leather").stats.defense
);
assert.equal(statSpec.stats.skill, (baseCombatSpec.stats.skill ?? 0) + getEquipmentTemplate("haste_mote").stats.skill);
assert.equal(statSpec.stats.criticalChance, 5 + getEquipmentTemplate("crit_cloak").stats.criticalChance);
assert.equal(statSnapshot.speed.beforeEquipment, baseCombatSpec.stats.speed);
assert.equal(statSnapshot.speed.afterEquipment, statSpec.stats.speed);
assert.ok(statSnapshot.speed.increaseRatio > 0);
assert.equal(Object.isFrozen(statSnapshot), true);
assert.equal(Object.isFrozen(statSnapshot.speed), true);
const skillBall = new BattleBall(statSpec, new Vector2(0, 0));
assert.equal(skillBall.getSkillPoints(), statSpec.stats.skill);
assert.equal(new Ability(skillBall, null, 100).cooldown, (100 * 100) / (100 + statSpec.stats.skill));
assert.equal(skillBall.getEquipmentCombatStats(), statSnapshot);
assert.equal(skillBall.combatEquipment.getCombatStats(), statSnapshot);

const completedProfile = createDefaultPlayerProfile();
addEquipmentQuantity(completedProfile, "completed_ability_crit");
equipEquipmentTemplate(completedProfile, "completed_ability_crit", 0);
const completedSpec = applyEquipmentStats(baseCombatSpec, completedProfile);
const completedTemplate = getEquipmentTemplate("completed_ability_crit");
assert.equal(completedSpec.stats.damage, baseCombatSpec.stats.damage + (completedTemplate.stats.damage ?? 0));
assert.equal(completedSpec.stats.criticalChance, 5 + completedTemplate.stats.criticalChance);

const cappedCriticalProfile = createDefaultPlayerProfile();
addEquipmentQuantity(cappedCriticalProfile, "crit_twin_blades", 6);
for (const slotIndex of [0, 1, 2, 3, 4, 5])
    equipEquipmentTemplate(cappedCriticalProfile, "crit_twin_blades", slotIndex);
assert.equal(applyEquipmentStats(baseCombatSpec, cappedCriticalProfile).stats.criticalChance, 100);

const physicsProfile = createDefaultPlayerProfile();
const physicsTemplateIds = ["mass_weight", "wall_spring", "collision_gyro"];
for (const [slotIndex, templateId] of physicsTemplateIds.entries()) {
    addEquipmentQuantity(physicsProfile, templateId);
    equipEquipmentTemplate(physicsProfile, templateId, slotIndex);
}
const physicsSpec = applyEquipmentStats(baseCombatSpec, physicsProfile);
const physicsSnapshot = physicsSpec.equipment.combatStats;
assert.equal(physicsSnapshot.mass.effectiveBonus, getEquipmentMassEffectiveBonus(14));
assert.equal(physicsSnapshot.wallBounce.effectiveBonus, getEquipmentWallBounceEffectiveBonus(14));
assert.equal(physicsSnapshot.angularImpulse.effectiveBonus, getEquipmentAngularImpulseEffectiveBonus(14));
assert.ok(physicsSnapshot.mass.effectiveBonus < 1);
assert.ok(physicsSnapshot.wallBounce.effectiveBonus < 0.6);
const physicsBall = new BattleBall(physicsSpec, new Vector2(0, 0));
assert.equal(physicsBall.mass, baseCombatSpec.stats.mass * (1 + physicsSnapshot.mass.effectiveBonus));
assert.equal(physicsBall.equipmentEffects.wallBounceMultiplier, 1 + physicsSnapshot.wallBounce.effectiveBonus);
assert.equal(
    physicsBall.equipmentEffects.collisionAngularMultiplier,
    1 + physicsSnapshot.angularImpulse.effectiveBonus
);

const legacyEquipmentSpec = applyEquipmentStats(baseCombatSpec, { equipment: { inventory: [], equipped: {} } });
assert.equal(legacyEquipmentSpec.equipment.combatStats, undefined);

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

assert.deepEqual([0, 12, 24, 36].map(calculateDefenseConversionAttackBonus), [0, 0.5, 1, 1.5]);
assert.equal(calculateMassExecutionDamage(40, 0.25), 30);
assert.equal(calculateSpeedAngularDamage(40, 0.5), 7);
assert.deepEqual(
    [100, 50, 0].map((hp) => calculateVitalOverwhelmDamage(100, hp, 100)),
    [2.5, 1.75, 1]
);

const passiveCombatStats = Object.freeze({
    hp: 100,
    defense: 36,
    speed: Object.freeze({ increaseRatio: 0.5 }),
    mass: Object.freeze({ effectiveBonus: 0.25 })
});
const passiveOwner = {
    hp: 100,
    maxHp: 100,
    getEquipmentCombatStats: () => passiveCombatStats,
    getTotalAttackDamage: () => 40
};
const passiveEvents = [];
const passiveTarget = {
    takeDamage(amount, source, label, options) {
        passiveEvents.push({ amount, source, label, options });
        source.combatEquipment.enemyCollisionResolved({ damage: options.equipmentDamage });
        return { actualDamage: amount, absorbedDamage: 0, isCritical: false };
    }
};
const defenseConversionSet = new CombatEquipmentSet(passiveOwner, ["completed_defense_conversion"]);
assert.equal(defenseConversionSet.getAttackDamageBonus(), 1.5);
assert.equal(defenseConversionSet.getAttackDamageBonus(), 1.5);

const executionSet = new CombatEquipmentSet(passiveOwner, ["completed_mass_execution"]);
passiveOwner.combatEquipment = executionSet;
executionSet.enemyCollisionResolved({ target: passiveTarget, targetHpRatioBefore: 0.35, isCritical: true });
executionSet.enemyCollisionResolved({ target: passiveTarget, targetHpRatioBefore: 0.351, isCritical: true });
executionSet.enemyCollisionResolved({ target: passiveTarget, targetHpRatioBefore: 0.35, isCritical: false });
assert.deepEqual(
    passiveEvents.map(({ amount, label, options }) => [amount, label, options.equipmentDamage.sourceTemplateId]),
    [[30, "종언의 추락", "completed_mass_execution"]]
);
const defendedTarget = new BattleBall(
    { ...baseCombatSpec, stats: { ...baseCombatSpec.stats, hp: 100, defense: 100 } },
    new Vector2(0, 0)
);
const defendedHpBefore = defendedTarget.hp;
executionSet.enemyCollisionResolved({ target: defendedTarget, targetHpRatioBefore: 0.35, isCritical: true });
assert.equal(defendedHpBefore - defendedTarget.hp, 15);

passiveEvents.length = 0;
const speedAngularSet = new CombatEquipmentSet(passiveOwner, ["completed_speed_angular"]);
passiveOwner.combatEquipment = speedAngularSet;
passiveOwner.velocity = new Vector2(1, 0);
speedAngularSet.enemyCollisionResolved({ target: passiveTarget });
passiveOwner.velocity = new Vector2(9_999, 0);
speedAngularSet.enemyCollisionResolved({ target: passiveTarget });
assert.deepEqual(
    passiveEvents.map(({ amount, label }) => [amount, label]),
    [
        [7, "천공의 나선"],
        [7, "천공의 나선"]
    ]
);

passiveEvents.length = 0;
const vitalOverwhelmSet = new CombatEquipmentSet(passiveOwner, ["completed_vital_overwhelm"]);
passiveOwner.combatEquipment = vitalOverwhelmSet;
for (const hp of [100, 50, 0]) {
    passiveOwner.hp = hp;
    vitalOverwhelmSet.enemyCollisionResolved({ target: passiveTarget });
}
assert.deepEqual(
    passiveEvents.map(({ amount, label }) => [amount, label]),
    [
        [2.5, "적룡의 심갑"],
        [1.75, "적룡의 심갑"],
        [1, "적룡의 심갑"]
    ]
);

const defenseConversionProfile = createDefaultPlayerProfile();
for (const [slotIndex, templateId] of ["completed_defense_conversion", "defense_chain", "defense_leather"].entries()) {
    addEquipmentQuantity(defenseConversionProfile, templateId);
    equipEquipmentTemplate(defenseConversionProfile, templateId, slotIndex);
}
const defenseConversionSpec = applyEquipmentStats(baseCombatSpec, defenseConversionProfile);
const defenseConversionBall = new BattleBall(defenseConversionSpec, new Vector2(0, 0));
const defenseConversionBonus = calculateDefenseConversionAttackBonus(
    defenseConversionSpec.equipment.combatStats.defense
);
assert.equal(defenseConversionBall.getTotalAttackDamage(), defenseConversionSpec.stats.damage + defenseConversionBonus);
assert.equal(defenseConversionBall.stats.baseDamage, defenseConversionBall.getTotalAttackDamage());

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
