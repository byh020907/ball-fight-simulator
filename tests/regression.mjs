import assert from "node:assert/strict";
import {
    PLAYER_STAT_POINTS,
    STAT_BALANCER_CONFIG,
    adjustStatAllocation,
    applyStatAllocation,
    calculateStatMultiplier,
    createRandomStatAllocation,
    createTournamentRoster,
    formatStatAllocation,
    getSpentStatPoints
} from "../src/stat-allocation.js";
import { FIGHTER_IDS } from "../src/core.js";
import { Vector2 } from "../src/core.js";

function makeClassList() {
    const set = new Set();
    return {
        add: (...names) => names.forEach((name) => set.add(name)),
        remove: (...names) => names.forEach((name) => set.delete(name)),
        contains: (name) => set.has(name),
        toggle: (name, force) => {
            if (force === undefined ? !set.has(name) : force) {
                set.add(name);
            } else {
                set.delete(name);
            }
        }
    };
}

function makeElement(id = "el") {
    const children = [];
    const queryCache = new Map();
    const element = {
        id,
        style: {},
        disabled: false,
        textContent: "",
        innerHTML: "",
        className: "",
        dataset: {},
        children,
        classList: makeClassList(),
        appendChild(child) {
            children.push(child);
            return child;
        },
        addEventListener() {},
        closest() {
            return element;
        },
        querySelector(selector) {
            if (!queryCache.has(selector)) {
                queryCache.set(selector, makeElement(selector));
            }
            return queryCache.get(selector);
        }
    };
    return element;
}

function makeCanvasContext() {
    const gradient = { addColorStop() {} };
    const target = {
        createRadialGradient: () => gradient,
        createLinearGradient: () => gradient,
        measureText: () => ({ width: 0 })
    };
    return new Proxy(target, {
        get: (object, property) => (property in object ? object[property] : () => undefined),
        set: (object, property, value) => {
            object[property] = value;
            return true;
        }
    });
}

class FakeAudioContext {
    constructor() {
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = {};
        this.state = "running";
    }

    resume() {
        this.state = "running";
    }

    createGain() {
        return {
            gain: {
                setValueAtTime() {},
                exponentialRampToValueAtTime() {}
            },
            connect() {}
        };
    }

    createOscillator() {
        return {
            frequency: {
                setValueAtTime() {},
                exponentialRampToValueAtTime() {}
            },
            type: "sine",
            connect() {},
            start() {},
            stop() {}
        };
    }

    createBuffer(_channels, length) {
        return {
            getChannelData() {
                return new Float32Array(length);
            }
        };
    }

    createBufferSource() {
        return {
            buffer: null,
            connect() {},
            start() {}
        };
    }
}

function makeHarness() {
    const elements = new Map();
    for (const id of [
        "arenaCanvas",
        "overlay",
        "startButton",
        "matchupLabel",
        "statusBadge",
        "fighterCards",
        "battleLog",
        "tournamentPanel",
        "tournamentBracket",
        "tournamentPhase",
        "playerPanel"
    ]) {
        elements.set(id, makeElement(id));
    }

    const canvas = elements.get("arenaCanvas");
    canvas.width = 960;
    canvas.height = 960;
    canvas.getContext = () => makeCanvasContext();

    const context = {
        console,
        Math,
        AudioContext: FakeAudioContext,
        webkitAudioContext: FakeAudioContext,
        performance: { now: () => Date.now() },
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {},
        document: {
            getElementById: (id) => elements.get(id) || makeElement(id),
            createElement: (tag) => makeElement(tag)
        }
    };
    context.setTimeout = (callback) => {
        callback();
        return 0;
    };
    context.window = context;
    return { context, elements };
}

async function loadModuleApp() {
    const harness = makeHarness();
    Object.assign(globalThis, harness.context);
    const moduleUrl = new URL(`../src/app.js?test=${Date.now()}`, import.meta.url).href;
    const { BattleApp } = await import(moduleUrl);
    return new BattleApp();
}

async function testCloneSeedDash(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    trickster.position.x = 200;
    trickster.position.y = 480;
    opponent.position.x = 640;
    opponent.position.y = 480;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds = app.simulation.entities.filter((entity) => entity.constructor.name === "SeedOrb");
    assert.equal(seeds.length, 3, "Clone should launch three seeds");
    assert.ok(
        seeds.every((seed) => seed.life === trickster.ability.cooldown),
        "Clone seeds should live for the same duration as the seed cooldown"
    );

    const angles = seeds.map((seed) => Math.atan2(seed.velocity.y, seed.velocity.x)).sort((a, b) => a - b);
    const gaps = angles.map((angle, index) => {
        const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0);
        return Math.round(((next - angle) * 180) / Math.PI);
    });
    assert.deepEqual(gaps, [120, 120, 120], "Clone seeds should spread at 120 degree intervals");

    seeds[1].update(trickster.ability.cooldown - 0.01, app.simulation);
    assert.equal(seeds[1].isExpired, false, "Clone seed should stay alive before cooldown duration");
    seeds[1].update(0.02, app.simulation);
    assert.equal(seeds[1].isExpired, true, "Clone seed should expire at the seed cooldown duration");

    seeds[0].position = opponent.position.clone();
    seeds[0].update(0.016, app.simulation);
    assert.ok(trickster.dashState, "Clone should dash when any seed is collected");
    assert.equal(opponent.dashState, null, "The collector should not dash");
}

async function testEaterFeast(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.EATER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [eater, target] = app.simulation.fighters;
    eater.position.x = 300;
    eater.position.y = 480;
    target.position.x = 360;
    target.position.y = 480;
    eater.velocity.x = 260;
    eater.velocity.y = 0;
    eater.ability.feastTimer = eater.ability.feastDuration;
    eater.ability.feastElapsed = eater.ability.feastDuration;
    eater.ability.update(0.2, target);
    assert.equal(eater.ability.getRadiusScale(), 1, "Eater should stay normal size during feast (no swallow)");
    eater.ability.feastTimer = 0;

    eater.ability.feastTimer = 1.2;
    eater.ability.hasEatenThisFeast = false;
    eater.ability.onCollision(target);
    assert.ok(target.swallowedState, "Eater should swallow on feast collision");
    eater.ability.update(0.3, target);
    assert.ok(eater.ability.getRadiusScale() > 1.1, "Eater should start growing after swallowing");

    app.simulation.update(0.8);
    assert.equal(target.swallowedState, null, "Eater should spit target back out");
    assert.ok(target.wallSlamState, "Spat target should receive wall slam state");
    assert.equal(target.forcedHeading, null, "Spit dash should allow wall bounce direction changes");
    assert.equal(
        Math.round(target.velocity.length()),
        target.baseSpeed * 2,
        "Spat target should launch at twice its base speed"
    );
    assert.equal(target.speedBoost.showRing, false, "Spit dash should not draw the normal speed ring");
    const spinBefore = target.spinRotation;
    target.update(0.12, app.simulation);
    assert.ok(Math.abs(target.spinRotation - spinBefore) > 1, "Spat target face should spin while flying");
    const beforeHp = target.hp;
    target.velocity.x = Math.abs(target.velocity.x) || 500;
    target.position.x = app.simulation.width + target.radius + 5;
    app.simulation.keepInsideArena(target);
    assert.equal(beforeHp - target.hp, 7, "Wall bounce should deal wall slam damage (8 - 1 defense)");
    assert.ok(target.velocity.x < 0, "Wall bounce should reverse spat target direction");
    assert.ok(app.simulation.screenShake, "Wall slam should trigger screen shake");
    assert.ok(
        app.simulation.entities.filter((entity) => entity.constructor.name === "GravityParticle").length >= 20,
        "Wall slam should emit wall particles"
    );
}

async function testRageBallMomentum(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.RAGE),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [rage, opponent] = app.simulation.fighters;
    const initialSpeed = rage.ability.getStatModifiers().speed;
    rage.ability.update(7.5, opponent);
    const chargedSpeed = rage.ability.getStatModifiers().speed;
    assert.ok(initialSpeed < 1, "Rage Ball should start slower than normal");
    assert.ok(chargedSpeed > 1.7, "Rage Ball should gain speed while avoiding collision");
    rage.ability.onCollision(opponent);
    assert.equal(rage.ability.getChargeProgress(), 0, "Rage Ball collision should reset momentum");
}

async function testDashBallCooldownDash(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [dashBall, target] = app.simulation.fighters;
    assert.equal(dashBall.baseDamage, 9, "Dash Ball should have reduced base damage");
    dashBall.position.x = 300;
    dashBall.position.y = 480;
    target.position.x = 620;
    target.position.y = 480;
    dashBall.ability.timer = 0;
    dashBall.ability.update(0.016, target);
    assert.ok(dashBall.dashState, "Dash Ball should enter dash state");
    assert.ok(
        Math.abs(dashBall.forcedHeading.direction.length() - 1) < 0.001,
        "Dash Ball forced heading should remain a unit direction"
    );
    dashBall.update(0.016, app.simulation);
    assert.ok(dashBall.velocity.length() < 800, "Dash Ball dash velocity should stay bounded");
    assert.ok(dashBall.velocity.length() > 600, "Dash Ball dash should be faster than before");
    const directionBeforeSteer = dashBall.forcedHeading.direction.clone();
    target.position.y = 300;
    dashBall.ability.update(0.1, target);
    assert.ok(
        dashBall.forcedHeading.direction.y < directionBeforeSteer.y,
        "Dash Ball dash should steer toward the target at full cooldown"
    );
    dashBall.ability.cooldownLevel = 1;
    const directionAfterFullCooldownSteer = dashBall.forcedHeading.direction.clone();
    target.position.y = 660;
    dashBall.ability.update(0.1, target);
    assert.deepEqual(
        dashBall.forcedHeading.direction,
        directionAfterFullCooldownSteer,
        "Dash Ball dash should not steer after cooldown stacks are gained"
    );
    dashBall.ability.cooldownLevel = 0;

    dashBall.position.x = 480;
    dashBall.position.y = 480;
    target.position.x = 480 + dashBall.radius + target.radius - 2;
    target.position.y = 480;
    const hpBefore = target.hp;
    const baseCooldown = dashBall.ability.baseCooldown;
    app.simulation.handleCollision();
    assert.ok(target.hp < hpBefore, "Dash Ball collision should damage target");
    assert.equal(
        app.ui.logItems.some((item) => item.includes("Dash Contact lands")),
        false,
        "Dash Ball dash should not add separate collision damage"
    );
    assert.equal(target.slowEffect, null, "Dash Ball collision should not slow target");
    assert.equal(baseCooldown, 3, "Dash Ball base cooldown should be 3 seconds");
    assert.equal(dashBall.ability.cooldownLevel, 1, "First dash hit should add one cooldown stack");
    assert.equal(dashBall.ability.cooldown, baseCooldown * 0.5, "First dash hit should halve future cooldown");
    assert.equal(dashBall.ability.maxCooldownLevel, 2, "Dash should have max 2 cooldown stacks");
    assert.equal(
        dashBall.ability.timer,
        dashBall.ability.cooldown,
        "Dash hit should clamp timer to the shorter cooldown"
    );
    assert.equal(dashBall.dashState, null, "Dash Ball dash should clear after impact");

    dashBall.ability.onDashHit();
    assert.equal(dashBall.ability.cooldownLevel, 2, "Second dash hit should reach max cooldown stacks");
    assert.equal(dashBall.ability.cooldown, baseCooldown * 0.25, "Second dash hit should leave 25% base cooldown");
    dashBall.ability.onDashHit();
    assert.equal(dashBall.ability.cooldownLevel, 2, "Dash cooldown stacks should cap at two");
    assert.equal(
        dashBall.ability.cooldown,
        baseCooldown * 0.25,
        "Dash cooldown should not shrink below 25% base cooldown"
    );

    dashBall.position.x = app.simulation.width - dashBall.radius + 1;
    dashBall.position.y = 200;
    target.position.x = 200;
    target.position.y = 760;
    dashBall.ability.cooldownLevel = 2;
    dashBall.ability.cooldown = dashBall.ability.getCooldownForLevel();
    dashBall.ability.timer = dashBall.ability.cooldown;
    dashBall.startDash(new Vector2(1, 0), {
        collisionLabel: "Dash Contact",
        untilImpact: true,
        untilWall: true,
        maxDuration: 1.4
    });
    app.simulation.keepInsideArena(dashBall);
    assert.equal(dashBall.dashState, null, "Dash Ball dash should clear on wall contact");
    assert.equal(dashBall.ability.cooldownLevel, 0, "Wall contact should reset cooldown stacks");
    assert.equal(dashBall.ability.cooldown, baseCooldown, "Wall contact should restore full cooldown");
    assert.equal(dashBall.ability.timer, baseCooldown, "Wall contact should restart from full cooldown");
}

async function testGrenadeAdaptiveFuse(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [grenadeBall, target] = app.simulation.fighters;
    const ability = grenadeBall.ability;
    assert.equal(ability.getFuseTime(), 1.08, "Grenade should start with base fuse");

    ability.onGrenadeResult(false);
    ability.onGrenadeResult(false);
    assert.equal(Number(ability.getFuseTime().toFixed(2)), 0.72, "Misses should shorten grenade fuse");

    app.simulation.entities = [];
    app.simulation.spawnGrenade(grenadeBall, target.position.clone(), ability.getFuseTime());
    const grenade = app.simulation.entities.find((entity) => entity.constructor.name === "Grenade");
    assert.equal(Number(grenade.maxTimer.toFixed(2)), 0.72, "Spawned grenade should use adaptive fuse");

    ability.onGrenadeResult(true);
    assert.equal(ability.missStreak, 0, "Grenade hit should reset miss streak");
    assert.equal(ability.getFuseTime(), 1.08, "Grenade hit should reset fuse");
}

async function testDamageShake(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [attacker, target] = app.simulation.fighters;
    target.takeDamage(10, attacker, "Test Hit");
    assert.ok(app.simulation.screenShake, "Taking damage should trigger screen shake");
    assert.ok(app.simulation.screenShake.strength >= 11, "Damage shake should be visible");
    assert.ok(app.simulation.screenShake.remaining >= 0.16, "Damage shake should last multiple frames");
}

async function testArrowBounceFacing(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [archer, target] = app.simulation.fighters;
    const Vector2 = archer.position.constructor;
    target.position.x = 480;
    target.position.y = 480;
    app.simulation.entities = [];
    app.simulation.spawnArrow(archer, new Vector2(app.simulation.width - 2, 120), new Vector2(520, 0));
    const arrow = app.simulation.entities.find((entity) => entity.constructor.name === "ArrowProjectile");
    arrow.update(0.016, app.simulation);
    assert.ok(arrow.velocity.x < 0, "Arrow should bounce off the wall");
    assert.ok(
        Math.abs(arrow.angle - Math.atan2(arrow.velocity.y, arrow.velocity.x)) < 0.001,
        "Arrow facing should follow its reflected velocity"
    );
}

async function testOrbitShardRecharge(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [orbit, target] = app.simulation.fighters;
    const ability = orbit.ability;
    orbit.position.x = 480;
    orbit.position.y = 480;
    target.position = ability.getShardPositions()[0].clone();
    const hpBefore = target.hp;
    ability.update(0.016, target);
    assert.ok(target.hp < hpBefore, "Orbit shard should damage when it hits");
    assert.equal(ability.getActiveShardCount(), 2, "Hit orbit shard should disappear");
    assert.ok(ability.spinBurst > 0, "Orbit should spin faster after spending a shard");

    target.position.x = 80;
    target.position.y = 80;
    ability.update(0.86, target);
    ability.update(0.02, target);
    assert.ok(ability.getRefillingShard(), "Missing orbit shard should begin refilling after burst");
    assert.ok(
        ability.getShardRenderStates().some((shard) => shard.refilling && shard.progress > 0 && shard.progress < 1),
        "Refilling shard should render between the body and orbit"
    );
    ability.update(1.98, target);
    assert.equal(ability.getActiveShardCount(), 3, "Orbit shard should return after refill animation");

    ability.consumeShard(0);
    ability.consumeShard(1);
    ability.consumeShard(2);
    assert.equal(ability.getActiveShardCount(), 0, "All orbit shards can be spent");
    ability.update(0.016, target);
    assert.ok(ability.getRefillingShard(), "Orbit should immediately refill when every shard is gone");
}

async function testTournament(app) {
    app.playerStatAllocation = createRandomStatAllocation(() => 0);
    app.refreshPlayerSetup();
    await app.startTournament();
    const player = app.tournamentRoster.find((fighter) => fighter.id === app.playerFighterId);
    assert.ok(player.isPlayer, "Tournament roster should mark the user's random fighter");
    assert.equal(getSpentStatPoints(player.statAllocation), PLAYER_STAT_POINTS, "Player should spend all stat points");
    let matches = 0;
    while (!app.tournament.champion && matches < 8) {
        const match = app.currentTournamentMatch;
        assert.ok(match, "Tournament should expose an active match before champion");
        const desiredWinner = match.a;
        const loser = app.simulation.fighters.find((fighter) => fighter.id !== desiredWinner.id);
        const attacker = app.simulation.fighters.find((fighter) => fighter.id === desiredWinner.id);
        loser.takeDamage(999, attacker, "Forced KO");
        app.simulation.checkResult();
        app.simulation.update(2.3);
        app.finishMatch();
        matches += 1;
    }
    assert.equal(app.roster.length, 7, "Roster should include seven fighters");
    assert.equal(matches, 6, "Seven-fighter tournament should play six matches");
    assert.ok(app.tournament.champion, "Tournament should produce a champion");
    assert.ok(app.playerResult, "Tournament should record the user's final rank");
}

function testStatAllocationRules(app) {
    // Stat allocation logic is tested below via adjustStatAllocation / applyStatAllocation
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    let stepped = { hp: 0, damage: 0, speed: 0, skill: 0 };
    stepped = adjustStatAllocation(stepped, "hp", 10);
    stepped = adjustStatAllocation(stepped, "damage", 95);
    assert.deepEqual(
        stepped,
        { hp: 10, damage: 90, speed: 0, skill: 0 },
        "Large stat steps should clamp to the remaining budget"
    );
    stepped = adjustStatAllocation(stepped, "damage", -10);
    assert.equal(stepped.damage, 80, "Large negative stat steps should subtract multiple points");

    const allocation = { hp: 30, damage: 40, speed: 30, skill: 0, defense: 0 };
    const boosted = applyStatAllocation(archer, allocation, true);
    const { multiplier } = calculateStatMultiplier([30, 40, 30, 0, 0]);
    assert.equal(
        boosted.stats.hp,
        Number((archer.stats.hp * 1.3 * multiplier).toFixed(3)),
        "HP points should multiply base health and balance multiplier"
    );
    assert.equal(
        boosted.stats.damage,
        Number((archer.stats.damage * 1.4 * multiplier).toFixed(3)),
        "Damage points should multiply base damage and balance multiplier"
    );
    assert.equal(
        boosted.stats.speed,
        Number((archer.stats.speed * 1.3 * multiplier).toFixed(3)),
        "Speed points should multiply base speed and balance multiplier"
    );
    assert.equal("force" in boosted.stats, false, "Force should not exist as an unused gameplay stat");
    assert.equal(
        formatStatAllocation(allocation),
        "체력 +30% · 공격 +40% · 속도 +30% · 쿨타임 +0% · 방어력 +0%",
        "Allocation summary should show percentages instead of raw stats"
    );
    assert.equal(boosted.stats.radius, archer.stats.radius, "Radius should stay character-specific");
    assert.equal(boosted.stats.mass, archer.stats.mass, "Mass should stay character-specific");

    const roster = createTournamentRoster(app.roster, archer.id, allocation, () => 0);
    assert.equal(roster.length, app.roster.length, "Tournament roster should keep every fighter");
    assert.ok(
        roster.every((fighter) => getSpentStatPoints(fighter.statAllocation) === PLAYER_STAT_POINTS),
        "Every fighter should receive the same stat budget"
    );
}

function testStatBalanceSystem() {
    // 극단 올인 [100, 0, 0] → 표준편차 큼 → 배율 낮음
    const allIn = calculateStatMultiplier([100, 0, 0]);
    assert.ok(allIn.stdDev > 40, "All-in build should have high stdDev");
    assert.ok(
        allIn.multiplier < STAT_BALANCER_CONFIG.BASE_MULTIPLIER + STAT_BALANCER_CONFIG.MAX_BONUS * 0.5,
        "All-in build should get less than half of max bonus"
    );

    // 완벽 균등 [30, 30, 30] → 표준편차 0 → 최대 배율
    const even = calculateStatMultiplier([30, 30, 30]);
    assert.equal(even.stdDev, 0, "Even build should have zero stdDev");
    assert.equal(
        even.multiplier,
        STAT_BALANCER_CONFIG.BASE_MULTIPLIER + STAT_BALANCER_CONFIG.MAX_BONUS,
        "Even build should receive maximum bonus"
    );

    // 분산이 작을수록 multiplier가 높음
    const lowVar = calculateStatMultiplier([35, 30, 35]);
    const highVar = calculateStatMultiplier([70, 30, 0]);
    assert.ok(lowVar.multiplier > highVar.multiplier, "Lower variance build should have higher multiplier");
    assert.ok(
        lowVar.multiplier >= STAT_BALANCER_CONFIG.BASE_MULTIPLIER,
        "Multiplier should never drop below BASE_MULTIPLIER"
    );
    assert.ok(
        lowVar.multiplier <= STAT_BALANCER_CONFIG.BASE_MULTIPLIER + STAT_BALANCER_CONFIG.MAX_BONUS,
        "Multiplier should never exceed BASE_MULTIPLIER + MAX_BONUS"
    );
}

const app = await loadModuleApp();
testStatAllocationRules(app);
testStatBalanceSystem();
await testCloneSeedDash(app);
await testEaterFeast(app);
await testRageBallMomentum(app);
await testDashBallCooldownDash(app);
await testGrenadeAdaptiveFuse(app);
await testDamageShake(app);
await testArrowBounceFacing(app);
await testOrbitShardRecharge(app);
await testTournament(app);
console.log("regression tests ok");
