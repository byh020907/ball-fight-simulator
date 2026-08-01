import assert from "node:assert/strict";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { Vector2 } from "../src/core.js";
import { createRoster } from "../src/roster.js";
import { BulletProjectile, GUNNER_COMMAND_VISUAL_CONFIG } from "../src/entities/bulletProjectile.js";

function context() {
    const roster = createRoster();
    const results = [];
    const simulation = new BattleSimulation(
        [roster.find((fighter) => fighter.id === "gunner"), roster.find((fighter) => fighter.id === "rage")],
        { onLog() {}, onSound() {}, onAbilityResult: (result) => results.push(result) },
        null,
        { assignActions: false, dragCombatEnabled: true, abilityCommandEnabled: true, commandResourceEnabled: true }
    );
    const [owner, target] = simulation.fighters;
    simulation.setPlayerBall(owner);
    owner.position = new Vector2(400, 400);
    target.position = new Vector2(700, 400);
    return { simulation, owner, target, ability: owner.abilities.primary, results };
}

function fixedRandom(value, callback) {
    const random = Math.random;
    Math.random = () => value;
    try {
        return callback();
    } finally {
        Math.random = random;
    }
}

function open(value) {
    value.ability.setCooldownRemaining(0);
    value.ability.update(0, value.target);
    assert.equal(value.ability.commandWindow?.remaining, 0.8);
}

function launch(value, sequence = 1, bounces = 0) {
    const intent = value.ability.prepareCommand({
        sequence,
        direction: { x: 1, y: 0 },
        pathSegments: [{ x: 700, y: 400 }],
        bouncePoints: Array.from({ length: bounces }, () => ({ x: 1000, y: 400 })),
        createdAt: value.simulation.elapsed
    });
    return value.ability.resolveCommandLaunch(intent);
}

function finish(value) {
    for (let index = 0; index < 32 && value.ability.isBursting; index += 1) value.ability.update(0.05, value.target);
    return value.simulation.entities.filter((entity) => entity instanceof BulletProjectile);
}

{
    const value = context();
    open(value);
    assert.equal(value.ability.cooldownRemaining, 0);
    assert.deepEqual(value.ability.getCommandState(), { available: true, reserveResource: false });
    value.simulation.beginDragCombat(1, value.owner.position);
    value.simulation.moveDragCombat(1, new Vector2(180, 400));
    const result = value.simulation.releaseDragCombat(1);
    assert.equal(result.type, "launch");
    assert.equal(value.simulation.dragCombat.getSnapshot().playerShot.active, false);
    assert.equal(value.simulation.commandResource.amount, 0.35);
}

for (const [tier, count, guided] of [
    [0, 6, 1],
    [0, 12, 2],
    [1, 6, 2],
    [2, 6, 2],
    [3, 6, 2]
]) {
    const value = context();
    value.owner.progression.abilityTier = tier;
    open(value);
    fixedRandom(count === 6 ? 0 : 0.999, () => launch(value, 10 + tier));
    const bullets = fixedRandom(0.75, () => finish(value));
    assert.equal(bullets.length, count);
    assert.equal(bullets.filter((bullet) => bullet.commandGuided).length, guided);
    assert.ok(bullets.filter((bullet) => bullet.commandGuided).every((bullet) => bullet.velocity.x > 0));
    assert.ok(bullets.filter((bullet) => !bullet.commandGuided).every((bullet) => bullet.velocity.y < 0));
}

{
    const value = context();
    value.owner.progression.abilityTier = 3;
    open(value);
    fixedRandom(0, () => launch(value, 30, 1));
    const bullets = fixedRandom(0.25, () => finish(value));
    value.target.hp = value.target.maxHp;
    for (const bullet of bullets) {
        if (bullet.commandGuided) {
            bullet.pos = value.target.position.clone();
            bullet._hitCheck(value.simulation);
        } else {
            bullet.pos = new Vector2(100, 100);
            bullet.life = 0;
            bullet.update(0, value.simulation);
        }
    }
    value.ability.update(0, value.target);
    assert.equal(value.results.length, 1);
    const result = value.results[0];
    assert.equal(result.resultType, "gunner-command-tracer-line");
    assert.equal(result.success, true);
    for (const key of [
        "totalBullets",
        "guidedPlanned",
        "guidedLaunched",
        "settledProjectiles",
        "firstShotHit",
        "finisherEligible",
        "finisherHit",
        "refiresLaunched",
        "refireHits",
        "terminalTargetHits",
        "collections",
        "turretsDeployed",
        "actualDamage",
        "plannedSegments",
        "plannedBounces",
        "elapsed",
        "reason"
    ])
        assert.ok(key in result.value);
    assert.ok(Object.values(result.value).every((item) => typeof item !== "number" || Number.isFinite(item)));
}

{
    const value = context();
    const outcomes = [];
    value.target.hp = 1;
    const bullet = new BulletProjectile(
        value.owner,
        value.target.position.clone(),
        new Vector2(100, 0),
        1,
        false,
        0,
        null,
        { commandGuided: true, onSettled: (outcome) => outcomes.push(outcome) }
    );
    const rawDamage = bullet._getHitDamage();
    bullet._hitCheck(value.simulation);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].actualDamage, 1, "settlement records the HP loss after damage resolution");
    assert.ok(rawDamage > outcomes[0].actualDamage);
}

{
    const value = context();
    const outcomes = [];
    const bullet = new BulletProjectile(
        value.owner,
        new Vector2(value.simulation.width - 1, 400),
        new Vector2(100, 0),
        1,
        false,
        0,
        null,
        { canBounce: true, commandGuided: true, onSettled: (outcome) => outcomes.push(outcome) }
    );
    bullet.retargetAfterBounce = true;
    bullet.update(0.1, value.simulation);
    assert.equal(bullet.canBounce, false, "the first ricochet consumes the refire bounce");
    bullet.position = new Vector2(value.simulation.width - 1, 400);
    bullet.velocity = new Vector2(100, 0);
    bullet.update(0.1, value.simulation);
    assert.equal(outcomes.length, 1, "the second wall expiry settles exactly once");
    assert.equal(outcomes[0].hit, false);
}

{
    const value = context();
    value.owner.progression.abilityTier = 3;
    open(value);
    fixedRandom(0, () => launch(value, 51, 1));
    const source = fixedRandom(0.25, () => finish(value)).find((bullet) => bullet.commandGuided && !bullet.isFinisher);
    value.ability.state.collectionStacks = 19;
    source.position = value.owner.position.clone();
    source._ownerCollectCheck(value.simulation);
    const cycle = [...value.ability.commandCycles.values()][0];
    assert.equal(cycle.turretsDeployed, 1, "only the command collection that reaches twenty stacks counts its turret");
    const refire = value.simulation.entities.find((entity) => entity instanceof BulletProjectile && entity.isRefire);
    assert.ok(refire.velocity.x > 0, "the planned first bounce is the initial refire anchor");
    value.target.position = new Vector2(650, 400);
    refire.position = new Vector2(value.simulation.width - 1, 400);
    refire.velocity = new Vector2(100, 0);
    refire.update(0.1, value.simulation);
    assert.equal(refire.retargetConsumed, true);
    assert.ok(refire.velocity.x < 0, "the first actual bounce retargets the live terminal enemy");
    value.target.flags.defeated = true;
    assert.equal(
        value.ability._getCommandRefireTarget(source, value.simulation, cycle),
        value.simulation.getNearestEnemy(value.owner)
    );
}

{
    const value = context();
    open(value);
    fixedRandom(0, () => launch(value, 70));
    assert.equal(value.simulation.entities.filter((entity) => entity instanceof BulletProjectile).length, 0);
    value.ability.update(0, value.target);
    assert.equal(value.simulation.entities.filter((entity) => entity instanceof BulletProjectile).length, 1);
    value.ability.update(0.049, value.target);
    assert.equal(value.simulation.entities.filter((entity) => entity instanceof BulletProjectile).length, 1);
    value.ability.update(0.0011, value.target);
    assert.equal(value.simulation.entities.filter((entity) => entity instanceof BulletProjectile).length, 2);
    for (let index = 0; index < 5; index += 1) value.ability.update(0.05, value.target);
    assert.equal(value.ability.finisherCharge, null, "six-shot tier zero burst has no legacy finisher charge");
    value.owner.progression.abilityTier = 1;
    fixedRandom(0, () => value.ability._startBurst());
    for (let index = 0; index < 6; index += 1) value.ability.update(0.05, value.target);
    assert.ok(value.ability.finisherCharge, "eligible finisher pauses for the existing 0.16-second charge");
}

for (const [name, configure] of [
    ["flag off", (value) => (value.simulation.abilityCommandEnabled = false)],
    ["automated", (value) => (value.simulation.dragCombat.automated = true)],
    ["non-focal", (value) => (value.simulation.playerBall = value.target)],
    ["no resource", (value) => (value.simulation.commandResource.amount = 0)]
]) {
    const value = context();
    configure(value);
    value.ability.setCooldownRemaining(0);
    fixedRandom(0, () => value.ability.update(0, value.target));
    assert.equal(value.ability.commandWindow, null, `${name} does not expose the command window`);
    assert.equal(value.ability.isBursting, true, `${name} runs one legacy burst`);
}

{
    const timeout = context();
    open(timeout);
    fixedRandom(0, () => timeout.ability.update(0.8, timeout.target));
    assert.equal(timeout.ability.isBursting, true, "timeout falls back to one legacy burst");

    const cancel = context();
    open(cancel);
    cancel.simulation.beginDragCombat(2, cancel.owner.position);
    cancel.ability.update(1, cancel.target);
    cancel.simulation.cancelDragCombat(2);
    fixedRandom(0, () => cancel.ability.update(0, cancel.target));
    assert.equal(cancel.ability.isBursting, true, "cancel falls back to one legacy burst");

    const deadZone = context();
    open(deadZone);
    deadZone.simulation.beginDragCombat(3, deadZone.owner.position);
    deadZone.simulation.moveDragCombat(3, Vector2.add(deadZone.owner.position, new Vector2(-1, 0)));
    deadZone.ability.update(0, deadZone.target);
    deadZone.simulation.releaseDragCombat(3);
    fixedRandom(0, () => deadZone.ability.update(0, deadZone.target));
    assert.equal(deadZone.ability.isBursting, true, "dead-zone release falls back to one legacy burst");
}

for (const [finish, reason] of [
    [(value) => value.ability.onOwnerDefeated(), "owner-defeat"],
    [(value) => value.ability.onBattleEnded(), "battle-ended"]
]) {
    const value = context();
    open(value);
    fixedRandom(0, () => launch(value, reason.length));
    finish(value);
    finish(value);
    assert.equal(value.results.length, 1, `${reason} settles the command cycle once`);
    assert.equal(value.results[0].success, false);
    assert.equal(value.results[0].value.reason, reason);
}

{
    assert.deepEqual(GUNNER_COMMAND_VISUAL_CONFIG, {
        color: "#8df7ff",
        trailLength: 12,
        lineWidth: 3,
        dash: [6, 4],
        ringPadding: 5
    });
    const value = context();
    const bullet = new BulletProjectile(
        value.owner,
        value.owner.position.clone(),
        new Vector2(100, 0),
        1,
        false,
        0,
        null,
        { commandGuided: true }
    );
    bullet.commandTrail.push(new Vector2(450, 400));
    const calls = [];
    const canvas = new Proxy(
        {},
        {
            get:
                (_, key) =>
                (...args) =>
                    calls.push([key, ...args]),
            set: (_, key, entry) => {
                calls.push(["set", key, entry]);
                return true;
            }
        }
    );
    bullet.draw(canvas);
    assert.ok(calls.some(([name, dash]) => name === "setLineDash" && dash?.[0] === 6));
    assert.ok(calls.some(([name, , , radius]) => name === "arc" && radius === bullet.radius + 5));
}

console.log("[gunner-command] ok");
