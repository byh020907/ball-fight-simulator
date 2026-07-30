import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { aggregateBattleMetrics, BattleMetricsRecorder } from "../src/simulation/battleMetrics.js";
import { EquipmentRuntime } from "../src/hunting/equipmentRuntime.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";

const empty = aggregateBattleMetrics([]);
assert.deepEqual(empty.duration, { average: 0, median: 0, p10: 0, p90: 0 });
assert.equal(empty.winRate, 0);
assert.equal(empty.equipmentDirectDamageRatio, 0);

const recorder = new BattleMetricsRecorder();
recorder.trackEquipment("completed_ability_crit", "rage");
recorder.recordDamage({
    sourceId: "rage",
    targetId: "mob",
    label: "기본 충돌",
    actualDamage: 12,
    absorbedDamage: 3,
    origin: "combat",
    elapsed: 2
});
recorder.recordDamage({
    sourceId: "rage",
    targetId: "mob",
    label: "장비 피해",
    actualDamage: 8,
    origin: "equipment",
    sourceTemplateId: "completed_ability_crit",
    elapsed: 3
});
recorder.recordEquipmentPassiveTrigger({ templateId: "completed_ability_crit", passiveId: "ability_crit" });
const snapshot = recorder.snapshot({
    elapsed: 10,
    winner: { id: "rage" },
    fighters: [
        { id: "rage", hp: 80, maxHp: 100 },
        { id: "mob", hp: 0, maxHp: 100 }
    ],
    focalFighterId: "rage"
});
assert.deepEqual(snapshot.fighters.rage, { hpRatio: 0.8, dealt: 20, taken: 0 });
assert.deepEqual(snapshot.damageByLabel["기본 충돌"], { damage: 12, hits: 1, absorbed: 3 });
assert.deepEqual(snapshot.damageByOrigin.equipment, { damage: 8, hits: 1, absorbed: 0 });
assert.deepEqual(snapshot.equipment.completed_ability_crit, {
    directDamage: 8,
    hits: 1,
    triggers: 1,
    ownerId: "rage",
    ownerDamage: 20
});

const aggregate = aggregateBattleMetrics([
    snapshot,
    { ...snapshot, elapsed: 30, winnerId: null, loserId: "rage", timedOut: true },
    { ...snapshot, elapsed: 20, winnerId: null, loserId: null, timedOut: false }
]);
assert.deepEqual(aggregate.duration, { average: 20, median: 20, p10: 10, p90: 30 });
assert.equal(aggregate.sampleCount, 3);
assert.equal(aggregate.wins, 1);
assert.equal(aggregate.losses, 1);
assert.equal(aggregate.draws, 1);
assert.equal(aggregate.timeouts, 1);
assert.equal(aggregate.equipment.completed_ability_crit.triggersPerMatch, 1);
assert.equal(aggregate.equipment.completed_ability_crit.directDamageRatio, 0.4);

const inactiveRecorder = new BattleMetricsRecorder();
inactiveRecorder.trackEquipment("completed_ability_crit", "rage");
inactiveRecorder.recordDamage({ sourceId: "rage", targetId: "mob", actualDamage: 30 });
const inactiveSnapshot = inactiveRecorder.snapshot({
    fighters: [
        { id: "rage", hp: 70, maxHp: 100 },
        { id: "mob", hp: 0, maxHp: 100 }
    ]
});
const activeAndInactiveAggregate = aggregateBattleMetrics([snapshot, inactiveSnapshot]);
assert.equal(activeAndInactiveAggregate.equipment.completed_ability_crit.directDamageRatio, 8 / 50);

function createSimulation(hooks = {}) {
    return new BattleSimulation(
        createRoster()
            .slice(0, 2)
            .map((spec, index) => ({ ...spec, teamId: String(index), ability: "none" })),
        { onLog() {}, onSound() {}, ...hooks },
        null,
        { assignActions: false }
    );
}

const legacyCalls = [];
const resolvedEvents = [];
const hookedSimulation = createSimulation({
    onDamageTaken: (...args) => legacyCalls.push(["taken", ...args]),
    onDamageDealt: (...args) => legacyCalls.push(["dealt", ...args]),
    onHpChanged: (...args) => legacyCalls.push(["hp", ...args]),
    onDamageResolved: (event) => resolvedEvents.push(event)
});
const [source, target] = hookedSimulation.fighters;
source.stats.criticalChance = 0;
const damage = target.takeDamage(20, source, "계측 타격", {
    allowCritical: false,
    equipmentDamage: { origin: "equipment", sourceTemplateId: "completed_ability_crit" }
});
assert.ok(damage.actualDamage > 0);
assert.deepEqual(
    legacyCalls.map(([type]) => type),
    ["taken", "dealt", "hp"]
);
assert.deepEqual(resolvedEvents[0], {
    sourceId: source.id,
    targetId: target.id,
    label: "계측 타격",
    actualDamage: damage.actualDamage,
    absorbedDamage: damage.absorbedDamage,
    isCritical: false,
    origin: "equipment",
    sourceTemplateId: "completed_ability_crit",
    elapsed: 0
});

const unhookedSimulation = createSimulation();
const [plainSource, plainTarget] = unhookedSimulation.fighters;
plainSource.stats.criticalChance = 0;
const plainDamage = plainTarget.takeDamage(20, plainSource, "계측 타격", { allowCritical: false });
assert.equal(plainDamage.actualDamage, damage.actualDamage);
assert.equal(plainTarget.hp, target.maxHp - damage.actualDamage);

const passiveEvents = [];
const runtime = new EquipmentRuntime(0, "completed_ability_crit", { id: "rage", position: new Vector2(0, 0) });
runtime.emitFeedback({
    simulation: {
        elapsed: 4,
        entities: [],
        hooks: { onEquipmentPassiveTriggered: (event) => passiveEvents.push(event) }
    },
    target: { id: "mob", position: new Vector2(1, 1) },
    actualDamage: 6
});
assert.deepEqual(passiveEvents, [
    {
        ownerId: "rage",
        targetId: "mob",
        templateId: "completed_ability_crit",
        passiveId: "ability_crit",
        actualDamage: 6,
        elapsed: 4
    }
]);

console.log("[battle-metrics] ok");
