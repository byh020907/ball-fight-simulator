import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { Ability } from "../src/abilities/index.js";
import { ArcherAbility } from "../src/abilities/archerAbility.js";
import { RageAbility } from "../src/abilities/rageAbility.js";

void Ability;
void BattleSimulation;

function createOwner(id) {
    return {
        id,
        abilityId: id,
        name: id,
        position: new Vector2(100, 100),
        radius: 20,
        color: "#f80",
        stats: { baseDamage: 20, baseSpeed: 200 },
        getSkillPoints: () => 0
    };
}

{
    const results = [];
    const owner = createOwner("rage");
    const target = {
        id: "target",
        name: "target",
        position: new Vector2(160, 100),
        flags: { defeated: false },
        hp: 100,
        takeDamage: (damage) => ({ actualDamage: damage })
    };
    const simulation = {
        elapsed: 3,
        entities: [],
        isHostile: () => true,
        getEnemiesOf: () => [target],
        recordAbilityResult: (event) => results.push(event),
        playSound() {},
        addLog() {},
        spawnExplosion() {}
    };
    const ability = new RageAbility(owner, simulation);
    ability.setContext({ abilityTier: 2 });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime() * 0.34;
    ability.prepareCommand({ sequence: 7 });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime();
    const resolution = ability.resolveCommandCollision({ commandSequence: 7, target, contactPoint: target.position });
    assert.equal(resolution.runDefaultOnCollision, false);
    assert.equal(ability.getChargeProgress(), 1, "subthreshold snapshot must not reset live charge");
    ability.onFighterCollisionDamageResolved(target, 9);
    assert.deepEqual(results[0], {
        fighterId: "rage",
        abilityId: "rage",
        commandSequence: 7,
        resultType: "rage-command-cashout",
        success: false,
        value: {
            chargeTier: "none",
            chargeRatio: 0.34,
            abilityDamage: 0,
            directDamage: 9,
            earlyReset: false
        }
    });
}

{
    const results = [];
    const owner = createOwner("rage");
    const target = {
        id: "target",
        name: "target",
        position: new Vector2(160, 100),
        flags: { defeated: false },
        hp: 100,
        takeDamage: (damage) => ({ actualDamage: damage })
    };
    const simulation = {
        elapsed: 3,
        entities: [],
        isHostile: () => true,
        getEnemiesOf: () => [target],
        recordAbilityResult: (event) => results.push(event),
        playSound() {},
        addLog() {},
        spawnExplosion() {}
    };
    const ability = new RageAbility(owner, simulation);
    ability.setContext({ abilityTier: 2 });
    ability.state.timeWithoutCollision = ability.getMaxChargeTime() * 0.7;
    ability.prepareCommand({ sequence: 8 });
    ability.resolveCommandCollision({ commandSequence: 8, target, contactPoint: target.position });
    ability.onFighterCollisionDamageResolved(target, 11);
    assert.equal(results.length, 1, "cashout result must be emitted once after resolved direct damage");
    assert.equal(results[0].success, true);
    assert.equal(results[0].value.chargeTier, "explosion");
    assert.equal(results[0].value.abilityDamage, 30);
    assert.equal(results[0].value.directDamage, 11);
}

{
    const results = [];
    const arrows = [];
    const owner = createOwner("archer");
    const target = { flags: { defeated: false }, position: new Vector2(300, 100), velocity: new Vector2() };
    const simulation = {
        elapsed: 10,
        recordAbilityResult: (event) => results.push(event),
        spawnArrow: (_owner, _start, velocity, options) => arrows.push({ velocity, options }),
        spawnSlash() {},
        playSound() {}
    };
    const ability = new ArcherAbility(owner, simulation);
    ability.state.lastAimDir = new Vector2(-1, 0);
    ability.prepareCommand({
        sequence: 4,
        direction: { x: 0, y: 1 },
        pathSegments: [
            { x: 160, y: 100 },
            { x: 160, y: 300 }
        ],
        bouncePoints: [{ x: 160, y: 100 }],
        predictedTerminal: { x: 160, y: 300 },
        createdAt: 8
    });
    ability.release(target);
    assert.ok(arrows[0].velocity.y > 0 && arrows[0].velocity.x === 0, "first arrow must use command direction");
    arrows[0].options.onStaticCollision({ wall: true });
    arrows[0].options.onResult(true);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].value, {
        hit: true,
        wallSegmentsFollowed: 1,
        plannedSegments: 2,
        secondShotHit: null,
        elapsed: 2
    });
    ability._fireArrowWithCrit(target, false);
    assert.equal(arrows[1].options.onStaticCollision, null, "ordinary arrows must not receive additive callbacks");
}

console.log("[rage-archer-command] ok");
