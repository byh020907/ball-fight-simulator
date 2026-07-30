import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { aggregateBattleMetrics, BattleMetricsRecorder } from "../src/simulation/battleMetrics.js";
import { EquipmentRuntime } from "../src/hunting/equipmentRuntime.js";
import { Ability, AbilitySet } from "../src/abilities/index.js";
import { ArcherAbility } from "../src/abilities/archerAbility.js";
import { RageAbility } from "../src/abilities/rageAbility.js";
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

// ── Ability/AbilitySet construction-and-bind: no false use event ────
{
    const abilityEvents = [];
    const mockSim = { hooks: { onAbilityUsed: (e) => abilityEvents.push(e) }, elapsed: 0 };
    const mockOwner = { id: "test_fighter", abilityId: "test_ability" };

    const ability = new Ability(mockOwner, mockSim, 5);
    assert.equal(abilityEvents.length, 0, "constructor must not emit onAbilityUsed");

    const abilitySet = new AbilitySet(mockOwner, { primary: ability });
    assert.equal(abilityEvents.length, 0, "bind to AbilitySet must not emit onAbilityUsed");

    ability._cooldownRemaining = 0;
    assert.ok(ability.cooldownReady, "ability must be ready after clearing cooldown");

    ability.resetCooldown(5);
    assert.equal(abilityEvents.length, 1, "ready-to-cooldown reset must emit exactly once");
    assert.equal(abilityEvents[0].ownerId, "test_fighter");
    assert.equal(abilityEvents[0].abilityId, "test_ability");
    assert.equal(abilityEvents[0].elapsed, 0);

    abilityEvents.length = 0;
    ability.resetCooldown(5);
    assert.equal(abilityEvents.length, 0, "non-ready reset must not emit");
}

// ── 실제 능력 발동은 공통 계측 메서드를 한 번만 호출한다 ───────────
{
    const events = [];
    const simulation = {
        elapsed: 3,
        entities: [],
        hooks: { onAbilityUsed: (event) => events.push(event) },
        spawnArrow() {},
        spawnSlash() {},
        playSound() {}
    };
    const owner = {
        id: "archer",
        abilityId: "archer",
        position: new Vector2(0, 0),
        radius: 50,
        color: "#fff",
        stats: { baseSpeed: 200 },
        getSkillPoints: () => 0
    };
    const target = { flags: { defeated: false }, position: new Vector2(100, 0), velocity: new Vector2() };
    const ability = new ArcherAbility(owner, simulation);
    new AbilitySet(owner, { primary: ability });
    ability.release(target);
    assert.equal(events.length, 1, "첫 화살 발사는 한 번만 계측한다");
    assert.equal(events[0].abilityId, "archer");
    ability._fireArrowWithCrit(target, false);
    assert.equal(events.length, 1, "강화 두 번째 화살은 별도 사용으로 중복 계측하지 않는다");
}

{
    const events = [];
    const simulation = {
        elapsed: 5,
        entities: [],
        hooks: { onAbilityUsed: (event) => events.push(event) },
        playSound() {},
        addLog() {}
    };
    const owner = {
        id: "rage",
        abilityId: "rage",
        position: new Vector2(),
        color: "#f00",
        getSkillPoints: () => 0
    };
    const ability = new RageAbility(owner, simulation);
    new AbilitySet(owner, { primary: ability });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime() * 0.34;
    ability.onCollision({ flags: { defeated: false } }, {});
    assert.equal(events.length, 0, "Rage 미충전 충돌은 계측하지 않는다");
    ability.state.timeWithoutCollision = ability.getMaxChargeTime() * 0.35;
    ability.onCollision({ flags: { defeated: false } }, {});
    assert.equal(events.length, 1, "Rage 충전 소비 충돌은 한 번 계측한다");
    assert.equal(events[0].abilityId, "rage");
}

// ── Regression: duplicate drag sequence ignored ─────────────────────
{
    const dragRecorder = new BattleMetricsRecorder();
    dragRecorder.recordDragEvent({ sequence: 1, type: "launch", elapsed: 1 });
    dragRecorder.recordDragEvent({ sequence: 1, type: "launch", elapsed: 2 });
    dragRecorder.recordDragEvent({ sequence: 2, type: "bounce", elapsed: 2 });
    assert.equal(dragRecorder.dragEvents.length, 2, "duplicate sequence must be ignored");

    const dragSnap = dragRecorder.snapshot({ fighters: [] });
    assert.equal(dragSnap.dragEvents.length, 2);
    assert.equal(dragSnap.dragEvents[0].type, "launch");
    assert.equal(dragSnap.dragEvents[1].type, "bounce");
}

// ── Regression: drag event aggregation (charge/bounce/hit/end) ──────
{
    const dragRecorder = new BattleMetricsRecorder();
    for (const event of [
        { sequence: 1, type: "launch", chargeRatio: 0.5, elapsed: 1 },
        { sequence: 2, type: "bounce", bounceCount: 1, elapsed: 1.5 },
        { sequence: 3, type: "bounce", bounceCount: 2, elapsed: 2.0 },
        { sequence: 4, type: "rear-hit", bounceCount: 2, elapsed: 2.5 },
        { sequence: 5, type: "bounce", bounceCount: 1, elapsed: 3.0 },
        { sequence: 6, type: "plain-hit", elapsed: 3.5 },
        { sequence: 7, type: "slow-stop", elapsed: 4.0 }
    ]) {
        dragRecorder.recordDragEvent(event);
    }
    const snap = dragRecorder.snapshot({ fighters: [] });
    const agg = aggregateBattleMetrics([snap, snap]);
    assert.equal(agg.drag.launch.count, 2);
    assert.equal(agg.drag.bounce.count, 6);
    assert.equal(agg.drag["rear-hit"].count, 2);
    assert.equal(agg.drag["plain-hit"].count, 2);
    assert.equal(agg.drag["slow-stop"].count, 2);
    assert.equal(agg.drag.launch.perMatch, 1);
}

// ── Regression: empty and multi-sample finite output ────────────────
{
    const emptyAgg = aggregateBattleMetrics([]);
    assert.equal(emptyAgg.sampleCount, 0);
    assert.equal(emptyAgg.duration.average, 0);
    assert.equal(emptyAgg.duration.median, 0);
    assert.equal(emptyAgg.duration.p10, 0);
    assert.equal(emptyAgg.duration.p90, 0);
    assert.equal(emptyAgg.winRate, 0);
    assert.deepEqual(emptyAgg.abilities, {});
    assert.deepEqual(emptyAgg.drag, {});

    const multiRecorder = new BattleMetricsRecorder();
    multiRecorder.recordDamage({ sourceId: "a", targetId: "b", actualDamage: 10, origin: "combat", elapsed: 0 });
    multiRecorder.recordAbilityUsed({ ownerId: "a", abilityId: "rage", elapsed: 2 });
    const snap1 = multiRecorder.snapshot({
        fighters: [
            { id: "a", hp: 90, maxHp: 100 },
            { id: "b", hp: 0, maxHp: 100 }
        ],
        winnerId: "a"
    });
    const snap2 = multiRecorder.snapshot({
        fighters: [
            { id: "a", hp: 80, maxHp: 100 },
            { id: "b", hp: 0, maxHp: 100 }
        ],
        winnerId: "a",
        elapsed: 20
    });
    const multiAgg = aggregateBattleMetrics([snap1, snap2]);
    assert.equal(multiAgg.sampleCount, 2);
    assert.ok(Number.isFinite(multiAgg.winRate));
    assert.ok(Number.isFinite(multiAgg.duration.average));
    assert.ok(Number.isFinite(multiAgg.abilities.rage.usesPerMatch));
    assert.deepEqual(multiAgg.drag, {});
}

// ── Regression: four origin compatibility ──────────────────────────
{
    const originRecorder = new BattleMetricsRecorder();
    for (const origin of ["combat", "equipment", "drag", "drag-counter"]) {
        originRecorder.recordDamage({
            sourceId: "a",
            targetId: "b",
            actualDamage: 15,
            origin,
            label: "Crash",
            elapsed: 0
        });
    }
    const originSnap = originRecorder.snapshot({
        fighters: [
            { id: "a", hp: 100, maxHp: 100 },
            { id: "b", hp: 40, maxHp: 100 }
        ],
        winner: { id: "a" }
    });
    assert.deepEqual(originSnap.damageByOrigin.combat, { damage: 15, hits: 1, absorbed: 0 });
    assert.deepEqual(originSnap.damageByOrigin.equipment, { damage: 15, hits: 1, absorbed: 0 });
    assert.deepEqual(originSnap.damageByOrigin.drag, { damage: 15, hits: 1, absorbed: 0 });
    assert.deepEqual(originSnap.damageByOrigin["drag-counter"], { damage: 15, hits: 1, absorbed: 0 });

    const originAgg = aggregateBattleMetrics([originSnap]);
    assert.equal(originAgg.sampleCount, 1);
    assert.equal(originAgg.wins, 1);
}

// ── Observer hook-on vs hook-off fixed-seed invariance ─────────────
{
    function createSeededRng(seed) {
        let state = seed >>> 0;
        return () => {
            state += 0x6d2b79f5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
        };
    }

    function buildRoster() {
        return createRoster()
            .slice(0, 2)
            .map((spec, index) => ({ ...spec, teamId: String(index), ability: "none" }));
    }

    function runSim(rng, withHooks) {
        const baseHooks = { onLog() {}, onSound() {} };
        const recorderEvents = [];
        const hooks = withHooks
            ? {
                  ...baseHooks,
                  onDamageResolved: (e) => recorderEvents.push(e)
              }
            : baseHooks;
        const sim = new BattleSimulation(buildRoster(), hooks, null, {
            assignActions: false,
            rng,
            width: 400,
            height: 400
        });
        const [a, b] = sim.fighters;
        a.stats.criticalChance = 0;
        b.stats.criticalChance = 0;
        for (let i = 0; i < 5; i++) {
            sim.update(1 / 60, 1 / 60);
        }
        return { elapsed: sim.elapsed, fightersHp: sim.fighters.map((f) => f.hp) };
    }

    const seed = 20260731;
    const resultOn = runSim(createSeededRng(seed), true);
    const resultOff = runSim(createSeededRng(seed), false);

    assert.equal(typeof resultOn.elapsed, "number");
    assert.equal(resultOn.elapsed, resultOff.elapsed, "elapsed must match between hook-on and hook-off");
    assert.deepEqual(resultOn.fightersHp, resultOff.fightersHp, "hp must match between hook-on and hook-off");
}

// ── Regression: old equipment metrics unchanged ─────────────────────
{
    const equipRecorder = new BattleMetricsRecorder();
    equipRecorder.trackEquipment("completed_ability_crit", "rage");
    equipRecorder.recordDamage({
        sourceId: "rage",
        targetId: "mob",
        actualDamage: 10,
        origin: "equipment",
        sourceTemplateId: "completed_ability_crit",
        label: "장비",
        elapsed: 1
    });
    equipRecorder.recordEquipmentPassiveTrigger({ templateId: "completed_ability_crit", passiveId: "ability_crit" });
    const equipSnap = equipRecorder.snapshot({
        fighters: [
            { id: "rage", hp: 90, maxHp: 100 },
            { id: "mob", hp: 0, maxHp: 100 }
        ]
    });
    assert.equal(equipSnap.equipment.completed_ability_crit.directDamage, 10);
    assert.equal(equipSnap.equipment.completed_ability_crit.triggers, 1);
    assert.equal(equipSnap.equipment.completed_ability_crit.hits, 1);
    assert.equal(equipSnap.equipment.completed_ability_crit.ownerDamage, 10);
}

// ── Focal aggregate: enemy ability filtering + zero-use + noUseRate ─
{
    const aggRecorder = new BattleMetricsRecorder();
    aggRecorder.recordAbilityUsed({ ownerId: "player", abilityId: "rage", elapsed: 2 });
    aggRecorder.recordAbilityUsed({ ownerId: "enemy1", abilityId: "hunting_mob", elapsed: 1 });
    aggRecorder.recordDamage({
        sourceId: "player",
        targetId: "enemy1",
        actualDamage: 30,
        origin: "drag",
        label: "드래그",
        elapsed: 0
    });
    aggRecorder.recordDamage({
        sourceId: "enemy1",
        targetId: "player",
        actualDamage: 10,
        origin: "drag-counter",
        label: "반격",
        elapsed: 0
    });
    const aggSnap = aggRecorder.snapshot({
        fighters: [
            { id: "player", hp: 90, maxHp: 100 },
            { id: "enemy1", hp: 70, maxHp: 100 }
        ],
        elapsed: 10,
        focalFighterId: "player",
        focalAbilityIds: ["rage"]
    });
    const result = aggregateBattleMetrics([aggSnap]);
    assert.equal(Object.keys(result.abilities).length >= 1, true);
    assert.ok(!("hunting_mob" in result.abilities), "enemy ability must not appear in focal abilities");
    assert.ok("rage" in result.abilities, "focal ability must appear");
    assert.equal(result.abilities.rage.usesPerMatch, 1);
    assert.equal(result.abilities.rage.firstElapsed, 2);
    assert.equal(result.abilities.rage.noUseRate, 0);
}

{
    const zeroRecorder = new BattleMetricsRecorder();
    const zeroSnap = zeroRecorder.snapshot({
        fighters: [{ id: "p", hp: 100, maxHp: 100 }],
        focalFighterId: "p",
        focalAbilityIds: ["rage", "archer"]
    });
    const result = aggregateBattleMetrics([zeroSnap]);
    assert.ok("rage" in result.abilities, "zero-use ability must appear");
    assert.ok("archer" in result.abilities, "zero-use ability must appear");
    assert.equal(result.abilities.rage.usesPerMatch, 0);
    assert.equal(result.abilities.rage.noUseRate, 1);
    assert.equal(result.abilities.archer.usesPerMatch, 0);
    assert.equal(result.abilities.archer.noUseRate, 1);
}

// ── 경기별 첫 사용 시각은 미사용 경기를 제외해 평균·중앙값을 낸다 ──
{
    const makeSnapshot = (elapsed) => ({
        elapsed: 10,
        focalFighterId: "p",
        focalAbilityIds: ["rage"],
        abilities: elapsed === null ? [] : [{ ownerId: "p", abilityId: "rage", elapsed }]
    });
    const result = aggregateBattleMetrics([makeSnapshot(2), makeSnapshot(null), makeSnapshot(8)]);
    assert.equal(result.abilities.rage.firstElapsed, 5);
    assert.equal(result.abilities.rage.firstElapsedMedian, 5);
    assert.ok(Math.abs(result.abilities.rage.noUseRate - 1 / 3) < 1e-12);
}

// ── Focal origin ratios ────────────────────────────────────────────
{
    const orRecorder = new BattleMetricsRecorder();
    orRecorder.recordDamage({
        sourceId: "p",
        targetId: "e",
        actualDamage: 50,
        origin: "drag",
        label: "드래그",
        elapsed: 0
    });
    orRecorder.recordDamage({
        sourceId: "p",
        targetId: "e",
        actualDamage: 50,
        origin: "combat",
        label: "충돌",
        elapsed: 0
    });
    orRecorder.recordDamage({
        sourceId: "e",
        targetId: "p",
        actualDamage: 20,
        origin: "drag-counter",
        label: "반격",
        elapsed: 0
    });
    const orSnap = orRecorder.snapshot({
        fighters: [
            { id: "p", hp: 80, maxHp: 100 },
            { id: "e", hp: 0, maxHp: 100 }
        ],
        focalFighterId: "p"
    });
    const orAgg = aggregateBattleMetrics([orSnap]);
    assert.equal(orAgg.focalDealtDragRatio, 0.5, "drag dealt ratio = 50/100");
    assert.equal(orAgg.focalDealtByOrigin.drag.damage, 50);
    assert.equal(orAgg.focalDealtByOrigin.combat.damage, 50);
    assert.equal(orAgg.focalTakenByOrigin["drag-counter"].damage, 20);
    assert.equal(orAgg.focalTakenDragCounterRatio, 1);
}

// ── Drag collision attribution through real simulation path ────────
// shield-counter collision → drag-counter origin → 실제 충돌 경로 검증
{
    const dragRecorder = new BattleMetricsRecorder();
    const roster = createRoster()
        .slice(0, 2)
        .map((spec, index) => ({
            ...spec,
            teamId: String(index),
            ability: "none"
        }));
    const dragSim = new BattleSimulation(
        roster,
        {
            onLog() {},
            onSound() {},
            onDamageResolved: (e) => dragRecorder.recordDamage(e),
            onDragCombatMetric: (e) => dragRecorder.recordDragEvent(e)
        },
        null,
        { assignActions: false, dragCombatEnabled: true, width: 400, height: 400 }
    );
    const [dPlayer, dEnemy] = dragSim.fighters;
    dPlayer.stats.criticalChance = 0;
    dEnemy.stats.criticalChance = 0;
    dragSim.setPlayerBall(dPlayer);
    const { dragCombat } = dragSim;

    dPlayer.position.x = 100;
    dPlayer.position.y = 200;
    dEnemy.position.x = 110;
    dEnemy.position.y = 200;

    dragCombat.begin(1, { x: 100, y: 200 });
    for (let i = 0; i < 10; i++) {
        dragCombat.move(1, { x: 50, y: 200 });
        dragCombat.tickInput(1 / 60);
    }
    dragCombat.release(1);
    for (let step = 0; step < 30; step++) {
        dragSim.update(1 / 60, 1 / 60);
        if (dragSim.finished) break;
    }

    const dragCounterDamage = dragRecorder.damageByOrigin["drag-counter"]?.damage ?? 0;
    assert.ok(
        dragCounterDamage > 0,
        "drag-counter damage must be produced through actual drag collision path (shield-counter front hit)"
    );

    const shieldCounterEventCount = dragRecorder.dragEvents.filter((e) => e.type === "shield-counter").length;
    assert.ok(shieldCounterEventCount > 0, "shield-counter drag event must be recorded through actual collision");
}

// ── Drag summary aggregation ───────────────────────────────────────
{
    const dsRecorder = new BattleMetricsRecorder();
    dsRecorder.recordDragEvent({ sequence: 1, type: "launch", chargeRatio: 0.6, elapsed: 0.5 });
    dsRecorder.recordDragEvent({ sequence: 2, type: "bounce", bounceCount: 1, elapsed: 0.8 });
    dsRecorder.recordDragEvent({ sequence: 3, type: "bounce", bounceCount: 2, elapsed: 1.0 });
    dsRecorder.recordDragEvent({ sequence: 4, type: "plain-hit", bounceCount: 2, elapsed: 1.2 });
    dsRecorder.recordDragEvent({ sequence: 5, type: "slow-stop", elapsed: 1.5 });
    const dsSnap = dsRecorder.snapshot({
        fighters: [
            { id: "a", hp: 100, maxHp: 100 },
            { id: "b", hp: 100, maxHp: 100 }
        ]
    });
    const dsAgg = aggregateBattleMetrics([dsSnap]);
    assert.ok(dsAgg.dragDetail, "dragDetail must exist");
    assert.equal(dsAgg.dragDetail.launchesPerMatch, 1);
    assert.equal(dsAgg.dragDetail.averageLaunchChargeRatio, 0.6);
    assert.equal(dsAgg.dragDetail.medianLaunchChargeRatio, 0.6);
    assert.equal(dsAgg.dragDetail.bouncesPerMatch, 2);
    assert.equal(dsAgg.dragDetail.hitTypes["plain-hit"].count, 1);
    assert.equal(dsAgg.dragDetail.endReasons["slow-stop"].count, 1);
    assert.equal(dsAgg.dragDetail.maxBounceTierDistribution["2"], 1);
}

// ── recordDragEvent with snapshot.chargeRatio fallback ─────────────
{
    const snapRecorder = new BattleMetricsRecorder();
    snapRecorder.recordDragEvent({
        sequence: 1,
        type: "launch",
        snapshot: { chargeRatio: 0.75 },
        elapsed: 0.5
    });
    assert.equal(snapRecorder.dragEvents[0].chargeRatio, 0.75, "must read chargeRatio from event.snapshot");
}

// ── Per-fighter origin tracking in snapshot ─────────────────────────
{
    const pfoRecorder = new BattleMetricsRecorder();
    pfoRecorder.recordDamage({
        sourceId: "f1",
        targetId: "f2",
        actualDamage: 10,
        origin: "drag",
        label: "",
        elapsed: 0
    });
    pfoRecorder.recordDamage({
        sourceId: "f2",
        targetId: "f1",
        actualDamage: 5,
        origin: "drag-counter",
        label: "",
        elapsed: 0
    });
    const pfoSnap = pfoRecorder.snapshot({
        fighters: [
            { id: "f1", hp: 95, maxHp: 100 },
            { id: "f2", hp: 90, maxHp: 100 }
        ],
        focalFighterId: "f1"
    });
    assert.equal(pfoSnap.focalDealtByOrigin.drag.damage, 10, "focal dealt drag damage must be 10");
    assert.equal(pfoSnap.focalTakenByOrigin["drag-counter"].damage, 5, "focal taken drag-counter damage must be 5");
}

console.log("[battle-metrics] ok");
