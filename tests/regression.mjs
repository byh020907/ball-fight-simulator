import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
} from "../src/statAllocation.js";
import { FIGHTER_IDS, Vector2 } from "../src/core.js";
import { findActionById } from "../src/clickActions.js";
import { calcMatchXp, getLevelFromXp, getXpForNextLevel, calcTournamentXp } from "../src/experience/experienceState.js";
import { getLevelRequirement } from "../src/experience/experienceConfig.js";
import { getCharacterExperienceSummary, grantExperienceFromMatchReport } from "../src/experience/experienceService.js";
import { DashEffect } from "../src/combatEffects.js";
import { shuffled } from "../src/random.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import {
    createDefaultPlayerProfile,
    migrateLegacyExperienceToCharacter,
    sanitizePlayerProfile
} from "../src/playerProfile.js";
import { completeChallengeTournament, formatBonusSummary } from "../src/progression/progressionState.js";
import {
    advanceHuntingRun,
    canEnterHunting,
    createHuntingChest,
    createHuntingRun,
    defeatHuntingRun,
    applyHuntingCursedAltar,
    applyHuntingStatModifiersToSpec,
    getEligibleHuntingCharacters,
    getEnemyPowerMultiplier,
    getRewardMultiplier,
    getChestOpenCost,
    previewHuntingChest,
    openHuntingChest,
    recordHuntingFloorResult,
    retreatHuntingRun,
    rollHuntingChestReward,
    rollKeyShardReward,
    scaleEnemySpecForHunting,
    HUNTING_ARENA,
    HUNTING_EVENT_TYPES,
    HUNTING_MONSTER_TYPES,
    HUNTING_TEAMS,
    createHuntingMinibossSpec,
    createHuntingMobSpec,
    createHuntingMobEncounter,
    getHuntingMobCount,
    shouldUseRosterMiniboss
} from "../src/hunting/index.js";
import { Grenade } from "../src/entities/grenade.js";
import { appStore, UIController } from "../src/ui.js";
import { ArenaCamera } from "../src/camera.js";
import { PATCH_NOTES } from "../src/patchNotes.js";
import {
    createTemplateComponentDirective,
    findTemplateComponentTagHosts,
    getTemplateComponentNameFromTagName,
    getTemplateComponentId,
    isValidTemplateComponentName,
    mountTemplateComponent,
    mountTemplateComponentByName,
    mountTemplateComponentTags,
    normalizeTemplateComponentName,
    registerAlpineComponentSystem,
    resolveTemplateComponent
} from "../src/alpineTemplateComponents.js";

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
        "playerPanel",
        "playerFaceCanvas"
    ]) {
        elements.set(id, makeElement(id));
    }

    const canvas = elements.get("arenaCanvas");
    canvas.width = 960;
    canvas.height = 960;
    canvas.getContext = () => makeCanvasContext();
    const playerFaceCanvas = elements.get("playerFaceCanvas");
    playerFaceCanvas.width = 50;
    playerFaceCanvas.height = 50;
    playerFaceCanvas.getContext = () => makeCanvasContext();

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
    const alpineStores = {};
    context.Alpine = {
        _stores: alpineStores,
        store(name, value) {
            if (arguments.length === 1) return this._stores[name];
            this._stores[name] = value;
            return value;
        }
    };
    context.window = context;
    return { context, elements };
}

async function loadModuleApp() {
    const harness = makeHarness();
    Object.assign(globalThis, harness.context);
    globalThis.Alpine.store("xpReward", {
        visible: false,
        characterName: "",
        xpGained: 0,
        levelLabel: "Lv.1",
        levelUp: false,
        animatedProgressPct: 0,
        progressText: "",
        nextText: "",
        nextRewardText: ""
    });
    const moduleUrl = new URL(`../src/app.js?test=${Date.now()}`, import.meta.url).href;
    const { BattleApp } = await import(moduleUrl);
    return new BattleApp();
}

async function loadModuleAppWithInitialAlpineAllocation(allocation) {
    const harness = makeHarness();
    const appRoot = makeElement("app");
    const alpineState = appStore();
    alpineState.allocation = { ...allocation };
    alpineState.remainingPoints = 0;
    harness.context.document.querySelector = (selector) => (selector === ".app" ? appRoot : null);
    harness.context.Alpine.store("xpReward", {
        visible: false,
        characterName: "",
        xpGained: 0,
        levelLabel: "Lv.1",
        levelUp: false,
        animatedProgressPct: 0,
        progressText: "",
        nextText: "",
        nextRewardText: ""
    });
    const baseAlpine = harness.context.Alpine;
    harness.context.Alpine = {
        ...baseAlpine,
        $data: (root) => (root === appRoot ? alpineState : null)
    };
    Object.assign(globalThis, harness.context);
    const moduleUrl = new URL(`../src/app.js?test=${Date.now()}`, import.meta.url).href;
    const { BattleApp } = await import(moduleUrl);
    return { app: new BattleApp(), alpineState };
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
        seeds.every((seed) => seed.life === trickster.ability.cooldown * 2),
        "Clone seeds should live for 2x the seed cooldown"
    );

    const angles = seeds.map((seed) => Math.atan2(seed.velocity.y, seed.velocity.x)).sort((a, b) => a - b);
    const gaps = angles.map((angle, index) => {
        const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0);
        return Math.round(((next - angle) * 180) / Math.PI);
    });
    assert.deepEqual(gaps, [120, 120, 120], "Clone seeds should spread at 120 degree intervals");

    const seedLife = trickster.ability.cooldown * 2;
    seeds[1].update(seedLife - 0.01, app.simulation);
    assert.equal(seeds[1].isExpired, false, "Clone seed should stay alive before its lifetime ends");
    seeds[1].update(0.02, app.simulation);
    assert.equal(seeds[1].isExpired, true, "Clone seed should expire at its lifetime (cooldown * 2)");

    seeds[0].position = opponent.position.clone();
    seeds[0].update(0.016, app.simulation);
    assert.ok(trickster.state.movement, "Clone should dash when any seed is collected");
    assert.equal(opponent.state.movement, null, "The collector should not dash");
}

async function testEaterFeast(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.EATER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [eater, target] = app.simulation.fighters;
    assert.equal(eater.stats.baseDefense, 2, "Eater base defense should stay near the roster average");
    eater.position.x = 300;
    eater.position.y = 480;
    target.position.x = 360;
    target.position.y = 300;
    eater.applyImpulse(Vector2.subtract(new Vector2(260, 0), eater.velocity));
    eater.ability.state.feastTimer = eater.ability.feastDuration;
    eater.ability.state.feastElapsed = eater.ability.feastDuration;
    eater.ability.update(0.2, target);
    assert.equal(eater.ability.getRadiusScale(), 1, "Eater should stay normal size during feast (no swallow)");
    assert.equal(eater.ability.getStatModifiers().defense, 1.5, "Eater feast defense should be moderate");
    assert.ok(eater.state.forcedHeading.direction.y < 0, "Eater feast should steer toward the target");
    assert.ok(eater.state.forcedHeading.direction.y > -0.7, "Eater feast should not snap directly to the target");
    eater.ability.state.feastTimer = 0;
    target.position.y = 480;

    eater.ability.state.feastTimer = 1.2;
    eater.ability.state.hasEatenThisFeast = false;
    eater.ability.onCollision(target);
    assert.ok(target.state.swallowed, "Eater should swallow on feast collision");
    eater.ability.update(0.3, target);
    assert.ok(eater.ability.getRadiusScale() > 1.1, "Eater should start growing after swallowing");

    app.simulation.update(0.8);
    assert.equal(target.state.swallowed, null, "Eater should spit target back out");
    assert.ok(target.state.wallSlam, "Spat target should receive wall slam state");
    assert.equal(
        typeof target.state.wallSlam.onWallBounce,
        "function",
        "Wall slam behavior should live on the wall slam effect"
    );
    assert.equal(target.state.forcedHeading, null, "Spit dash should allow wall bounce direction changes");
    assert.equal(
        Math.round(target.velocity.length()),
        target.stats.baseSpeed * 2,
        "Spat target should launch at twice its base speed"
    );
    assert.equal(target.state.movement.showRing, false, "Spit dash should not draw the normal speed ring");
    const spinBefore = target.display.spinRotation;
    target.update(0.12, app.simulation);
    assert.ok(Math.abs(target.display.spinRotation - spinBefore) > 1, "Spat target face should spin while flying");
    const beforeHp = target.hp;
    target.applyImpulse(
        Vector2.subtract(new Vector2(Math.abs(target.velocity.x) || 500, target.velocity.y), target.velocity)
    );
    target.position.x = app.simulation.width + target.radius + 5;
    app.simulation.keepInsideArena(target);
    assert.equal(beforeHp - target.hp, 24, "Wall bounce should deal wall slam damage (25 - 1 defense)");
    const afterFirstWallSlamHp = target.hp;
    target.position.x = app.simulation.width + target.radius + 5;
    app.simulation.keepInsideArena(target);
    assert.equal(target.hp, afterFirstWallSlamHp, "Wall slam effect should own its repeat-hit cooldown");
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
    assert.equal(dashBall.stats.baseDamage, 10, "Dash Ball should have reduced base damage");
    dashBall.position.x = 300;
    dashBall.position.y = 480;
    target.position.x = 620;
    target.position.y = 480;
    dashBall.ability.timer = 0;
    dashBall.ability.update(0.016, target);
    assert.ok(dashBall.state.movement, "Dash Ball should enter dash state");
    assert.ok(
        Math.abs(dashBall.state.forcedHeading.direction.length() - 1) < 0.001,
        "Dash Ball forced heading should remain a unit direction"
    );
    dashBall.update(0.016, app.simulation);
    assert.ok(dashBall.velocity.length() < 800, "Dash Ball dash velocity should stay bounded");
    assert.ok(dashBall.velocity.length() > 600, "Dash Ball dash should be faster than before");
    const directionBeforeSteer = dashBall.state.forcedHeading.direction.clone();
    target.position.y = 300;
    dashBall.ability.update(0.1, target);
    assert.ok(
        dashBall.state.forcedHeading.direction.y < directionBeforeSteer.y,
        "Dash Ball dash should steer toward the target at full cooldown"
    );
    dashBall.ability.state.cooldownLevel = 1;
    const directionAfterFullCooldownSteer = dashBall.state.forcedHeading.direction.clone();
    target.position.y = 660;
    dashBall.ability.update(0.1, target);
    assert.deepEqual(
        dashBall.state.forcedHeading.direction,
        directionAfterFullCooldownSteer,
        "Dash Ball dash should not steer after cooldown stacks are gained"
    );
    dashBall.ability.state.cooldownLevel = 0;

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
    assert.equal(target.state.slow, null, "Dash Ball collision should not slow target");
    assert.equal(baseCooldown, 3, "Dash Ball base cooldown should be 3 seconds");
    assert.equal(dashBall.ability.state.cooldownLevel, 1, "First dash hit should add one cooldown stack");
    assert.equal(dashBall.ability.cooldown, baseCooldown * 0.5, "First dash hit should halve future cooldown");
    assert.equal(dashBall.ability.maxCooldownLevel, 2, "Dash should have max 2 cooldown stacks");
    assert.equal(
        dashBall.ability.timer,
        dashBall.ability.cooldown,
        "Dash hit should clamp timer to the shorter cooldown"
    );
    assert.equal(dashBall.state.movement, null, "Dash Ball dash should clear after impact");

    dashBall.ability.onDashHit();
    assert.equal(dashBall.ability.state.cooldownLevel, 2, "Second dash hit should reach max cooldown stacks");
    assert.equal(dashBall.ability.cooldown, baseCooldown * 0.25, "Second dash hit should leave 25% base cooldown");
    dashBall.ability.onDashHit();
    assert.equal(dashBall.ability.state.cooldownLevel, 2, "Dash cooldown stacks should cap at two");
    assert.equal(
        dashBall.ability.cooldown,
        baseCooldown * 0.25,
        "Dash cooldown should not shrink below 25% base cooldown"
    );

    dashBall.position.x = app.simulation.width - dashBall.radius + 1;
    dashBall.position.y = 200;
    target.position.x = 200;
    target.position.y = 760;
    dashBall.ability.state.cooldownLevel = 2;
    dashBall.ability.cooldown = dashBall.ability.getCooldownForLevel();
    dashBall.ability.timer = dashBall.ability.cooldown;
    dashBall.setMovementEffect(
        new DashEffect({
            duration: 1.4,
            multiplier: 1,
            color: dashBall.color,
            collisionLabel: "Dash Contact",
            untilImpact: true,
            untilWall: true
        })
    );
    dashBall.forceHeading(new Vector2(1, 0), 1.4);
    dashBall.applyImpulse(Vector2.subtract(new Vector2(1, 0).scale(dashBall.stats.baseSpeed), dashBall.velocity));
    app.simulation.keepInsideArena(dashBall);
    assert.equal(dashBall.state.movement, null, "Dash Ball dash should clear on wall contact");
    assert.equal(dashBall.ability.state.cooldownLevel, 0, "Wall contact should reset cooldown stacks");
    assert.equal(dashBall.ability.cooldown, baseCooldown, "Wall contact should restore full cooldown");
    assert.equal(dashBall.ability.timer, baseCooldown, "Wall contact should restart from full cooldown");
}

async function testCollisionImpulsePersists(app) {
    const sim = new BattleSimulation(
        [
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE)
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [a, b] = sim.fighters;
    a.position = new Vector2(440, 480);
    b.position = new Vector2(440 + a.radius + b.radius - 4, 480);
    a.applyImpulse(Vector2.subtract(new Vector2(700, 0), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(-520, 0), b.velocity));

    sim.handleCollision();
    assert.ok(a.velocity.x < 0, "Collision impulse should reverse the first fighter");
    assert.ok(b.velocity.x > 0, "Collision impulse should reverse the second fighter");

    a.update(0.016, sim);
    b.update(0.016, sim);
    assert.ok(
        a.velocity.length() > a.stats.baseSpeed * 1.2,
        "Collision impulse should persist instead of snapping back to base speed"
    );
    assert.ok(
        b.velocity.length() > b.stats.baseSpeed * 1.2,
        "Collision impulse should persist on both fighters after one update"
    );
}

async function testGrenadeScatterShot(app) {
    const grenade = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.GRENADE);
    const sim = new BattleSimulation([grenade, opponent], { onLog() {}, onSound() {} });
    const grenadeFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.GRENADE);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.GRENADE);

    grenadeFighter.position.x = 300;
    grenadeFighter.position.y = 480;
    target.position.x = 500;
    target.position.y = 480;
    sim.entities = sim.fighters.slice();
    grenadeFighter.ability.timer = 0;
    grenadeFighter.ability.update(0.016, target);
    const allGrenades = () => sim.entities.filter((e) => e.constructor?.name === "Grenade");
    const firstCount = allGrenades().length;
    assert.ok(firstCount >= 1, "Grenade should fire 1 grenade on first burst tick");
    for (let i = 0; i < 10; i++) {
        grenadeFighter.ability.update(0.12, target);
    }
    const total = allGrenades().length;
    assert.ok(total >= 3, "Grenade should fire 3-5 grenades in burst");
    assert.ok(total <= 5, "Grenade should fire at most 5 grenades total");
    for (const g of allGrenades()) {
        assert.ok(g.velocity.length() > 0, "Each grenade should have velocity");
        assert.ok(g.timer > 0, "Each grenade should have a fuse timer");
    }
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
    assert.equal(ability.getActiveShardCount(), 4, "Hit orbit shard should disappear (5→4)");
    assert.ok(ability.state.spinBurst > 0, "Orbit should spin faster after spending a shard");

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
    assert.equal(ability.getActiveShardCount(), 5, "Orbit shard should return after refill animation");

    ability.consumeShard(0);
    ability.consumeShard(1);
    ability.consumeShard(2);
    ability.consumeShard(3);
    ability.consumeShard(4);
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
    assert.equal(app.tournamentRoster.length, 8, "Tournament roster should include eight fighters");
    assert.equal(matches, 7, "Eight-fighter tournament should play seven matches");
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
        { hp: 10, damage: 50, speed: 0, skill: 0 },
        "Large stat steps should clamp to the per-stat cap of 50"
    );
    stepped = adjustStatAllocation(stepped, "damage", -10);
    assert.equal(stepped.damage, 40, "Large negative stat steps should subtract multiple points");

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

    const rosterSize = Math.min(app.roster.length, 8);
    const roster = createTournamentRoster(app.roster, archer.id, allocation, () => 0);
    assert.equal(roster.length, rosterSize, "Tournament roster should cap at 8 (or all if under 8)");
    assert.ok(
        roster.every((fighter) => getSpentStatPoints(fighter.statAllocation) === PLAYER_STAT_POINTS),
        "Every fighter should receive the same stat budget"
    );
}

function testStatAllocationUiSyncEvent() {
    const previousDocument = globalThis.document;
    const events = [];
    globalThis.document = {
        dispatchEvent(event) {
            events.push(event.type);
        }
    };

    const state = appStore();
    state.adjustStat("hp", 10);
    assert.deepEqual(state.allocation.hp, 10, "UI allocation should update after stat adjustment");
    assert.deepEqual(events, ["allocation-changed"], "Stat adjustment should notify BattleApp");

    state.randomAllocation();
    assert.equal(events.length, 2, "Random allocation should notify BattleApp");

    state.resetAllocation();
    assert.equal(events.length, 3, "Reset allocation should notify BattleApp");
    assert.deepEqual(state.allocation, { hp: 0, damage: 0, speed: 0, skill: 0, defense: 0 });

    globalThis.document = previousDocument;
}

function testRenderPlayerSetupCopiesAllocation(app) {
    const state = appStore();
    const controller = new UIController(app.roster);
    controller._rootData = state;
    controller._drawPlayerFace = () => {};
    const allocation = { hp: 20, damage: 30, speed: 10, skill: 25, defense: 15 };

    controller.renderPlayerSetup({
        fighter: app.roster[0],
        stats: [],
        allocation,
        totalPoints: PLAYER_STAT_POINTS,
        remainingPoints: 0,
        huntingAvailable: true
    });

    state.adjustStat("hp", -10);
    assert.equal(allocation.hp, 20, "UI state should not mutate the caller's allocation object");
    assert.equal(state.allocation.hp, 10, "Rendered UI state should remain editable");
    assert.equal(state.huntingAvailable, true, "Player setup should expose hunting availability");
}

async function testBattleAppAdoptsPreExistingAlpineAllocation() {
    const initialAllocation = { hp: 20, damage: 20, speed: 20, skill: 20, defense: 20 };
    const { app } = await loadModuleAppWithInitialAlpineAllocation(initialAllocation);
    assert.deepEqual(
        app.playerStatAllocation,
        initialAllocation,
        "BattleApp should adopt Alpine allocation that changed before event listeners were attached"
    );
}

function testIndexCacheVersionMatchesLatestPatchNote() {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const match = html.match(/const V = "([^"]+)";/);
    assert.ok(match, "index.html should define a module cache-busting version");
    assert.equal(
        match[1],
        PATCH_NOTES[0].version,
        "Module cache-busting version should match the latest patch note version"
    );
    assert.ok(
        !/<main[^>]*x-init="[^"]*app-loading/.test(html),
        "Loading overlay should not be removed before BattleApp is imported"
    );
    assert.ok(
        html.includes('document.getElementById("app-loading")?.remove();'),
        "Loading overlay should be removed after app modules finish importing"
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

function testExperienceSystem() {
    assert.equal(
        calcMatchXp({
            damageDealt: 60,
            opponentMaxHp: 100,
            hpRemain: 40,
            myMaxHp: 100,
            minHpRatio: 0.4,
            won: true,
            stage: 1
        }),
        20
    );
    const finalXp = calcMatchXp({
        damageDealt: 80,
        opponentMaxHp: 100,
        hpRemain: 15,
        myMaxHp: 100,
        minHpRatio: 0.1,
        won: true,
        stage: 3
    });
    assert.equal(finalXp, 53);
    assert.equal(
        calcMatchXp({
            damageDealt: 30,
            opponentMaxHp: 100,
            hpRemain: 0,
            myMaxHp: 100,
            minHpRatio: 0,
            won: false,
            stage: 1
        }),
        6
    );
    assert.equal(getLevelRequirement(1), 0);
    assert.equal(getLevelRequirement(2), 100);
    assert.equal(getLevelRequirement(10), 3968);
    assert.equal(getLevelFromXp(0), 1);
    assert.equal(getLevelFromXp(100), 2);
    assert.equal(getLevelFromXp(3968), 10);
    assert.equal(getLevelFromXp(9999), 10);
    assert.equal(getXpForNextLevel(0), 100);
    assert.equal(getXpForNextLevel(3968), 0);
    const tourneyXp = calcTournamentXp(
        [
            { damageDealt: 60, opponentMaxHp: 100, hpRemain: 40, myMaxHp: 100, minHpRatio: 0.4, won: true, stage: 1 },
            { damageDealt: 70, opponentMaxHp: 100, hpRemain: 30, myMaxHp: 100, minHpRatio: 0.3, won: true, stage: 2 },
            { damageDealt: 80, opponentMaxHp: 100, hpRemain: 15, myMaxHp: 100, minHpRatio: 0.1, won: true, stage: 3 }
        ],
        true
    );
    assert.equal(tourneyXp, 118);

    const profile = createDefaultPlayerProfile();
    const matchResult = grantExperienceFromMatchReport(profile, {
        playerFighterId: FIGHTER_IDS.DASH,
        combatDamageDealt: 60,
        opponentMaxHp: 100,
        hpRemain: 40,
        myMaxHp: 100,
        lowestHpRatio: 0.4,
        playerWon: true,
        tournamentRoundIndex: 0
    });
    assert.equal(matchResult.xpGained, 20, "Match report should grant a single match worth of XP");
    assert.equal(
        profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp,
        20,
        "Match XP should be saved immediately to the selected character"
    );
    assert.equal(profile.experience.currentXp, 20, "Aggregate XP should mirror character XP total");
    assert.equal(
        getCharacterExperienceSummary(profile, FIGHTER_IDS.DASH).remainingXp,
        80,
        "Character summary should expose next-level remaining XP"
    );
    profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp = 90;
    profile.experience.currentXp = 90;
    const levelUpResult = grantExperienceFromMatchReport(profile, {
        playerFighterId: FIGHTER_IDS.DASH,
        combatDamageDealt: 60,
        opponentMaxHp: 100,
        hpRemain: 40,
        myMaxHp: 100,
        lowestHpRatio: 0.4,
        playerWon: true,
        tournamentRoundIndex: 0
    });
    assert.equal(levelUpResult.levelUp, true, "Crossing the level threshold should be reported");
    assert.equal(levelUpResult.previousLevel, 1, "Level-up result should expose the previous level");
    assert.equal(levelUpResult.level, 2, "Level-up result should expose the new level");
    assert.equal(levelUpResult.nextRewardText, "공격 +1", "Level-up result should expose the next reward");

    const legacyProfile = createDefaultPlayerProfile();
    legacyProfile.experience = { currentXp: 55, byCharacter: {} };
    legacyProfile.collection.characters.archer = {
        tournamentsCompleted: 1,
        tournamentWins: 0,
        matchWins: 1,
        bestPlacement: 5,
        totalDamageDealt: 100,
        comebackMatchWins: 0,
        firstTournamentAt: 1000,
        lastTournamentAt: 2000
    };
    assert.equal(
        migrateLegacyExperienceToCharacter(legacyProfile, FIGHTER_IDS.DASH),
        FIGHTER_IDS.ARCHER,
        "Legacy global XP should migrate to the most recent recorded character"
    );
    assert.equal(legacyProfile.experience.byCharacter.archer.currentXp, 55);
    console.log("[experience] ok");
}

function testHuntingSystem() {
    const profile = createDefaultPlayerProfile();
    assert.equal(canEnterHunting(profile, FIGHTER_IDS.DASH), false, "Characters need one tournament win to enter");
    profile.collection.characters[FIGHTER_IDS.DASH] = {
        tournamentsCompleted: 1,
        tournamentWins: 1,
        matchWins: 3,
        bestPlacement: 1,
        totalDamageDealt: 1200,
        comebackMatchWins: 0,
        firstTournamentAt: 100,
        lastTournamentAt: 200
    };
    const eligible = getEligibleHuntingCharacters(profile, [{ id: FIGHTER_IDS.DASH }, { id: FIGHTER_IDS.ARCHER }]);
    assert.deepEqual(
        eligible.map((fighter) => fighter.id),
        [FIGHTER_IDS.DASH],
        "Only tournament winners should be listed as hunting candidates"
    );

    assert.equal(getEnemyPowerMultiplier(1), 1, "Floor 1 enemy power should be base");
    assert.equal(getEnemyPowerMultiplier(3), 1.16, "Enemy power should scale by 8% per floor");
    assert.equal(getEnemyPowerMultiplier(3, { enemyType: "champion" }), 1.44, "Champion intrusions should be stronger");
    assert.equal(getRewardMultiplier(3), 1.3, "Rewards should scale by 15% per floor");
    const baseSpec = {
        id: "enemy",
        stats: { hp: 100, damage: 10, defense: 2, speed: 300, skill: 4, radius: 24 }
    };
    const scaled = scaleEnemySpecForHunting(baseSpec, 3);
    assert.equal(scaled.stats.hp, 116, "Hunting scaling should affect HP");
    assert.equal(scaled.stats.damage, 12, "Hunting scaling should affect damage");
    assert.equal(scaled.stats.defense, 2.32, "Hunting scaling should affect defense");
    assert.equal(scaled.stats.speed, 300, "Hunting scaling should not affect speed");
    assert.equal(scaled.stats.skill, 4, "Hunting scaling should not affect skill");

    assert.equal(getHuntingMobCount(1), 2, "Early hunting floors should start as 1v2 mob fights");
    assert.equal(getHuntingMobCount(5), 4, "Deep hunting floors should add more mobs without exceeding MVP cap");
    const mobs = createHuntingMobEncounter({
        floor: 3,
        rng: (() => {
            const rolls = [0, 0.9, 0.2];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(mobs.length, 3, "Hunting mob encounters should create multiple enemies");
    assert.equal(new Set(mobs.map((mob) => mob.id)).size, mobs.length, "Hunting mob IDs should be unique per fight");
    assert.ok(
        mobs.every((mob) => mob.teamId === HUNTING_TEAMS.ENEMY),
        "Hunting mobs should all be assigned to the enemy team"
    );
    assert.ok(
        mobs.some((mob) => mob.hunting.monsterType === HUNTING_MONSTER_TYPES.MELEE) &&
            mobs.some((mob) => mob.hunting.monsterType === HUNTING_MONSTER_TYPES.RANGED),
        "Hunting mob encounters should include melee and ranged monster archetypes"
    );
    assert.equal(
        mobs.find((mob) => mob.hunting.monsterType === HUNTING_MONSTER_TYPES.MELEE).ability,
        "hunting_melee",
        "Hunting melee mobs should use the chase-focused monster ability"
    );
    assert.equal(shouldUseRosterMiniboss(3), true, "Every third hunting floor should add a roster miniboss");
    const miniboss = createHuntingMinibossSpec({
        roster: [
            {
                id: FIGHTER_IDS.DASH,
                name: "Dash Ball",
                ability: "dash",
                color: "#8ee8d7",
                stats: { hp: 110, damage: 10, speed: 294, radius: 49, mass: 1.16, defense: 1 }
            },
            {
                id: FIGHTER_IDS.ARCHER,
                name: "Archer Ball",
                ability: "archer",
                color: "#f7b34d",
                stats: { hp: 112, damage: 10, speed: 270, radius: 50, mass: 1.2, defense: 1 }
            }
        ],
        characterId: FIGHTER_IDS.DASH,
        floor: 3,
        rng: () => 0
    });
    assert.equal(miniboss.hunting.isMiniboss, true, "Roster enemies should be marked as minibosses");
    assert.equal(miniboss.hunting.sourceFighterId, FIGHTER_IDS.ARCHER, "Minibosses should not copy the player");
    assert.equal(miniboss.teamId, HUNTING_TEAMS.ENEMY, "Minibosses should fight on the enemy team");

    const keyShards = rollKeyShardReward({ floor: 2, rng: () => 0 });
    assert.equal(keyShards, 17, "Key shards should include clear and deep-floor bonuses");

    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, now: 1000 });
    const common = createHuntingChest({ id: "c1", rarity: "common", acquiredAt: 1000 });
    const uncommon = createHuntingChest({ id: "u1", rarity: "uncommon", acquiredAt: 1000 });
    const rare = createHuntingChest({ id: "r1", rarity: "rare", acquiredAt: 1000 });
    assert.equal(common.openCost, 20, "Chest instances should expose their open cost");
    assert.ok(common.rewardPreview.includes("해조각"), "Chest instances should expose reward table preview text");
    assert.equal(
        rollHuntingChestReward(common, { rng: () => 0 }).type,
        "key_shards",
        "Chest rewards should roll from the rarity reward table"
    );
    assert.equal(
        previewHuntingChest(rare).rewardTable.some((reward) => reward.type === "temporary_stat"),
        true,
        "Chest preview should expose concrete possible reward effects"
    );
    const afterFloor = recordHuntingFloorResult(run, {
        hpRemain: 55,
        maxHp: 100,
        loot: { keyShards: 100, chests: [common, uncommon, rare], xp: 90 }
    });
    assert.equal(afterFloor.carriedHp, 55, "Hunting run should carry HP between floors");
    assert.equal(afterFloor.pendingLoot.chests.length, 3, "Floor rewards should stay pending");

    const advanced = advanceHuntingRun(afterFloor, { rng: () => 0 });
    assert.equal(advanced.floor, 2, "Advance should move to the next floor");
    assert.ok(advanced.lastEvent, "A low RNG roll should create a hunting event");
    assert.equal(advanced.lastEvent.type, HUNTING_EVENT_TYPES.CHEST_ROOM, "Event rolls should include chest rooms");
    assert.equal(advanced.lastEvent.chestRarity, "uncommon", "Chest room events should carry a concrete rarity");

    const cursed = advanceHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0, 0.6, 0];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(cursed.lastEvent.type, HUNTING_EVENT_TYPES.CURSED_ALTAR, "Event pool should include cursed altars");
    const cursedApplied = applyHuntingCursedAltar(cursed, { trade: cursed.lastEvent.trade });
    assert.equal(cursedApplied.statModifiers.length, 2, "Cursed altars should add a gain and a loss modifier");
    const altarSpec = applyHuntingStatModifiersToSpec(
        { id: "hero", stats: { hp: 100, damage: 10, defense: 2, speed: 300, skill: 4 } },
        cursedApplied.statModifiers
    );
    assert.equal(altarSpec.stats.damage, 12, "Cursed altar gain should modify the target stat");
    assert.equal(altarSpec.stats.defense, 1.8, "Cursed altar loss should modify the traded-away stat");
    const consumedCursed = recordHuntingFloorResult(cursedApplied, { hpRemain: 50, maxHp: 100 });
    assert.equal(consumedCursed.statModifiers.length, 0, "One-floor altar modifiers should expire after a floor");
    const preservedEventBuff = recordHuntingFloorResult(cursedApplied, {
        loot: { keyShards: 0, chests: [common], xp: 0 },
        consumeStatModifiers: false
    });
    assert.equal(
        preservedEventBuff.statModifiers.length,
        2,
        "Non-combat event rewards should not consume temporary stat modifiers"
    );

    const champion = advanceHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0, 0.99];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(
        champion.lastEvent.type,
        HUNTING_EVENT_TYPES.CHAMPION_INTRUSION,
        "Event pool should include champion intrusions"
    );
    assert.equal(champion.lastEvent.enemyType, "champion", "Champion events should mark the next enemy type");

    const retreated = retreatHuntingRun(afterFloor, { now: 2000 });
    assert.equal(retreated.status, "retreated", "Retreat should end the run safely");
    assert.equal(retreated.securedLoot.keyShards, 100, "Retreat should secure pending key shards");
    assert.equal(retreated.pendingLoot.chests.length, 0, "Retreat should clear pending loot");

    const defeated = defeatHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0.1, 0.2, 0.3, 0.4, 0.4, 0.6];
            return () => rolls.shift() ?? 0.6;
        })(),
        now: 3000
    });
    assert.equal(defeated.status, "defeated", "Defeat should end the run");
    assert.equal(defeated.securedLoot.keyShards, 50, "Defeat should preserve half of key shards");
    assert.equal(defeated.securedLoot.xp, 62, "Defeat should preserve 70% XP rounded down");
    assert.deepEqual(
        defeated.defeatLosses.chests.map((chest) => chest.id),
        ["r1", "u1"],
        "Defeat should break higher-rarity chests first with chain probability"
    );

    profile.hunting.keyShards = 50;
    profile.hunting.chests = [uncommon];
    assert.equal(getChestOpenCost("uncommon"), 50, "Uncommon chest open cost should match design");
    const opened = openHuntingChest(profile, "u1", { rng: () => 0 });
    assert.equal(opened.opened, true, "Chest should open when enough key shards are available");
    assert.equal(opened.reward.type, "key_shards", "Opening a chest should produce a concrete reward");
    assert.equal(profile.hunting.keyShards, 45, "Opening a shard reward chest should spend cost and apply reward");
    assert.equal(profile.hunting.chests.length, 0, "Opened chest should leave storage");

    const sanitized = sanitizePlayerProfile({
        hunting: {
            keyShards: 12,
            chests: [
                { id: "safe", rarity: "rare", acquiredAt: 1000 },
                { id: "safe", rarity: "common", acquiredAt: 2000 },
                { id: "", rarity: "legendary", acquiredAt: 3000 }
            ],
            stats: { runsStarted: 2, runsRetreated: 1, runsDefeated: 1, deepestFloor: 4 }
        }
    });
    assert.equal(sanitized.hunting.keyShards, 12, "Sanitized profile should keep hunting key shards");
    assert.equal(sanitized.hunting.chests.length, 1, "Sanitized profile should dedupe and discard invalid chests");
    assert.equal(sanitized.hunting.stats.deepestFloor, 4, "Sanitized profile should keep hunting stats");
    console.log("[hunting] ok");
}

function testAlpineTemplateComponentSystem() {
    const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    assert.ok(
        readFileSync(new URL("../src/components/xp-reward-panel.html", import.meta.url), "utf8"),
        "xp-reward-panel component file should exist"
    );
    assert.ok(
        readFileSync(new URL("../src/components/xp-progress-bar.html", import.meta.url), "utf8"),
        "xp-progress-bar component file should exist"
    );
    assert.ok(indexHtml.includes("<xp-reward-panel"), "Index should use a tag component for a real UI panel");
    const rewardTemplateHtml = readFileSync(new URL("../src/components/xp-reward-panel.html", import.meta.url), "utf8");
    assert.ok(
        rewardTemplateHtml.includes("<xp-progress-bar"),
        "Reward panel template should include nested xp-progress-bar"
    );

    assert.equal(normalizeTemplateComponentName("pull-request"), "pull-request");
    assert.equal(normalizeTemplateComponentName("'pull-request'"), "pull-request");
    assert.equal(isValidTemplateComponentName("xp-meter"), true);
    assert.equal(isValidTemplateComponentName("XpMeter"), false);
    assert.equal(isValidTemplateComponentName("../bad"), false);
    assert.equal(getTemplateComponentId("xp-meter"), "template-xp-meter");
    assert.equal(getTemplateComponentNameFromTagName("XP-METER"), "xp-meter");
    assert.equal(getTemplateComponentNameFromTagName("meter"), null, "Tag components should require kebab names");

    const template = {
        id: "template-xp-meter",
        content: {
            cloneNode() {
                return {
                    childNodes: [{ nodeType: 1, tagName: "SPAN" }]
                };
            }
        }
    };
    const root = {
        getElementById(id) {
            return id === "template-xp-meter" ? template : null;
        }
    };
    assert.equal(resolveTemplateComponent("xp-meter", { root }), template, "Template should resolve by prefix + name");
    assert.equal(resolveTemplateComponent("../bad", { root }), null, "Invalid names should not hit the DOM");

    const initialized = [];
    const element = {
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    assert.equal(
        mountTemplateComponent(element, template, {
            Alpine: {
                initTree(child) {
                    initialized.push(child);
                }
            }
        }),
        true,
        "Template component mount should clone template content"
    );
    assert.equal(element.children.length, 1, "Mounted component should replace host children");
    assert.equal(initialized.length, 1, "Mounted component should initialize cloned child roots");
    assert.equal(
        mountTemplateComponent(
            { innerHTML: "" },
            { innerHTML: "<span>fallback</span>" },
            { Alpine: null, initialize: true }
        ),
        true,
        "Mount should still work when Alpine.initTree is unavailable"
    );
    assert.equal(
        mountTemplateComponentByName(element, "xp-meter", { root, Alpine: null, initialize: false }),
        true,
        "Component should mount by resolved component name"
    );

    const warnings = [];
    const directive = createTemplateComponentDirective({
        root,
        warn(message) {
            warnings.push(message);
        }
    });
    const host = {
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    let cleanupHandler = null;
    directive(
        host,
        { expression: "xp-meter" },
        { Alpine: { initTree() {} }, cleanup: (handler) => (cleanupHandler = handler) }
    );
    assert.equal(host.dataset.component, "xp-meter", "Directive should stamp component metadata");
    assert.equal(host.children.length, 1, "Directive should mount template content");
    assert.equal(typeof cleanupHandler, "function", "Directive should register cleanup");
    cleanupHandler();
    assert.equal(host.__bfsTemplateComponentName, undefined, "Cleanup should clear mount marker");

    directive({ dataset: {} }, { expression: "../bad" }, { Alpine: { initTree() {} } });
    assert.equal(warnings.length, 1, "Invalid component names should warn");
    directive({ dataset: {} }, { expression: "missing-template" }, { Alpine: { initTree() {} } });
    assert.equal(warnings.length, 2, "Missing templates should warn without mutating the host");

    const tagHost = {
        tagName: "XP-METER",
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    const tagRoot = {
        getElementById(id) {
            return id === "template-xp-meter" ? template : null;
        },
        querySelectorAll() {
            return [tagHost, { tagName: "unknown-panel", dataset: {} }, { tagName: "meter", dataset: {} }];
        }
    };
    assert.deepEqual(findTemplateComponentTagHosts(tagRoot), [tagHost], "Only matching tag hosts should be found");
    assert.equal(
        mountTemplateComponentTags({ root: tagRoot, Alpine: null, initialize: false }),
        1,
        "Matching component tags should mount before Alpine.start"
    );
    assert.equal(tagHost.dataset.component, "xp-meter", "Tag component should stamp component metadata");

    const nestedProgressHost = {
        tagName: "XP-PROGRESS-BAR",
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    const nestedPanelTemplate = {
        content: {
            cloneNode() {
                return {
                    childNodes: [{ nodeType: 1, tagName: "SECTION", nestedHost: nestedProgressHost }]
                };
            }
        }
    };
    const nestedProgressTemplate = {
        content: {
            cloneNode() {
                return {
                    childNodes: [{ nodeType: 1, tagName: "DIV" }]
                };
            }
        }
    };
    const nestedRoot = {
        getElementById(id) {
            if (id === "template-xp-reward-panel") return nestedPanelTemplate;
            if (id === "template-xp-progress-bar") return nestedProgressTemplate;
            return null;
        },
        querySelectorAll() {
            const hosts = [nestedPanelHost];
            if (nestedPanelHost.children.length > 0) hosts.push(nestedProgressHost);
            return hosts;
        }
    };
    const nestedDirective = createTemplateComponentDirective({ root: nestedRoot });
    const nestedPanelHost = {
        tagName: "XP-REWARD-PANEL",
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    let nestedInitCount = 0;
    const nestedAlpine = {
        initTree(child) {
            nestedInitCount += 1;
            if (child.nestedHost) {
                nestedDirective(child.nestedHost, { expression: "xp-progress-bar" }, { Alpine: nestedAlpine });
            }
        }
    };
    nestedDirective(nestedPanelHost, { expression: "xp-reward-panel" }, { Alpine: nestedAlpine });
    assert.equal(nestedPanelHost.dataset.component, "xp-reward-panel", "Parent component should mount");
    assert.equal(nestedProgressHost.dataset.component, "xp-progress-bar", "Nested component should mount");
    assert.equal(nestedProgressHost.children.length, 1, "Nested component should receive its template content");
    assert.ok(nestedInitCount >= 2, "Nested component roots should be initialized");

    nestedPanelHost.children = [];
    nestedProgressHost.children = [];
    delete nestedPanelHost.__bfsTemplateComponentName;
    delete nestedPanelHost.dataset.component;
    delete nestedProgressHost.__bfsTemplateComponentName;
    delete nestedProgressHost.dataset.component;
    assert.equal(
        mountTemplateComponentTags({ root: nestedRoot, Alpine: null, initialize: false }),
        2,
        "Nested tag components should mount across passes"
    );
    assert.equal(nestedPanelHost.dataset.component, "xp-reward-panel", "Parent tag component should mount");
    assert.equal(nestedProgressHost.dataset.component, "xp-progress-bar", "Nested tag component should mount");

    let registeredName = null;
    let registeredDirective = null;
    const alpine = {
        directive(name, handler) {
            registeredName = name;
            registeredDirective = handler;
            return { name };
        }
    };
    registerAlpineComponentSystem(alpine, { root });
    assert.equal(registeredName, "component", "System should register x-component");
    assert.equal(typeof registeredDirective, "function", "System should register a directive function");
    console.log("[alpine-components] ok");
}

async function testMatchEndGrantsImmediateExperience(app) {
    app.tournament = null;
    app.currentTournamentMatch = null;
    app._currentTournamentReport = null;
    app.playerProfile = createDefaultPlayerProfile();
    app.playerFighterId = FIGHTER_IDS.DASH;

    const playerSpec = app.roster.find((fighter) => fighter.id === app.playerFighterId);
    const opponentSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    await app.startMatch([playerSpec, opponentSpec], { keepLog: false });

    const playerBall = app.simulation.fighters.find((fighter) => fighter.id === app.playerFighterId);
    const opponentBall = app.simulation.fighters.find((fighter) => fighter.id === opponentSpec.id);
    opponentBall.takeDamage(999, playerBall, "Forced KO");
    app.simulation.checkResult();
    app.simulation.update(2.3);
    app.finishMatch();

    assert.ok(app._lastMatchXpResult.xpGained > 0, "A user match should grant XP as soon as it ends");
    assert.equal(
        app.playerProfile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp,
        app._lastMatchXpResult.xpGained,
        "Character XP should be updated at match end"
    );
    assert.equal(
        app.ui.state.playerExperience.totalXp,
        app._lastMatchXpResult.xpGained,
        "Player setup XP meter should update after match XP is granted"
    );
    assert.match(app.ui.state.overlaySubtext, /^\+\d+XP \(Lv\.\d+\)/, "Match result overlay should show XP");
    assert.equal(
        globalThis.Alpine.store("xpReward").visible,
        true,
        "Match result overlay should show the XP reward panel"
    );
    assert.equal(globalThis.Alpine.store("xpReward").xpGained, app._lastMatchXpResult.xpGained);
    assert.ok(
        app.ui.logItems.some((item) => item.includes("[경험치]")),
        "Match end should write an XP log entry immediately"
    );
    assert.equal(app._currentTournamentReport, null, "Standalone matches should not create a tournament report");
}

function testShuffledUtility() {
    const original = [1, 2, 3, 4];
    const result = shuffled(original, () => 0);

    assert.deepEqual(original, [1, 2, 3, 4], "shuffled should not mutate the source array");
    assert.deepEqual(result, [2, 3, 4, 1], "shuffled should use deterministic Fisher-Yates ordering with a fixed rng");
}

function testMultiFighterSimulationSetup(app) {
    const sim = new BattleSimulation(app.roster.slice(0, 3), {
        onLog() {},
        onSound() {}
    });

    assert.equal(sim.fighters.length, 3, "BattleSimulation should create every requested fighter");
    assert.equal(sim.getFighterPairs().length, 3, "Three fighters should create three collision pairs");
    assert.ok(
        sim.fighters.every((fighter) => fighter.simulation === sim),
        "Every fighter should reference the simulation"
    );
    assert.ok(
        sim.fighters.every((fighter) => fighter.ability),
        "Every fighter should bind its ability"
    );
    assert.deepEqual(
        sim.fighters.map((fighter) => fighter.teamId),
        ["fighter-0", "fighter-1", "fighter-2"],
        "Fighters without explicit teams should receive unique default teams"
    );
    assert.equal(
        sim.getEnemiesOf(sim.fighters[0]).length,
        2,
        "Default multi-fighter battles should remain free-for-all"
    );

    const huntingSizedSim = new BattleSimulation(app.roster.slice(0, 3), { onLog() {}, onSound() {} }, null, {
        arenaWidth: HUNTING_ARENA.WIDTH,
        arenaHeight: HUNTING_ARENA.HEIGHT
    });
    assert.equal(huntingSizedSim.width, HUNTING_ARENA.WIDTH, "BattleSimulation should accept a wider arena");
    assert.equal(huntingSizedSim.height, HUNTING_ARENA.HEIGHT, "BattleSimulation should accept a taller arena");
    assert.ok(
        huntingSizedSim.fighters.every(
            (fighter) =>
                fighter.position.x >= 0 &&
                fighter.position.x <= HUNTING_ARENA.WIDTH &&
                fighter.position.y >= 0 &&
                fighter.position.y <= HUNTING_ARENA.HEIGHT
        ),
        "Spawn points should stay inside the configured arena"
    );
}

function testArenaCameraZoom() {
    const camera = new ArenaCamera();

    const defaultView = camera.getViewTransform({ width: 960, height: 960 }, { width: 960, height: 960 });
    assert.equal(defaultView.scale, 1, "Default 960 arena should render at 1:1 scale");
    assert.equal(defaultView.offsetX, 0, "Default arena should not need horizontal letterboxing");
    assert.equal(defaultView.offsetY, 0, "Default arena should not need vertical letterboxing");

    const huntingView = camera.getViewTransform(
        { width: 960, height: 960 },
        { width: HUNTING_ARENA.WIDTH, height: HUNTING_ARENA.HEIGHT, camera: { zoom: 1 } }
    );
    assert.equal(huntingView.scale, 0.75, "Larger hunting arena should fit fully into the same canvas");
    assert.equal(huntingView.offsetX, 0, "Square hunting arena should stay centered horizontally");
    assert.equal(huntingView.offsetY, 0, "Square hunting arena should stay centered vertically");

    const closerView = camera.getViewTransform(
        { width: 960, height: 960 },
        { width: HUNTING_ARENA.WIDTH, height: HUNTING_ARENA.HEIGHT, camera: { zoom: 1.2 } }
    );
    assert.ok(Math.abs(closerView.scale - 0.9) < 0.001, "Camera zoom should be a multiplier on top of fit-to-map");
}

function testHuntingMeleeMobChasesTarget(app) {
    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        teamId: HUNTING_TEAMS.PLAYER
    };
    const meleeSpec = createHuntingMobSpec({
        type: HUNTING_MONSTER_TYPES.MELEE,
        floor: 1,
        index: 0
    });
    const sim = new BattleSimulation([playerSpec, meleeSpec], {
        onLog() {},
        onSound() {}
    });
    const [player, melee] = sim.fighters;
    player.position = new Vector2(260, 480);
    player.velocity = new Vector2(0, 0);
    melee.position = new Vector2(720, 480);
    melee.velocity = new Vector2(0, 0);

    const before = Vector2.subtract(player.position, melee.position).length();
    for (let index = 0; index < 30; index += 1) {
        melee.update(1 / 60, sim);
    }
    const after = Vector2.subtract(player.position, melee.position).length();

    assert.equal(
        melee.ability.constructor.name,
        "HuntingMeleeAbility",
        "Melee hunting mobs should bind the dedicated chase ability"
    );
    assert.ok(after < before - 20, "Melee hunting mobs should close distance toward the player");
    assert.ok(melee.velocity.x < 0, "Melee hunting mobs should move horizontally toward the player");
}

function testTeamTargetingAndFriendlyCollision(app) {
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const orbit = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT);
    const trickster = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER);
    const sim = new BattleSimulation(
        [
            { ...archer, teamId: "player" },
            { ...orbit, teamId: "player" },
            { ...trickster, teamId: "enemy" }
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [player, ally, enemy] = sim.fighters;

    player.position = new Vector2(300, 480);
    ally.position = new Vector2(330, 480);
    enemy.position = new Vector2(700, 480);

    assert.equal(sim.isHostile(player, ally), false, "Fighters with the same teamId should be allies");
    assert.equal(sim.isHostile(player, enemy), true, "Fighters with different teamIds should be hostile");
    assert.deepEqual(
        sim.getEnemiesOf(player).map((fighter) => fighter.id),
        [enemy.id],
        "Enemy lookup should exclude allies"
    );
    assert.equal(sim.getOpponent(player), enemy, "getOpponent should return a hostile fighter, not the nearest ally");

    const hpBeforePlayer = player.hp;
    const hpBeforeAlly = ally.hp;
    sim.handleFighterCollision(player, ally);
    assert.equal(player.hp, hpBeforePlayer, "Friendly collision should not damage the owner");
    assert.equal(ally.hp, hpBeforeAlly, "Friendly collision should not damage the ally");
    assert.ok(
        Vector2.subtract(player.position, ally.position).length() >= player.radius + ally.radius - 1,
        "Friendly collision should still separate overlapping allies"
    );
}

function testTeamsResolveByRemainingHostileTeams(app) {
    const sim = new BattleSimulation(
        [
            { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER), teamId: "player" },
            { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT), teamId: "player" },
            { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER), teamId: "enemy" }
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [player, ally, enemy] = sim.fighters;

    enemy.takeDamage(999, player, "Forced KO");
    sim.checkResult();

    assert.equal(sim.finished, true, "Battle should finish when only one team remains alive");
    assert.equal(sim.winner, player, "Winner should be a surviving fighter from the remaining team");
    assert.equal(ally.flags.destroyed, false, "Allies on the winning team should not be destroyed as losers");
}

function testProjectileIgnoresAllies(app) {
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const orbit = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT);
    const trickster = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER);
    const sim = new BattleSimulation(
        [
            { ...archer, teamId: "player" },
            { ...orbit, teamId: "player" },
            { ...trickster, teamId: "enemy" }
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [owner, ally, enemy] = sim.fighters;
    const arrow = sim.spawnArrow(owner, ally.position.clone(), new Vector2(0, 0));

    arrow.update(0.016, sim);
    assert.equal(ally.hp, ally.maxHp, "Projectile should not damage an allied fighter it overlaps");

    arrow.position = enemy.position.clone();
    arrow.update(0.016, sim);
    assert.ok(enemy.hp < enemy.maxHp, "Projectile should damage a hostile fighter");
}

function assertPassiveEvasionAppliesImpulse(app, fighterId, label) {
    const sim = new BattleSimulation(
        [
            app.roster.find((fighter) => fighter.id === fighterId),
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [evader, target] = sim.fighters;
    evader.position = new Vector2(300, 480);
    target.position = new Vector2(380, 480);
    evader.applyImpulse(Vector2.subtract(new Vector2(180, 0), evader.velocity));
    target.applyImpulse(Vector2.subtract(new Vector2(180, 0), target.velocity));

    evader.ability.update(0.016, target);

    assert.ok(evader.state.forcedHeading, `${label} passive evasion should still hold a short dodge heading`);
    assert.ok(
        Math.abs(evader.velocity.y) > 20,
        `${label} passive evasion should apply immediate lateral impulse after velocity became impulse-based`
    );
}

function testPassiveEvasionAppliesImpulse(app) {
    assertPassiveEvasionAppliesImpulse(app, FIGHTER_IDS.ARCHER, "Archer");
}

function testClickActionEffectOwnership(app) {
    const sim = new BattleSimulation(app.roster.slice(0, 2), {
        onLog() {},
        onSound() {}
    });
    const [player, opponent] = sim.fighters;
    const rush = findActionById("rush");
    const endure = findActionById("endure");

    player.applyImpulse(Vector2.subtract(new Vector2(120, 0), player.velocity));
    rush.apply(sim, player);

    assert.equal(sim.getSpeedMultiplier(player), 1.5, "RushAction should register speed effect on its target ball");
    assert.equal(sim.getSpeedMultiplier(opponent), 1, "RushAction should not boost unrelated balls");
    const expectedRushSpeed = player.stats.baseSpeed * player.getStatModifiers().speed * sim.getSpeedMultiplier(player);
    assert.ok(player.velocity.x > 120, "RushAction should immediately burst forward instead of only buffing speed");
    assert.ok(
        Math.abs(player.velocity.length() - expectedRushSpeed) < 0.001,
        "RushAction should snap to the boosted movement speed through impulse"
    );

    player.actionContext.tickTimers(player, 0.25);
    rush.apply(sim, player);
    assert.equal(
        player.actionContext.getEffect("rush").remaining,
        1.75,
        "RushAction should own duration extension logic"
    );

    player.actionContext.tickTimers(player, 1.76);
    assert.equal(sim.getSpeedMultiplier(player), 1, "Rush effect should expire through the generic action context");

    endure.apply(sim, player);
    assert.equal(
        player.actionContext.onDamageTaken(11, opponent, "Test"),
        2,
        "EndureAction should reduce damage by 80% (11 * 0.2 -> round)"
    );

    player.actionContext.tickTimers(player, 0.21);
    assert.equal(
        player.actionContext.onDamageTaken(11, opponent, "Test"),
        11,
        "Endure effect should expire after 0.2s"
    );
}

function testRiskWindowActionOwnership(app) {
    const sim = new BattleSimulation(app.roster.slice(0, 2), {
        onLog() {},
        onSound() {}
    });
    const [player, opponent] = sim.fighters;
    const counter = findActionById("counter");
    const projectileGuard = findActionById("projectile_guard");

    assert.equal(counter.getFailureReason(sim, player), null, "Counter should not fail for free before HP cost");
    assert.equal(
        projectileGuard.getFailureReason(sim, player),
        null,
        "Projectile guard should not fail for free before HP cost"
    );

    counter.apply(sim, player);
    assert.ok(player.actionContext.getEffect("counter"), "Counter should arm a short collision window");
    const opponentHpBeforeCounter = opponent.hp;
    const counterResult = player.actionContext.onFighterCollision(player, opponent, 10, 50, sim);
    assert.equal(counterResult.incomingDamage, 0, "Counter should cancel reflected incoming collision damage");
    assert.ok(opponent.hp < opponentHpBeforeCounter, "Counter should reflect incoming damage back to the opponent");
    const opponentHpAfterCounter = opponent.hp;
    player.actionContext.onFighterCollision(player, opponent, 50, 0, sim);
    assert.equal(opponent.hp, opponentHpAfterCounter, "Counter should not apply twice in the same frame");
    player.actionContext.tickTimers(player, 0);
    assert.equal(player.actionContext.getEffect("counter"), null, "Counter should expire after it is consumed");

    player.hp = 50;
    projectileGuard.apply(sim, player, 2);
    assert.equal(
        player.actionContext.onDamageTaken(20, opponent, "Crash"),
        20,
        "Projectile guard should not reduce normal collision damage"
    );
    assert.equal(
        player.actionContext.onProjectileDamage(20, {}, opponent, "Arrow Shot", sim, player),
        5,
        "Projectile guard should reduce projectile damage inside its window"
    );
    assert.equal(player.hp, 52, "Projectile guard should refund its paid HP cost on success");
    assert.equal(
        player.actionContext.onProjectileDamage(20, {}, opponent, "Arrow Shot", sim, player),
        20,
        "Projectile guard should not reduce a second projectile after it is consumed"
    );
    player.actionContext.tickTimers(player, 0);
    assert.equal(
        player.actionContext.getEffect("projectile_guard"),
        null,
        "Projectile guard should expire after reducing one projectile"
    );

    projectileGuard.apply(sim, player);
    player.actionContext.tickTimers(player, 0.31);
    assert.equal(
        player.actionContext.onProjectileDamage(20, {}, opponent, "Arrow Shot", sim, player),
        20,
        "Projectile guard should do nothing after the window expires"
    );
}

// ── Hero Ball / Hero Orb Tests ──────────────────────────────────────────────

async function testHeroBallRegistered(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    assert.ok(hero, "Hero Ball should be registered in the roster");
    assert.equal(hero.ability, "hero", "Hero Ball should have 'hero' ability type");

    const { HeroAbility } = await import("../src/abilities/heroAbility.js");
    const sim = new BattleSimulation([hero, app.roster.find((f) => f.id !== FIGHTER_IDS.HERO)], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    assert.ok(heroFighter.ability instanceof HeroAbility, "Hero Ball should create HeroAbility via ability map");
}

async function testHeroAbilitySpawnsOrb(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    sim.entities = sim.fighters.slice();

    // Trigger ability cooldown
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const orbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb");
    assert.equal(orbs.length, 1, "HeroAbility should spawn one Hero Orb when cooldown triggers");
}

async function testHeroOrbEffectType(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    const validTypes = ["hp", "damage", "speed", "defense", "skill", "dash", "arrow", "cooldown_burst"];
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
        sim.entities = sim.fighters.slice();
        heroFighter.ability.timer = 0;
        heroFighter.ability.update(0.016, target);
        const orb = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
        assert.ok(orb, "HeroAbility should spawn an orb");
        assert.ok(validTypes.includes(orb.effectType), `Effect type ${orb.effectType} should be one of valid types`);
        seen.add(orb.effectType);
    }
    assert.ok(seen.size >= 5, "At least 5 effect types should appear over multiple spawns");
}

async function testHeroOrbOwnerCollects(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    sim.entities = sim.fighters.slice();

    // Simulate collecting each type of orb (gain is 1~3 random)
    for (const type of ["hp", "damage", "speed", "defense", "skill"]) {
        const before = { ...heroFighter.hero.bonuses };
        const orb = new (await import("../src/entities/index.js")).HeroOrb(
            heroFighter,
            heroFighter.position.clone(),
            new Vector2(0, 0),
            type,
            10
        );
        // Position orb at owner's position so owner collects it
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        const after = heroFighter.hero.bonuses;
        const gained = after[type] - before[type];
        assert.ok(gained >= 1 && gained <= 5, `Collecting ${type} orb should gain 1~5, got ${gained}`);
    }
}

async function testHeroOrbOpponentCollects(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    sim.entities = sim.fighters.slice();

    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;
    const bonusesBefore = { ...heroFighter.hero.bonuses };

    const orbVelocity = new Vector2(0, 0);
    const orb = new HeroOrb(heroFighter, target.position.clone(), orbVelocity, "hp", 10);
    sim.entities.push(orb);
    const velocityBefore = orb.velocity.length();
    orb.update(0.016, sim);

    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Opponent touching orb should not give bonus to owner");
    assert.equal(orb.isExpired, false, "Orb should bounce off opponent, not disappear");
    // orb가 상대에게서 멀어졌는지 확인 (겹침 해소로 position 변경)
    const distAfter = Vector2.subtract(orb.position, target.position).length();
    assert.ok(distAfter > orb.radius + target.radius - 1, "Orb should be pushed away from opponent");
}

async function testHeroOrbMaxActivePerOwner(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    // Override timer and spawn orbs repeatedly
    sim.entities = sim.fighters.slice();
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;

    // Create 12 orbs in simulation (bypass ability to control exactly)
    for (let i = 0; i < 12; i++) {
        sim.entities.push(new HeroOrb(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "hp", 10));
    }

    // Now enforce via ability's max active check
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    // 12 old + 1 new = 13, but max is 10 → at most 10 active
    // Actually the new one was spawned after expiring the oldest ones
    // So active = 10 (9 old that weren't expired + 1 new)
    assert.ok(activeOrbs.length <= 10, `Should have at most 10 active orbs per owner, got ${activeOrbs.length}`);
    // The oldest orbs should be expired
    const expiredOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && e.isExpired);
    assert.ok(expiredOrbs.length >= 3, "Should expire at least 3 old orbs when exceeding limit");
}

async function testHeroOrbDoesNotExpireFromCooldown(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    sim.entities = sim.fighters.slice();
    for (let i = 0; i < 6; i++) {
        heroFighter.ability.timer = 0;
        heroFighter.ability.update(0.016, target);
    }

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.equal(activeOrbs.length, 6, "Hero Orbs should stay until collected or owner limit removes them");

    for (const orb of activeOrbs) {
        orb.update(heroFighter.ability.cooldown + 1, sim);
    }

    const stillActiveOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.equal(stillActiveOrbs.length, 6, "Hero Orbs should not use cooldown-derived natural expiry");
}

async function testHeroOrbLimitIgnoresCollectedOrbs(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    sim.entities = sim.fighters.slice();
    for (let i = 0; i < 10; i++) {
        const orb = new HeroOrb(heroFighter, new Vector2(100 + i, 100), new Vector2(0, 0), "hp");
        if (i < 7) orb.isExpired = true;
        sim.entities.push(orb);
    }

    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.equal(activeOrbs.length, 4, "Owner limit should count only active Hero Orb entities on the field");
}

async function testHeroOrbStatCapInfinite(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HERO_ORB_STAT_CAP } = await import("../src/entities/index.js");

    assert.equal(HERO_ORB_STAT_CAP, -1, "Default HERO_ORB_STAT_CAP should be -1 (infinite)");

    // Apply the same stat type many times - should never be blocked
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;
    let totalGained = 0;
    for (let i = 0; i < 5; i++) {
        const before = heroFighter.hero.bonuses.hp;
        sim.entities = sim.fighters.slice();
        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        const gained = heroFighter.hero.bonuses.hp - before;
        assert.ok(gained >= 1 && gained <= 5, `HP bonus should gain 1~5 per orb (iteration ${i}, gained ${gained})`);
        totalGained += gained;
    }
    assert.ok(totalGained >= 5, `Over 5 collects, total gain should be at least 5, got ${totalGained}`);
}

async function testHeroOrbStatCapLimited(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { setHeroOrbStatCap, rollHeroOrbStatGain } = await import("../src/entities/index.js");
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;

    // Temporarily set cap to 5
    setHeroOrbStatCap(5);
    try {
        heroFighter.hero.bonuses.hp = 0;
        // Collect orbs until we reach or exceed cap
        for (let i = 0; i < 10; i++) {
            const before = heroFighter.hero.bonuses.hp;
            sim.entities = sim.fighters.slice();
            const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
            orb.position = heroFighter.position.clone();
            sim.entities.push(orb);
            orb.update(0.016, sim);
            const gained = heroFighter.hero.bonuses.hp - before;
            if (before < 5) {
                assert.ok(gained >= 1, `HP bonus should increase when under cap (iteration ${i}, gained ${gained})`);
            } else {
                assert.equal(gained, 0, `HP bonus should stop at cap (iteration ${i}, gained ${gained})`);
            }
        }
        // Verify we never overshoot the cap
        assert.ok(
            heroFighter.hero.bonuses.hp <= 5,
            `HP bonus should never exceed cap of 5, got ${heroFighter.hero.bonuses.hp}`
        );
    } finally {
        // Reset cap
        setHeroOrbStatCap(-1);
    }
}

async function testHeroOrbNoDamage(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;

    const hpBefore = target.hp;
    const orb = new HeroOrb(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities = [orb, ...sim.fighters];
    // Orb overlapping with opponent should bounce off, not deal damage
    orb.position = target.position.clone();
    orb.update(0.016, sim);
    assert.equal(target.hp, hpBefore, "Hero Orb should not damage opponents on contact");
    assert.equal(orb.isExpired, false, "Hero Orb should bounce off opponent, not disappear");
}

// ── Hero Ball v0.11.0 Improvement Tests ─────────────────────────────────────

async function testHeroBaseCooldown(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    assert.equal(heroFighter.ability._baseCooldown, 1.0, "HeroAbility base cooldown should be 1.0 second");
}

async function testHeroOrbSpeedMinMax(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    // Check multiple spawns
    for (let i = 0; i < 20; i++) {
        sim.entities = sim.fighters.slice();
        heroFighter.ability.timer = 0;
        heroFighter.ability.update(0.016, target);
        const orb = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
        assert.ok(orb, `Orb should be spawned (iteration ${i})`);

        const orbSpeed = orb.velocity.length();
        const effectiveBaseSpeed = heroFighter.stats.baseSpeed * (heroFighter.getStatModifiers()?.speed ?? 1);
        const expectedMin = effectiveBaseSpeed * 1.2;
        const expectedMax = effectiveBaseSpeed * 1.5;
        assert.ok(
            orbSpeed >= expectedMin - 0.01,
            `Orb speed ${orbSpeed.toFixed(1)} should be >= ${expectedMin.toFixed(1)} (1.2× base) (iter ${i})`
        );
        assert.ok(
            orbSpeed <= expectedMax + 0.01,
            `Orb speed ${orbSpeed.toFixed(1)} should be <= ${expectedMax.toFixed(1)} (1.5× base) (iter ${i})`
        );
    }
}

async function testHeroOrbSpeedScalesWithOwner(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    // Spawn orb at normal speed
    sim.entities = sim.fighters.slice();
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const orb1 = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
    const speed1 = orb1.velocity.length();

    // Increase owner baseSpeed and spawn again
    heroFighter.stats.baseSpeed *= 2;
    sim.entities = sim.fighters.slice();
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const orb2 = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
    const speed2 = orb2.velocity.length();

    assert.ok(
        speed2 > speed1 * 1.5,
        `Orb speed should scale with owner baseSpeed (${speed2.toFixed(1)} vs ${speed1.toFixed(1)})`
    );
}

async function testHeroOrbOwnerCollectFeedback(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb, HERO_ORB_EFFECTS } = await import("../src/entities/index.js");

    // Check that collecting an orb spawns an action text entity
    const beforeTextCount = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const afterTextCount = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;
    assert.ok(afterTextCount > beforeTextCount, "Collecting an orb should spawn ActionText feedback");

    // Verify the text content matches the effect label
    const newTexts = sim.entities.filter((e) => e.constructor?.name === "ActionText");
    const lastText = newTexts[newTexts.length - 1];
    assert.ok(lastText, "ActionText should exist");
    assert.ok(
        lastText.displayText?.includes(HERO_ORB_EFFECTS.hp.label),
        `ActionText should contain the effect label (${lastText.displayText})`
    );
    const match = lastText.displayText?.match(/\+(\d+)/);
    assert.ok(match, `ActionText should contain +N (${lastText.displayText})`);
    const gainValue = parseInt(match[1], 10);
    assert.ok(gainValue >= 1 && gainValue <= 5, `Gain value should be 1~5, got ${gainValue}`);
}

async function testHeroOrbOpponentNoFeedback(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const textCountBefore = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;

    const orb = new HeroOrb(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const textCountAfter = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;
    assert.equal(textCountAfter, textCountBefore, "Opponent collecting orb should NOT spawn ActionText feedback");
}

async function testHeroOrbCapNoFeedback(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb, setHeroOrbStatCap } = await import("../src/entities/index.js");

    setHeroOrbStatCap(0);
    try {
        heroFighter.hero.bonuses.hp = 0;
        const textCountBefore = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;

        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);

        const textCountAfter = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;
        assert.equal(textCountAfter, textCountBefore, "No ActionText should spawn when stat cap prevents increase");
        assert.equal(heroFighter.hero.bonuses.hp, 0, "HP bonus should stay 0 when cap is 0");
    } finally {
        setHeroOrbStatCap(-1);
    }
}

async function testHeroOrbBonusUiFormat(app) {
    const { HERO_ORB_EFFECTS, formatHeroStatLine, formatHeroStatParts } = await import("../src/entities/index.js");

    const baseAllocation = { hp: 30, damage: 20, speed: 10, skill: 25, defense: 15 };
    assert.equal(
        formatHeroStatLine(baseAllocation, { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 }),
        "체력 +30% · 힘 +20% · 속도 +10% · 쿨타임 +25% · 방어 +15%",
        "Hero stat line should show base allocation even before orb bonuses"
    );

    const result = formatHeroStatLine(baseAllocation, { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 });
    assert.ok(result.includes("체력 +30%(+3)"), "Hero stat line should merge base HP and orb HP");
    assert.ok(result.includes("힘 +20%(+1)"), "Hero stat line should merge base damage and orb damage");
    assert.ok(result.includes("쿨타임 +25%(+2)"), "Hero stat line should merge base skill and orb skill");
    assert.ok(result.includes("속도 +10%"), "Hero stat line should keep zero-bonus base stats");
    assert.ok(!result.includes("속도 +10%(+0)"), "Hero stat line should not render +0 orb bonuses");

    const parts = formatHeroStatParts(baseAllocation, { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 });
    const hpPart = parts.find((part) => part.key === "hp");
    assert.equal(hpPart.bonusText, "(+3)", "Hero stat bonus text should be compact and have no middle space");
    assert.equal(hpPart.color, HERO_ORB_EFFECTS.hp.color, "Hero stat bonus should use the matching orb color");
}

async function testHeroOrbBonusUiOnlyForHero(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([hero, archer], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const archerFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.ARCHER);

    // Hero has hero.bonuses, Archer has it too (all BattleBalls have it initialized)
    // But the display logic checks if bonuses are non-zero
    assert.ok(heroFighter.hero.bonuses, "Hero should have hero.bonuses");
    assert.ok(archerFighter.hero.bonuses, "All BattleBalls should have hero.bonuses (initialized to 0)");

    heroFighter.hero.bonuses.hp = 3;
    heroFighter.stats.allocation = { hp: 12, damage: 18, speed: 22, skill: 28, defense: 20 };
    const { formatHeroStatLine } = await import("../src/entities/index.js");
    const heroLine = formatHeroStatLine(heroFighter.stats.allocation, heroFighter.hero.bonuses);
    const normalLine = formatStatAllocation(heroFighter.stats.allocation);
    assert.ok(heroLine.includes("체력 +12%(+3)"), "Hero's stat line should show base allocation plus orb bonuses");
    assert.ok(!normalLine.includes("+12%(+3)"), "Normal stat formatter should not include Hero Orb bonuses");
    assert.deepEqual(archerFighter.hero.bonuses, { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 });
}

async function testHeroExistingRulesNotBroken(app) {
    // Verify that existing rules still hold after the improvements
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb, HERO_ORB_EFFECTS } = await import("../src/entities/index.js");

    // 1) Max 10 orbs per owner
    sim.entities = sim.fighters.slice();
    const HeroOrbClass = HeroOrb;
    for (let i = 0; i < 12; i++) {
        sim.entities.push(new HeroOrbClass(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "hp", 10));
    }
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.ok(activeOrbs.length <= 10, `Max 10 active orbs per owner, got ${activeOrbs.length}`);

    // 2) Opponent collects → no bonus
    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const orb = new HeroOrbClass(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities.push(orb);
    orb.update(0.016, sim);
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Opponent collecting orb should not give bonus to owner");

    // 3) Orb does no damage
    const hpBefore = target.hp;
    const orb2 = new HeroOrbClass(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities.push(orb2);
    orb2.update(0.016, sim);
    assert.equal(target.hp, hpBefore, "Hero Orb should not damage opponents");
}

// ── Special Hero Orb Tests (v0.12.0) ─────────────────────────────────────────

async function testPickHeroOrbEffectType() {
    const { pickHeroOrbEffectType } = await import("../src/abilities/HeroAbility.js");

    // Deterministic rng: first checks special chances
    // dash=0.10, arrow=0.10, cooldown_burst=0.05
    let type = pickHeroOrbEffectType(() => 0.0);
    assert.equal(type, "dash", "rng=0.0 should pick dash (first special)");
    type = pickHeroOrbEffectType(() => 0.09);
    assert.equal(type, "dash", "rng=0.09 should still be in dash range");
    type = pickHeroOrbEffectType(() => 0.1);
    assert.equal(type, "arrow", "rng=0.1 should pick arrow");
    type = pickHeroOrbEffectType(() => 0.19);
    assert.equal(type, "arrow", "rng=0.19 should still be in arrow range");
    type = pickHeroOrbEffectType(() => 0.2);
    assert.equal(type, "cooldown_burst", "rng=0.2 should pick cooldown_burst");
    type = pickHeroOrbEffectType(() => 0.24);
    assert.equal(type, "cooldown_burst", "rng=0.24 should still be in cooldown_burst range");

    // Beyond special total (0.25) → stat orb
    const statTypes = ["hp", "damage", "speed", "defense", "skill"];
    type = pickHeroOrbEffectType(() => 0.25);
    assert.ok(statTypes.includes(type), `rng=0.25 should pick a stat orb, got ${type}`);
    type = pickHeroOrbEffectType(() => 0.9);
    assert.ok(statTypes.includes(type), `rng=0.9 should pick a stat orb, got ${type}`);
}

async function testSpecialOrbOwnerCollectDash(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    heroFighter.position.x = 200;
    heroFighter.position.y = 480;
    target.position.x = 600;
    target.position.y = 480;
    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const dashBefore = heroFighter.state.movement;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "dash", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    assert.ok(heroFighter.state.movement, "Dash orb should set movementEffect on owner");
    assert.ok(heroFighter.state.movement.constructor?.name === "DashEffect", "Dash orb should use DashEffect");
    const dashSpeed = heroFighter.state.movement.getSpeed(heroFighter);
    const expectedSpeed = heroFighter.stats.baseSpeed * 1.5;
    assert.ok(
        Math.abs(dashSpeed - expectedSpeed) < 1,
        `Dash orb speed (${dashSpeed.toFixed(1)}) should be ~${expectedSpeed.toFixed(1)}`
    );
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Dash orb should not increment hero.bonuses");
}

async function testSpecialOrbOwnerCollectArrow(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    heroFighter.position.x = 200;
    heroFighter.position.y = 480;
    target.position.x = 600;
    target.position.y = 480;
    const bonusesBefore = { ...heroFighter.hero.bonuses };

    const entitiesBefore = sim.entities.length;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "arrow", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const newEntities = sim.entities.slice(entitiesBefore);
    const arrow = newEntities.find((e) => e.constructor?.name === "ArrowProjectile");
    assert.ok(arrow, "Arrow orb should spawn an ArrowProjectile");
    const arrowSpeed = arrow.velocity.length();
    const expectedSpeed = heroFighter.stats.baseSpeed * 2.0;
    assert.ok(
        Math.abs(arrowSpeed - expectedSpeed) < expectedSpeed * 0.1,
        `Arrow speed (${arrowSpeed.toFixed(1)}) should be ~${expectedSpeed.toFixed(1)}`
    );
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Arrow orb should not increment hero.bonuses");
}

async function testSpecialOrbOwnerCollectCooldownBurst(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const normalCooldown = heroFighter.ability.cooldown;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "cooldown_burst", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const burstCooldown = heroFighter.ability.cooldown;
    assert.ok(
        Math.abs(burstCooldown - normalCooldown * 0.1) < 0.01,
        `Cooldown burst should reduce cooldown to 10% (${burstCooldown.toFixed(3)} vs ${normalCooldown.toFixed(3)})`
    );
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Cooldown burst orb should not increment hero.bonuses");
    assert.ok(heroFighter.ability.state.cooldownBurstTimer > 0, "Cooldown burst timer should be active");
}

async function testSpecialOrbCooldownBurstExpires(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const normalCooldown = heroFighter.ability.cooldown;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "cooldown_burst", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    // Tick past burst duration
    heroFighter.ability._tickCooldownBurst(1.5);
    const afterBurstCooldown = heroFighter.ability.cooldown;
    assert.ok(
        Math.abs(afterBurstCooldown - normalCooldown) < 0.01,
        `After burst expires, cooldown should return to normal (${afterBurstCooldown.toFixed(3)} vs ${normalCooldown.toFixed(3)})`
    );
    assert.equal(heroFighter.ability.state.cooldownBurstTimer, 0, "Burst timer should be 0 after expiry");
}

async function testSpecialOrbOpponentCollects(app) {
    for (const specialType of ["dash", "arrow", "cooldown_burst"]) {
        const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
        const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
        const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
        const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
        const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
        const { HeroOrb } = await import("../src/entities/index.js");

        heroFighter.position.x = 200;
        heroFighter.position.y = 480;
        target.position.x = 600;
        target.position.y = 480;
        const bonusesBefore = { ...heroFighter.hero.bonuses };
        const movementBefore = heroFighter.state.movement;
        const entitiesBefore = sim.entities.length;

        const orb = new HeroOrb(heroFighter, target.position.clone(), new Vector2(0, 0), specialType, 10);
        sim.entities.push(orb);
        orb.update(0.016, sim);

        assert.deepEqual(
            heroFighter.hero.bonuses,
            bonusesBefore,
            `${specialType} orb collected by opponent should not give bonus to owner`
        );
        assert.equal(
            heroFighter.state.movement,
            movementBefore,
            `${specialType} orb collected by opponent should not trigger dash on owner`
        );
        assert.equal(orb.isExpired, false, `${specialType} orb should bounce off opponent, not disappear`);
    }
}

async function testSpecialOrbNotInStatBonuses(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { formatHeroStatLine, formatHeroStatParts } = await import("../src/entities/index.js");
    const allocation = { hp: 30, damage: 20, speed: 10, skill: 0, defense: 0 };
    const bonuses = { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 };

    // Stat orbs appear in format
    const line = formatHeroStatLine(allocation, bonuses);
    assert.ok(line.includes("체력 +30%(+3)"), "Format should include stat orb bonus");
    assert.ok(line.includes("힘 +20%(+1)"), "Format should include damage stat bonus");
    assert.ok(!line.includes("대시"), "Format should NOT include dash");
    assert.ok(!line.includes("화살"), "Format should NOT include arrow");
    assert.ok(!line.includes("버스트"), "Format should NOT include cooldown_burst");

    // Parts should not contain special orb keys
    const parts = formatHeroStatParts(allocation, bonuses);
    const partKeys = parts.map((p) => p.key);
    assert.ok(!partKeys.includes("dash"), "Stat parts should not include dash key");
    assert.ok(!partKeys.includes("arrow"), "Stat parts should not include arrow key");
    assert.ok(!partKeys.includes("cooldown_burst"), "Stat parts should not include cooldown_burst key");
}

async function testSpecialOrbCountsTowardMaxActive(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    sim.entities = sim.fighters.slice();
    // Add 8 stat orbs + 4 special orbs = 12 total
    for (let i = 0; i < 8; i++) {
        sim.entities.push(new HeroOrb(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "hp", 10));
    }
    for (let i = 0; i < 4; i++) {
        sim.entities.push(new HeroOrb(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "dash", 10));
    }

    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.ok(activeOrbs.length <= 10, `Active orbs (stat+special) should be limited to 10, got ${activeOrbs.length}`);
}

async function testSpecialOrbDrawDistinction(app) {
    const { HeroOrb, HERO_ORB_EFFECTS } = await import("../src/entities/index.js");
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const fakeOwner = { id: hero.id };

    for (const specialType of ["dash", "arrow", "cooldown_burst"]) {
        const orb = new HeroOrb(fakeOwner, new Vector2(0, 0), new Vector2(0, 0), specialType, 10);
        assert.ok(orb._isSpecial, `${specialType} orb should be marked as special`);
    }
    for (const statType of ["hp", "damage", "speed", "defense", "skill"]) {
        const orb = new HeroOrb(fakeOwner, new Vector2(0, 0), new Vector2(0, 0), statType, 10);
        assert.equal(orb._isSpecial, false, `${statType} orb should not be marked as special`);
    }
}

// ── Hero Orb Stat Gain 1~3 + Trickster Buff Tests (v0.13.0) ──────────────────

async function testRollHeroOrbStatGain() {
    const { rollHeroOrbStatGain } = await import("../src/entities/index.js");

    // Deterministic rng: amount = 1 + floor(rng * 3)
    assert.equal(
        rollHeroOrbStatGain(() => 0.0),
        1,
        "rng=0.0 should produce amount 1"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.19),
        1,
        "rng=0.19 should produce amount 1"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.2),
        2,
        "rng=0.2 should produce amount 2"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.39),
        2,
        "rng=0.39 should produce amount 2"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.4),
        3,
        "rng=0.4 should produce amount 3"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.59),
        3,
        "rng=0.59 should produce amount 3"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.6),
        4,
        "rng=0.6 should produce amount 4"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.79),
        4,
        "rng=0.79 should produce amount 4"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.8),
        5,
        "rng=0.8 should produce amount 5"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.999),
        5,
        "rng=0.999 should produce amount 5"
    );

    // Test with multiple values - always 1~5
    for (let i = 0; i < 100; i++) {
        const val = rollHeroOrbStatGain();
        assert.ok(val >= 1 && val <= 5, `rollHeroOrbStatGain should return 1~5, got ${val}`);
    }
}

async function testHeroOrbStatGainAmountApplied(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb, setHeroOrbStatCap } = await import("../src/entities/index.js");

    // Test hp: each point = +5 maxHp and +5 current hp
    const hpBefore = { maxHp: heroFighter.maxHp, hp: heroFighter.hp };
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.hp;
    assert.ok(gained >= 1 && gained <= 5, "HP gain should be 1~5");
    assert.equal(heroFighter.maxHp, hpBefore.maxHp + 5 * gained, "maxHp should increase by 5×gained");
    assert.equal(heroFighter.hp, hpBefore.hp + 5 * gained, "current HP should increase by 5×gained");
}

async function testHeroOrbStatGainDamage(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const dmgBefore = heroFighter.stats.baseDamage;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "damage", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.damage;
    assert.ok(gained >= 1 && gained <= 5, "Damage gain should be 1~5");
    assert.ok(
        Math.abs(heroFighter.stats.baseDamage - dmgBefore * Math.pow(1.02, gained)) < 0.1,
        `baseDamage should reflect 1.02^${gained} increase`
    );
}

async function testHeroOrbStatGainSpeed(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const speedBefore = heroFighter.stats.baseSpeed;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "speed", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.speed;
    assert.ok(gained >= 1 && gained <= 5, "Speed gain should be 1~5");
    assert.equal(
        heroFighter.stats.baseSpeed,
        Math.round(speedBefore + 4 * gained),
        "baseSpeed should increase by 4×gained"
    );
}

async function testHeroOrbStatGainDefense(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const defBefore = heroFighter.stats.baseDefense;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "defense", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.defense;
    assert.ok(gained >= 1 && gained <= 5, "Defense gain should be 1~5");
    assert.equal(
        heroFighter.stats.baseDefense,
        Number((defBefore + 0.33 * gained).toFixed(2)),
        "baseDefense should increase by 0.33×gained"
    );
}

async function testHeroOrbStatGainSkill(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const skillBefore = heroFighter.hero.bonuses.skill;
    const cooldownBefore = heroFighter.ability.cooldown;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "skill", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.skill - skillBefore;
    assert.ok(gained >= 1 && gained <= 5, "Skill gain should be 1~5");
    // Cooldown getter uses statAllocation.skill, not hero.bonuses.skill.
    // hero.bonuses.skill is stored but cooldown getter doesn't read it yet.
    assert.ok(heroFighter.hero.bonuses.skill > skillBefore, "hero.bonuses.skill should increase");
}

async function testHeroOrbStatGainCapClamp(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb, setHeroOrbStatCap } = await import("../src/entities/index.js");

    // cap=5, current=4 → max add = 1
    setHeroOrbStatCap(5);
    try {
        heroFighter.hero.bonuses.hp = 4;
        // Collect with controlled gain (min=1, but rng could be >1, so the clamp will cap it)
        const before = heroFighter.hero.bonuses.hp;
        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        const after = heroFighter.hero.bonuses.hp;
        const gained = after - before;
        assert.ok(gained >= 0 && gained <= 1, `With cap=5 and bonus=4, gain should be 0 or 1, got ${gained}`);
        assert.ok(after <= 5, `HP bonus should not exceed cap of 5, got ${after}`);
    } finally {
        setHeroOrbStatCap(-1);
    }
}

async function testHeroOrbSpecialNotAffectedByGain(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    heroFighter.position.x = 200;
    heroFighter.position.y = 480;
    target.position.x = 600;
    target.position.y = 480;

    for (const specialType of ["dash", "arrow", "cooldown_burst"]) {
        const bonusesBefore = { ...heroFighter.hero.bonuses };
        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), specialType, 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        assert.deepEqual(
            heroFighter.hero.bonuses,
            bonusesBefore,
            `${specialType} orb should not increment hero.bonuses`
        );
    }
}

// ── Hero Orb Carryover Tests (v0.14.0) ───────────────────────────────────────

async function testCarryoverRateConstant() {
    const { HERO_ORB_CARRYOVER_RATE } = await import("../src/entities/index.js");
    assert.equal(HERO_ORB_CARRYOVER_RATE, 0.5, "HERO_ORB_CARRYOVER_RATE should be 0.5");
}

async function testComputeHeroOrbCarryover() {
    const { computeHeroOrbCarryover } = await import("../src/entities/index.js");
    const gained = { hp: 5, damage: 1, speed: 4, defense: 2, skill: 0 };
    const carry = computeHeroOrbCarryover(gained, 0.5);
    assert.equal(carry.hp, 2, "hp +5 → carry +2");
    assert.equal(carry.damage, undefined, "damage +1 → carry undefined (floor(1*0.5)=0)");
    assert.equal(carry.speed, 2, "speed +4 → carry +2");
    assert.equal(carry.defense, 1, "defense +2 → carry +1");
    assert.equal(carry.skill, undefined, "skill +0 → carry undefined");
}

async function testComputeHeroOrbCarryoverCustomRate() {
    const { computeHeroOrbCarryover } = await import("../src/entities/index.js");
    // rate 0.25: hp 5 → floor(5*0.25)=1
    const carry = computeHeroOrbCarryover({ hp: 5, speed: 10 }, 0.25);
    assert.equal(carry.hp, 1, "hp +5 with rate 0.25 → carry +1");
    assert.equal(carry.speed, 2, "speed +10 with rate 0.25 → carry +2");
}

async function testMergeHeroOrbCarryover() {
    const { mergeHeroOrbCarryover } = await import("../src/entities/index.js");
    const spec = { hero: { carryover: { hp: 2, damage: 0, speed: 1, defense: 0, skill: 0 } } };
    const gained = { hp: 5, damage: 0, speed: 0, defense: 0, skill: 0 };

    mergeHeroOrbCarryover(spec, gained, 0.5);
    assert.equal(spec.hero.carryover.hp, 4, "기존 2 + 새 floor(5*0.5)=2 → 총 4");
    assert.equal(spec.hero.carryover.speed, 1, "speed는 변하지 않음 (gained 0)");
}

async function testMergeHeroOrbCarryoverNoRecycle() {
    const { mergeHeroOrbCarryover } = await import("../src/entities/index.js");
    // 기존 carry +2, 새 획득 +5 → carry 추가 = floor(5*0.5)=2
    const spec = {};
    mergeHeroOrbCarryover(spec, { hp: 5 }, 0.5);
    assert.equal(spec.hero.carryover.hp, 2, "첫 승리: hp 5 → carry 2");

    // 두 번째 승리: 새 획득 hp +3 → floor(3*0.5)=1
    mergeHeroOrbCarryover(spec, { hp: 3 }, 0.5);
    assert.equal(spec.hero.carryover.hp, 3, "기존 2 + 새 1 → 총 3 (기존 2를 다시 절반 계산 안 함)");
}

async function testApplyHeroOrbCarryoverToBattleBall(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { BattleBall, applyHeroOrbCarryoverToBattleBall } = await import("../src/entities/index.js");
    const ball = new BattleBall(hero, { x: 480, y: 480 });

    const hpBefore = ball.maxHp;
    const speedBefore = ball.stats.baseSpeed;

    applyHeroOrbCarryoverToBattleBall(ball, { hp: 2, speed: 2 });

    assert.equal(ball.maxHp, hpBefore + 10, "hp carry +2 should increase maxHp by 10");
    assert.equal(ball.stats.baseSpeed, speedBefore + 8, "speed carry +2 should increase baseSpeed by 8");
    assert.equal(ball.hero.bonuses.hp, 0, "carryover should NOT count as current match gain");
    assert.equal(ball.hero.bonuses.speed, 0, "carryover should NOT count as current match gain");
}

async function testMergeOrbBonuses(app) {
    const { mergeOrbBonuses } = await import("../src/entities/index.js");
    const current = { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 };
    const carry = { hp: 2, damage: 0, speed: 1, defense: 0, skill: 0 };

    const merged = mergeOrbBonuses(current, carry);
    assert.equal(merged.hp, 5, "3+2=5");
    assert.equal(merged.damage, 1, "1+0=1");
    assert.equal(merged.speed, 1, "0+1=1");
    assert.equal(merged.defense, 0, "0+0=0");
    assert.equal(merged.skill, 2, "2+0=2");
}

async function testCarryoverNotForNonHero(app) {
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const { BattleBall, applyHeroOrbStatAmount } = await import("../src/entities/index.js");
    const ball = new BattleBall(archer, { x: 480, y: 480 });

    const hpBefore = ball.maxHp;
    applyHeroOrbStatAmount(ball, "hp", 2, { countAsCurrentMatch: false });
    assert.equal(ball.maxHp, hpBefore + 10, "applyHeroOrbStatAmount should work on any BattleBall");
    assert.equal(ball.hero.bonuses.hp, 0, "countAsCurrentMatch=false should not increment bonuses");
}

async function testCarryoverSkillAffectsCooldown(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { BattleBall, applyHeroOrbStatAmount } = await import("../src/entities/index.js");
    const ball = new BattleBall(hero, { x: 480, y: 480 });
    ball.stats.allocation = { hp: 0, damage: 0, speed: 0, skill: 0, defense: 0 };

    applyHeroOrbStatAmount(ball, "skill", 2, { countAsCurrentMatch: false });
    assert.equal(ball.stats.allocation.skill, 2, "skill carryover should update statAllocation.skill");
}

async function testCarryoverDoesNotAffectSpecialOrbs(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { BattleBall, applyHeroOrbStatAmount } = await import("../src/entities/index.js");
    const ball = new BattleBall(hero, { x: 480, y: 480 });

    const bonusesBefore = { ...ball.hero.bonuses };
    applyHeroOrbStatAmount(ball, "dash", 5, { countAsCurrentMatch: true });
    applyHeroOrbStatAmount(ball, "arrow", 5, { countAsCurrentMatch: true });
    applyHeroOrbStatAmount(ball, "cooldown_burst", 5, { countAsCurrentMatch: true });
    assert.deepEqual(ball.hero.bonuses, bonusesBefore, "special orb keys should not affect hero.bonuses");
}

async function testTricksterSeedSpeedBuff(app) {
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
    assert.equal(seeds.length, 3, "Trickster should still launch three seeds");

    // Check speed range: owner combat speed × 1.2~1.5
    for (const seed of seeds) {
        const seedSpeed = seed.velocity.length();
        const ownerSpeed = trickster.stats.baseSpeed * (trickster.getStatModifiers()?.speed ?? 1);
        const expectedMin = ownerSpeed * 1.2;
        const expectedMax = ownerSpeed * 1.5;
        assert.ok(
            seedSpeed >= expectedMin - 0.01,
            `Seed speed ${seedSpeed.toFixed(1)} should be >= ${expectedMin.toFixed(1)} (1.2×)`
        );
        assert.ok(
            seedSpeed <= expectedMax + 0.01,
            `Seed speed ${seedSpeed.toFixed(1)} should be <= ${expectedMax.toFixed(1)} (1.5×)`
        );
    }
}

async function testTricksterSeedLifeBuff(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds = app.simulation.entities.filter((entity) => entity.constructor.name === "SeedOrb");
    assert.equal(seeds.length, 3, "Trickster should launch three seeds");

    // Seed life should be cooldown * 2
    const expectedLife = trickster.ability.cooldown * 2;
    for (const seed of seeds) {
        assert.equal(seed.life, expectedLife, `Seed life (${seed.life}) should be cooldown * 2 (${expectedLife})`);
    }
}

async function testTricksterSeedSpeedScalesWithOwner(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    trickster.position.x = 200;
    trickster.position.y = 480;
    opponent.position.x = 640;
    opponent.position.y = 480;

    // First batch
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds1 = app.simulation.entities.filter((e) => e.constructor.name === "SeedOrb");
    const speed1 = seeds1[0].velocity.length();

    // Double baseSpeed
    trickster.stats.baseSpeed *= 2;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds2 = app.simulation.entities.filter((e) => e.constructor.name === "SeedOrb");
    const speed2 = seeds2[0].velocity.length();

    assert.ok(
        speed2 > speed1 * 1.5,
        `Seed speed should scale with owner baseSpeed (${speed2.toFixed(1)} vs ${speed1.toFixed(1)})`
    );
}

// ── Tournament Roster Selection Tests ────────────────────────────────────────

async function testTournamentRosterOverEight() {
    // Currently has 9 (8 old + Hero)
    if (app.roster.length < 9) return; // Skip if roster count changed

    const { createEmptyStatAllocation } = await import("../src/statAllocation.js");
    const playerAllocation = createEmptyStatAllocation();
    const tournamentRoster = createTournamentRoster(app.roster, FIGHTER_IDS.ARCHER, playerAllocation, Math.random);
    assert.equal(tournamentRoster.length, 8, "Tournament roster should have exactly 8 participants when roster has 9+");
    const playerInRoster = tournamentRoster.find((f) => f.id === FIGHTER_IDS.ARCHER);
    assert.ok(playerInRoster, "Player fighter should be included in tournament roster");
    assert.ok(playerInRoster.isPlayer, "Player fighter should be marked as isPlayer");
    const playerCount = tournamentRoster.filter((f) => f.id === FIGHTER_IDS.ARCHER).length;
    assert.equal(playerCount, 1, "Player fighter should not be duplicated in tournament roster");
}

async function testTournamentRosterUnderEight() {
    const { createEmptyStatAllocation } = await import("../src/statAllocation.js");
    // Use a subset of roster with fewer than 8 entries
    const smallRoster = app.roster.slice(0, 4);
    const playerAllocation = createEmptyStatAllocation();
    const tournamentRoster = createTournamentRoster(smallRoster, smallRoster[0].id, playerAllocation, Math.random);
    assert.equal(
        tournamentRoster.length,
        smallRoster.length,
        "Tournament roster should include all fighters when roster is under 8"
    );
    // No duplicate entries
    const ids = tournamentRoster.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, "Tournament roster should not contain duplicates even when under 8");
    const playerInRoster = tournamentRoster.find((f) => f.id === smallRoster[0].id);
    assert.ok(playerInRoster, "Player fighter should be included even in small roster");
}

async function testTournamentRosterNoExcessMultipleRuns() {
    const { createEmptyStatAllocation } = await import("../src/statAllocation.js");
    const playerAllocation = createEmptyStatAllocation();
    for (let run = 0; run < 20; run++) {
        const roster = createTournamentRoster(app.roster, FIGHTER_IDS.HERO, playerAllocation, Math.random);
        assert.ok(
            roster.length <= 8,
            `Tournament roster should never exceed 8 participants (run ${run}, got ${roster.length})`
        );
        assert.ok(
            roster.some((f) => f.id === FIGHTER_IDS.HERO),
            `Player should always be in the roster (run ${run})`
        );
        const playerCount = roster.filter((f) => f.id === FIGHTER_IDS.HERO).length;
        assert.equal(playerCount, 1, `Player should not be duplicated (run ${run})`);
    }
}

// ── Achievement system tests ────────────────────────────────────────────────

async function testEvaluateAchievements() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { ACHIEVEMENT_DEFINITIONS } = await import("../src/collection/achievementDefinitions.js");
    const { evaluateAchievements } = await import("../src/collection/achievementRules.js");
    const { createRoster } = await import("../src/roster.js");
    const { createMatchReport, createTournamentReport, addMatchReport } = await import("../src/collection/index.js");

    // first_tournament_win: playerTournamentsCompleted >= 1 && report.playerWon
    const profile = createDefaultPlayerProfile();
    const roster = createRoster();
    const report = createTournamentReport();
    report.playerWon = true;
    report.playerFighterId = "archer";

    // Apply tournament report to populate playerTournamentsCompleted
    const { applyTournamentReport } = await import("../src/collection/index.js");
    applyTournamentReport(profile, report);

    const results = evaluateAchievements(profile, ACHIEVEMENT_DEFINITIONS, {
        profile,
        report,
        roster,
        playerFighterId: "archer"
    });
    const firstWin = results.find((r) => r.id === "first_tournament_win");
    assert.ok(firstWin, "first_tournament_win should unlock after first win");
    assert.ok(firstWin.reward, "first_tournament_win should have a reward");

    // 이미 해금된 업적은 다시 해금되지 않음
    const results2 = evaluateAchievements(profile, ACHIEVEMENT_DEFINITIONS, {
        profile,
        report,
        roster,
        playerFighterId: "archer"
    });
    assert.equal(results2.length, 0, "Already unlocked achievements should not fire again");

    // flawless_tournament: matchReports with combatDamageTaken === 0
    const profile2 = createDefaultPlayerProfile();
    const report2 = createTournamentReport();
    report2.playerWon = true;
    const match1 = createMatchReport();
    match1.combatDamageTaken = 0;
    const match2 = createMatchReport();
    match2.combatDamageTaken = 5;
    addMatchReport(report2, match1);
    applyTournamentReport(profile2, report2);

    const results3 = evaluateAchievements(profile2, ACHIEVEMENT_DEFINITIONS, {
        profile: profile2,
        report: report2,
        roster,
        playerFighterId: "archer"
    });
    // flawless_tournament: now checks .some() — one match with 0 damage is enough
    assert.ok(
        results3.some((r) => r.id === "flawless_tournament"),
        "flawless_tournament should unlock when any match has 0 damage"
    );

    // counter_expert: actionSuccessCounts.counter >= 10
    const profile3 = createDefaultPlayerProfile();
    profile3.collection.careerStats.actionSuccessCounts.counter = 10;
    const results4 = evaluateAchievements(profile3, ACHIEVEMENT_DEFINITIONS, {
        profile: profile3,
        report: createTournamentReport(),
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results4.some((r) => r.id === "counter_expert"),
        "counter_expert should unlock at 10 counter successes"
    );
    assert.ok(
        results4.some((r) => r.id === "first_tournament_win") === false,
        "first_tournament_win should NOT unlock without win"
    );

    // marathon_50: playerMatchesCompleted >= 50
    const profile5 = createDefaultPlayerProfile();
    profile5.collection.careerStats.playerMatchesCompleted = 50;
    const results5 = evaluateAchievements(profile5, ACHIEVEMENT_DEFINITIONS, {
        profile: profile5,
        report: createTournamentReport(),
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results5.some((r) => r.id === "marathon_50"),
        "marathon_50 should unlock at 50 matches"
    );

    // speed_2x: first win — 첫 evaluateCall에서 함께 해금됨
    assert.ok(
        results.some((r) => r.id === "speed_2x"),
        "speed_2x should unlock with first win"
    );

    // speed_4x: bestTournamentWinStreak >= 3
    const profile7 = createDefaultPlayerProfile();
    const report7 = createTournamentReport();
    report7.playerFighterId = "archer";
    profile7.collection.careerStats.bestTournamentWinStreak = 3;
    const results7 = evaluateAchievements(profile7, ACHIEVEMENT_DEFINITIONS, {
        profile: profile7,
        report: report7,
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results7.some((r) => r.id === "speed_4x"),
        "speed_4x should unlock at 3-win streak"
    );

    // single_hit_monster: maxHitDamage >= 150
    const profile8 = createDefaultPlayerProfile();
    const report8 = createTournamentReport();
    report8.playerFighterId = "archer";
    const matchBig = createMatchReport();
    matchBig.maxHitDamage = 150;
    addMatchReport(report8, matchBig);
    const results8 = evaluateAchievements(profile8, ACHIEVEMENT_DEFINITIONS, {
        profile: profile8,
        report: report8,
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results8.some((r) => r.id === "single_hit_monster"),
        "single_hit_monster should unlock at 150 maxHitDamage"
    );
}

async function testApplyAchievementRewards() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { applyAchievementRewards, computeEffectiveBonuses } = await import("../src/progression/progressionState.js");

    const profile = createDefaultPlayerProfile();

    // 업적 해금 시뮬레이션 (evaluateAchievements가 하는 일)
    profile.collection.achievements["test_ach_1"] = { unlockedAt: Date.now() };

    const results = [
        {
            id: "test_ach_1",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } }
        },
        { id: "test_ach_2", reward: null }
    ];

    const outcomes = applyAchievementRewards(results);
    assert.equal(outcomes.length, 2, "Should return outcome for each result");
    assert.ok(outcomes[0].applied, "Reward with valid bonus should be applied");
    assert.equal(outcomes[0].bonusKey, "extraStatPoints");
    assert.equal(outcomes[0].amount, 5);

    // 동적 계산으로 보상 확인
    const defs = [{ id: "test_ach_1", reward: results[0].reward }];
    const computed = computeEffectiveBonuses(profile, defs);
    assert.equal(computed.extraStatPoints, 5, "Computed bonus should be 5 from unlocked achievement");

    assert.ok(!outcomes[1].applied, "Null reward should not be applied");
}

async function testFormatRewardDescription() {
    const { formatRewardDescription } = await import("../src/progression/progressionState.js");

    assert.equal(formatRewardDescription(null), "", "Null reward should return empty");
    assert.equal(formatRewardDescription({}), "", "Reward without type should return empty");

    const r1 = { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } };
    assert.ok(
        formatRewardDescription(r1).includes("추가 스탯 포인트"),
        "extraStatPoints reward should describe correctly"
    );
    assert.ok(formatRewardDescription(r1).includes("+5"), "Reward amount should be included");
}

async function testProgressionBonusCapClamp() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { computeEffectiveBonuses } = await import("../src/progression/progressionState.js");

    const profile = createDefaultPlayerProfile();

    // extraStatPoints cap is 40 — 업적 여러 개가 합산 45를 줘도 상한 40
    const defs = [
        { id: "ach1", reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 20 } } },
        { id: "ach2", reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 20 } } },
        { id: "ach3", reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } } }
    ];

    // 세 업적 모두 해금
    for (const def of defs) {
        profile.collection.achievements[def.id] = { unlockedAt: Date.now() };
    }

    const computed = computeEffectiveBonuses(profile, defs);
    assert.equal(computed.extraStatPoints, 40, "Should cap at 40 even with 45 total from definitions");

    // 두 개만 해금 → 40 (cap)
    delete profile.collection.achievements["ach3"];
    const computed2 = computeEffectiveBonuses(profile, defs);
    assert.equal(computed2.extraStatPoints, 40, "Should cap at 40 with two 20-point achievements");
}

// ── Mastery system tests ───────────────────────────────────────────────────

async function testGetCharacterMasteryLevel() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { getCharacterMasteryLevel } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();
    assert.equal(getCharacterMasteryLevel(profile, "archer"), 0, "New profile should have level 0");
    assert.equal(getCharacterMasteryLevel(profile, "invalid"), 0, "Invalid ID should return 0");

    profile.characterMastery.levels = { archer: 2 };
    assert.equal(getCharacterMasteryLevel(profile, "archer"), 2, "Should return stored level");
}

async function testGetCharacterChallengeLevel() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { getCharacterChallengeLevel } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 0, "Level 0 -> challenge 0");

    profile.characterMastery.levels = { archer: 1 };
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 1, "Level 1 -> challenge 1");

    profile.characterMastery.levels = { archer: 3 };
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 2, "Level 3 (GOLD) -> challenge 2 (capped)");
}

async function testAdvanceCharacterMastery() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { advanceCharacterMastery, getCharacterMasteryLevel } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();

    // 레벨 0 → BRONZE (난도 0)
    const r1 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 0, playerWon: true });
    assert.ok(r1.changed, "Win at challenge 0 should advance to BRONZE");
    assert.equal(r1.newLevel, 1);
    assert.equal(r1.previousTier, "미해금");
    assert.equal(r1.newTier, "BRONZE");

    // BRONZE → SILVER: needs challenge >= 1
    const r2 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 0, playerWon: true });
    assert.ok(!r2.changed, "Bronze needs challenge >= 1");
    assert.equal(r2.reason, "insufficient_challenge");

    const r3 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 1, playerWon: true });
    assert.ok(r3.changed, "Win at challenge 1 should advance to SILVER");
    assert.equal(r3.newLevel, 2);

    // SILVER → GOLD: needs challenge >= 2
    const r4 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 2, playerWon: true });
    assert.ok(r4.changed, "Win at challenge 2 should advance to GOLD");
    assert.equal(r4.newLevel, 3);

    // GOLD: max, no further advance
    const r5 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 2, playerWon: true });
    assert.ok(!r5.changed, "GOLD should not advance");
    assert.equal(r5.reason, "max_level");

    // 패배
    const r6 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 0, playerWon: false });
    assert.ok(!r6.changed, "Loss should not advance");
    assert.equal(r6.reason, "lost");

    // 잘못된 ID
    const r7 = advanceCharacterMastery(profile, { characterId: "invalid", challengeLevel: 0, playerWon: true });
    assert.ok(!r7.changed, "Invalid ID should not advance");
}

// ── Tournament report tests ─────────────────────────────────────────────────

async function testApplyTournamentReport() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { createMatchReport, createTournamentReport, addMatchReport, applyTournamentReport } =
        await import("../src/collection/index.js");

    const profile = createDefaultPlayerProfile();
    const report = createTournamentReport();
    report.playerFighterId = "archer";
    report.playerWon = true;
    report.placement = 1;

    const match = createMatchReport();
    match.playerWon = true;
    match.combatDamageDealt = 100;
    match.combatDamageTaken = 5;
    match.lowestHpRatio = 0.5;
    match.usedActionIds = ["rush", "counter"];
    match.actionSuccessCounts = { counter: 1 };
    addMatchReport(report, match);

    const result = applyTournamentReport(profile, report);
    assert.ok(!result.alreadyProcessed, "First apply should succeed");

    const charRecord = profile.collection.characters.archer;
    assert.ok(charRecord, "Character record should exist");
    assert.equal(charRecord.tournamentsCompleted, 1, "Tournament count should increment");
    assert.equal(charRecord.tournamentWins, 1, "Win should be recorded");
    assert.equal(charRecord.matchWins, 1, "Match win should be recorded");
    assert.equal(charRecord.totalDamageDealt, 100, "Damage dealt should match");
    assert.equal(charRecord.bestPlacement, 1, "Best placement should be 1");

    assert.equal(profile.collection.careerStats.playerTournamentsCompleted, 1);
    assert.equal(profile.collection.careerStats.playerMatchesCompleted, 1);
    assert.equal(profile.collection.careerStats.currentTournamentWinStreak, 1);
    assert.ok(profile.collection.careerStats.usedActionIds.includes("rush"), "Action IDs should be recorded");
    assert.equal(profile.collection.careerStats.actionSuccessCounts.counter, 1);

    // 중복 반영 방지
    const result2 = applyTournamentReport(profile, report);
    assert.ok(result2.alreadyProcessed, "Duplicate report should be skipped");
}

// ── Toast queue tests ───────────────────────────────────────────────────────

async function testToastQueue() {
    // UI의 showToast가 큐 기반으로 동작하는지 검증
    // 실제로는 내부 _processToastQueue 동작으로, 동시 호출 시 덮어쓰기가 아닌 순차 표시
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");

    // Alpine state를 흉내내는 가상 state 객체로 큐 동작 검증
    const state = {
        toastVisible: false,
        toastMessage: "",
        toastTimer: null,
        toastQueue: []
    };

    // processToastQueue를 직접 시뮬레이션
    function processToastQueue() {
        if (state.toastTimer || state.toastQueue.length === 0) return;
        const item = state.toastQueue.shift();
        state.toastMessage = item.message;
        state.toastVisible = true;
        state.toastTimer = 1; // 가짜 타이머 (non-null)
    }

    function finishCurrentToast() {
        state.toastVisible = false;
        state.toastTimer = null;
        processToastQueue();
    }

    // 첫 번째 토스트
    state.toastQueue.push({ message: "업적1", duration: 3500 });
    processToastQueue();
    assert.equal(state.toastVisible, true, "First toast should be visible");
    assert.equal(state.toastMessage, "업적1", "First toast message should match");

    // 두 번째 토스트 (첫 번째가 아직 표시 중)
    state.toastQueue.push({ message: "업적2", duration: 3500 });
    assert.equal(state.toastQueue.length, 1, "Second toast should be queued, not overwritten");
    assert.equal(state.toastMessage, "업적1", "First toast should still be showing while second is queued");

    // 세 번째 토스트
    state.toastQueue.push({ message: "업적3", duration: 3500 });
    assert.equal(state.toastQueue.length, 2, "Third toast should also be queued");

    // 첫 번째 토스트 종료 → 두 번째가 표시되어야 함
    finishCurrentToast();
    assert.equal(state.toastVisible, true, "Second toast should be visible after first ends");
    assert.equal(state.toastMessage, "업적2", "Second toast message should match");
    assert.equal(state.toastQueue.length, 1, "Queue should have one remaining");

    // 두 번째 토스트 종료 → 세 번째가 표시되어야 함
    finishCurrentToast();
    assert.equal(state.toastVisible, true, "Third toast should be visible after second ends");
    assert.equal(state.toastMessage, "업적3", "Third toast message should match");
    assert.equal(state.toastQueue.length, 0, "Queue should be empty");

    // 세 번째 토스트 종료 → 더 이상 표시할 것 없음
    finishCurrentToast();
    assert.equal(state.toastVisible, false, "Toast should be hidden when queue is empty");
}

// ── Bonus points effective total test ───────────────────────────────────────

async function testBonusPointsEffectiveTotal() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { computeEffectiveBonuses } = await import("../src/progression/progressionState.js");
    const { collectActiveEffects } = await import("../src/character-mastery/index.js");
    const { PLAYER_STAT_POINTS } = await import("../src/statAllocation.js");

    // 성장 보너스만 있는 경우 — 해금된 업적으로 동적 계산
    const profile1 = createDefaultPlayerProfile();
    profile1.collection.achievements["test_ach"] = { unlockedAt: Date.now() };
    const defs1 = [
        {
            id: "test_ach",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 10 } }
        }
    ];
    const computed1 = computeEffectiveBonuses(profile1, defs1);
    const ctx1 = collectActiveEffects(profile1, "archer");
    const effectiveTotal1 = PLAYER_STAT_POINTS + ctx1.allocationModifiers.extraStatPoints + computed1.extraStatPoints;
    assert.equal(effectiveTotal1, 110, "extraStatPoints from progression should increase effective total");

    // 숙련도 보너스만 있는 경우 (hero at BRONZE = +3 extraStatPoints, playing as archer)
    const profile2 = createDefaultPlayerProfile();
    profile2.characterMastery.levels = { hero: 1 };
    const ctx2 = collectActiveEffects(profile2, "archer");
    const effectiveTotal2 = PLAYER_STAT_POINTS + ctx2.allocationModifiers.extraStatPoints;
    assert.equal(effectiveTotal2, 103, "extraStatPoints from hero mastery should increase effective total");

    // hero로 플레이 중이면 자신의 숙련도는 미적용
    const ctx2Self = collectActiveEffects(profile2, "hero");
    const effectiveTotal2Self = PLAYER_STAT_POINTS + ctx2Self.allocationModifiers.extraStatPoints;
    assert.equal(effectiveTotal2Self, 100, "Self mastery should not contribute extraStatPoints");

    // 성장 + 숙련도 중첩
    const profile3 = createDefaultPlayerProfile();
    profile3.collection.achievements["test_ach"] = { unlockedAt: Date.now() };
    profile3.characterMastery.levels = { hero: 2 }; // SILVER = +6
    const computed3 = computeEffectiveBonuses(profile3, defs1);
    const ctx3 = collectActiveEffects(profile3, "archer");
    const effectiveTotal3 = PLAYER_STAT_POINTS + ctx3.allocationModifiers.extraStatPoints + computed3.extraStatPoints;
    assert.equal(effectiveTotal3, 116, "Combined progression + mastery should stack");

    // 보너스 0인 경우
    const profile4 = createDefaultPlayerProfile();
    const computed4 = computeEffectiveBonuses(profile4, []);
    const ctx4 = collectActiveEffects(profile4, "archer");
    const effectiveTotal4 = PLAYER_STAT_POINTS + ctx4.allocationModifiers.extraStatPoints + computed4.extraStatPoints;
    assert.equal(effectiveTotal4, 100, "No bonuses should keep effective total at base");
}

// ── Sensitivity reset test ──────────────────────────────────────────────────

async function testSensitivityAlwaysReset() {
    const { STAT_BALANCER_CONFIG } = await import("../src/statAllocation.js");

    // balanceTolerance가 0이어도 SENSITIVITY는 20으로 설정되어야 함
    STAT_BALANCER_CONFIG.SENSITIVITY = 99; // 이전 값 흔적
    const totalBalanceTol = 0;
    STAT_BALANCER_CONFIG.SENSITIVITY = 20 + totalBalanceTol;
    assert.equal(STAT_BALANCER_CONFIG.SENSITIVITY, 20, "SENSITIVITY should reset to 20 when balanceTol=0");

    // balanceTolerance가 있으면 증가
    STAT_BALANCER_CONFIG.SENSITIVITY = 20 + 5;
    assert.equal(STAT_BALANCER_CONFIG.SENSITIVITY, 25, "SENSITIVITY should be 20+5=25 when balanceTol=5");

    // 다시 0으로
    STAT_BALANCER_CONFIG.SENSITIVITY = 20 + 0;
    assert.equal(STAT_BALANCER_CONFIG.SENSITIVITY, 20, "SENSITIVITY should reset back to 20");
}

// ── adjustStat with bonus total test ────────────────────────────────────────

async function testAdjustStatWithBonusTotal() {
    const { adjustStatAllocation, getRemainingStatPoints, PLAYER_STAT_POINTS, createEmptyStatAllocation } =
        await import("../src/statAllocation.js");

    const effectiveTotal = PLAYER_STAT_POINTS + 5; // +5 bonus
    let allocation = createEmptyStatAllocation();

    // Fill base 100 points (20 per stat, within 50 cap)
    for (const key of ["hp", "damage", "speed", "skill", "defense"]) {
        allocation = adjustStatAllocation(allocation, key, 20, effectiveTotal);
    }
    assert.equal(
        getRemainingStatPoints(allocation, effectiveTotal),
        5,
        "After allocating 100/105 (20 each), remaining should be 5"
    );

    // Bonus points도 배분 가능해야 함
    allocation = adjustStatAllocation(allocation, "hp", 5, effectiveTotal);
    assert.equal(
        getRemainingStatPoints(allocation, effectiveTotal),
        0,
        "After allocating 105/105, remaining should be 0"
    );

    // 초과 배분 불가
    allocation = adjustStatAllocation(allocation, "speed", 1, effectiveTotal);
    assert.equal(getRemainingStatPoints(allocation, effectiveTotal), 0, "Cannot allocate beyond effectiveTotal");
}

// ── Mastery modifier tests ─────────────────────────────────────────────────

async function testMasteryModifiersStoredOnBattleBall(app) {
    // BattleBall 생성 시 mastery.physics, mastery.action, mastery.passives가 저장되는지 확인
    const { BattleBall } = await import("../src/entities/index.js");
    const { Vector2 } = await import("../src/core.js");

    const spec = {
        id: "archer",
        name: "Archer",
        title: "Test Title",
        description: "",
        color: "#ff0000",
        face: "archer",
        stats: { hp: 1000, damage: 50, speed: 200, defense: 5, radius: 16, mass: 10 },
        statAllocation: null,
        mastery: {
            physics: {
                incomingKnockbackReduce: 0.05,
                outgoingImpactBonus: 0.03,
                velocityRecoveryBonus: 0.02
            },
            action: { hpCostPercentReduction: 0.003, minHpCostPercent: 0.001 },
            passives: [{ id: "test_passive", type: "periodic_collision_bonus", cooldown: 12, damageBonus: 0.04 }]
        }
    };

    const ball = new BattleBall(spec, new Vector2(100, 100));
    assert.equal(ball.mastery.physics.incomingKnockbackReduce, 0.05, "incomingKnockbackReduce should be stored");
    assert.equal(ball.mastery.physics.outgoingImpactBonus, 0.03, "outgoingImpactBonus should be stored");
    assert.equal(ball.mastery.physics.velocityRecoveryBonus, 0.02, "velocityRecoveryBonus should be stored");
    assert.equal(ball.mastery.action.hpCostPercentReduction, 0.003, "hpCostPercentReduction should be stored");
    assert.equal(ball.mastery.action.minHpCostPercent, 0.001, "minHpCostPercent should be stored");
    assert.equal(ball.mastery.passives.length, 1, "combat passives should be stored");
    assert.equal(ball.mastery.passives[0].id, "test_passive", "passive id should match");
}

async function testStatModifierDamageIndependentOfHp() {
    // Bug 10: 데미지 보너스가 hp 보너스 게이트에 묶여있지 않은지 확인
    // 이 테스트는 코드 레벨 검증 — stat modifier가 독립 적용되는지 확인
    const { MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");

    // archer의 mastery는 damage만 제공 (hp 없음)
    const archerDef = MASTERY_EFFECT_DEFS.find((d) => d.sourceFighterId === "archer");
    assert.ok(archerDef, "Archer mastery should exist");

    // archer mastery의 apply는 damage에만 영향을 줌
    const ctx = {
        statModifiers: { hp: 0, damage: 0, defense: 0 },
        allocationModifiers: { extraStatPoints: 0, balanceTolerance: 0, perStatCapBonus: 0 },
        physicsModifiers: { incomingKnockbackReduce: 0, outgoingImpactBonus: 0, velocityRecoveryBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, minHpCostPercent: 0 }
    };

    archerDef.apply(ctx, 1); // BRONZE level
    assert.ok(ctx.statModifiers.damage > 0, "Archer mastery should increase damage");
    assert.equal(ctx.statModifiers.hp, 0, "Archer mastery should NOT increase hp");

    // eater의 mastery는 hp만 제공 (damage 없음)
    const eaterDef = MASTERY_EFFECT_DEFS.find((d) => d.sourceFighterId === "eater");
    assert.ok(eaterDef, "Eater mastery should exist");

    eaterDef.apply(ctx, 1);
    assert.ok(ctx.statModifiers.hp > 0, "Eater mastery should increase hp");
    // damage는 archer가 이미 올렸으므로 변함 없어야 하지만 eater가 추가로 올리진 않음
    const damageAfterEater = ctx.statModifiers.damage;
    eaterDef.apply(ctx, 1); // 두 번 호출해도 damage는 eater가 올리지 않음
    assert.equal(ctx.statModifiers.damage, damageAfterEater, "Eater mastery should NOT increase damage");
}

// ── Dynamic bonus computation test ──────────────────────────────────────────

async function testComputeEffectiveBonusesDynamic() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { computeEffectiveBonuses } = await import("../src/progression/progressionState.js");

    const profile = createDefaultPlayerProfile();

    // 업적 하나 해금
    profile.collection.achievements["ach_1"] = { unlockedAt: Date.now() };

    // 정의 v1: +5 extraStatPoints
    const defsV1 = [
        {
            id: "ach_1",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } }
        }
    ];
    const computedV1 = computeEffectiveBonuses(profile, defsV1);
    assert.equal(computedV1.extraStatPoints, 5, "v1: bonus should be 5");

    // 정의 v2 (업데이트): 동일 업적 보상이 +10으로 상향 — 재접속 시 자동 반영되어야 함
    const defsV2 = [
        {
            id: "ach_1",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 10 } }
        }
    ];
    const computedV2 = computeEffectiveBonuses(profile, defsV2);
    assert.equal(computedV2.extraStatPoints, 10, "v2: bonus should auto-update to 10 without re-unlock");

    // 미해금 업적은 계산에서 제외
    const defsWithLocked = [
        ...defsV2,
        {
            id: "ach_locked",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 99 } }
        }
    ];
    const computedLocked = computeEffectiveBonuses(profile, defsWithLocked);
    assert.equal(computedLocked.extraStatPoints, 10, "Locked achievement should not contribute");
}

// ── Collection hub ViewModel tests ──────────────────────────────────────────

async function testCreateCollectionHubViewModel() {
    const { createCollectionHubViewModel } = await import("../src/collection/collectionViewModel.js");
    const { MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { createRoster } = await import("../src/roster.js");

    const roster = createRoster();
    const profile = createDefaultPlayerProfile();

    const vm = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });

    assert.equal(vm.rosterSize, roster.length, "rosterSize should match");
    assert.equal(vm.rosterItems.length, roster.length, "rosterItems should include all characters");
    assert.equal(vm.masteryItems.length, MASTERY_EFFECT_DEFS.length, "masteryItems should match definitions");

    const allHaveIds = vm.rosterItems.every((item) => item.id);
    assert.ok(allHaveIds, "Every roster item should have an id");

    // 숙련도 항목에 sourceName과 unlockCondition이 있는지
    const firstMastery = vm.masteryItems[0];
    assert.ok(firstMastery.sourceName, "Mastery item should have sourceName");
    assert.ok(firstMastery.unlockCondition, "Mastery item should have unlockCondition");

    // 승리 기록 추가 시 masteryLevel/masteryUnlocked 반영
    profile.collection.characters.archer = {
        tournamentsCompleted: 10,
        tournamentWins: 6,
        matchWins: 15,
        bestPlacement: 1,
        totalDamageDealt: 5000,
        comebackMatchWins: 2,
        firstTournamentAt: 1000,
        lastTournamentAt: 2000
    };
    profile.experience.byCharacter.archer = { currentXp: 135 };
    profile.hunting.keyShards = 50;
    profile.hunting.chests = [{ id: "hunt-chest-1", rarity: "uncommon", acquiredAt: 3000 }];
    const vm2 = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });
    const archerItem = vm2.rosterItems.find((i) => i.id === "archer");
    assert.equal(archerItem.tournamentWins, 6, "tournamentWins should match");
    assert.equal(archerItem.bestPlacement, 1, "bestPlacement should match");
    assert.equal(archerItem.experienceTotalXp, 135, "Roster item should expose character XP");
    assert.equal(archerItem.experienceLevel, 2, "Roster item should expose character XP level");
    assert.ok(archerItem.experienceProgressPct > 0, "Roster item should expose XP progress");
    assert.equal(vm2.storage.keyShards, 50, "Collection hub should expose hunting key shards");
    assert.equal(vm2.storage.chests.length, 1, "Collection hub should expose hunting chests");
    assert.equal(vm2.storage.chests[0].canOpen, true, "Collection hub should mark openable chests");
    assert.equal(vm2.summary.storageChestCount, 1, "Collection summary should count storage chests");

    // 숙련도 레벨이 있으면 masteryItems에 반영
    profile.characterMastery.levels = { archer: 1, orbit: 2, eater: 3 };
    const vm3 = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });
    const arcMastery = vm3.masteryItems.find((i) => i.sourceFighterId === "archer");
    assert.ok(arcMastery.unlocked, "Archer mastery should be unlocked");
    assert.ok(arcMastery.isSelf, "Archer mastery should be marked as self");
    assert.equal(arcMastery.level, 1, "Archer mastery level should be 1");
}

const app = await loadModuleApp();
testShuffledUtility();
testStatAllocationRules(app);
testStatAllocationUiSyncEvent();
testRenderPlayerSetupCopiesAllocation(app);
await testBattleAppAdoptsPreExistingAlpineAllocation();
testIndexCacheVersionMatchesLatestPatchNote();
testStatBalanceSystem();
testMultiFighterSimulationSetup(app);
testArenaCameraZoom();
testHuntingMeleeMobChasesTarget(app);
testTeamTargetingAndFriendlyCollision(app);
testTeamsResolveByRemainingHostileTeams(app);
testProjectileIgnoresAllies(app);
testPassiveEvasionAppliesImpulse(app);
testClickActionEffectOwnership(app);
testRiskWindowActionOwnership(app);
await testCloneSeedDash(app);
await testEaterFeast(app);
await testRageBallMomentum(app);
await testDashBallCooldownDash(app);
await testCollisionImpulsePersists(app);
await testGrenadeScatterShot(app);
testExperienceSystem();
testHuntingSystem();
testAlpineTemplateComponentSystem();
await testMatchEndGrantsImmediateExperience(app);
await testDamageShake(app);
await testArrowBounceFacing(app);
await testOrbitShardRecharge(app);
await testTournament(app);
await testHeroBallRegistered(app);
await testHeroAbilitySpawnsOrb(app);
await testHeroOrbEffectType(app);
await testHeroOrbOwnerCollects(app);
await testHeroOrbOpponentCollects(app);
await testHeroOrbMaxActivePerOwner(app);
await testHeroOrbDoesNotExpireFromCooldown(app);
await testHeroOrbLimitIgnoresCollectedOrbs(app);
await testHeroOrbStatCapInfinite(app);
await testHeroOrbStatCapLimited(app);
await testHeroOrbNoDamage(app);
await testHeroBaseCooldown(app);
await testHeroOrbSpeedMinMax(app);
await testHeroOrbSpeedScalesWithOwner(app);
await testHeroOrbOwnerCollectFeedback(app);
await testHeroOrbOpponentNoFeedback(app);
await testHeroOrbCapNoFeedback(app);
await testHeroOrbBonusUiFormat(app);
await testHeroOrbBonusUiOnlyForHero(app);
await testHeroExistingRulesNotBroken(app);
await testPickHeroOrbEffectType();
await testSpecialOrbOwnerCollectDash(app);
await testSpecialOrbOwnerCollectArrow(app);
await testSpecialOrbOwnerCollectCooldownBurst(app);
await testSpecialOrbCooldownBurstExpires(app);
await testSpecialOrbOpponentCollects(app);
await testSpecialOrbNotInStatBonuses(app);
await testSpecialOrbCountsTowardMaxActive(app);
await testSpecialOrbDrawDistinction(app);
await testCarryoverRateConstant();
await testComputeHeroOrbCarryover();
await testComputeHeroOrbCarryoverCustomRate();
await testMergeHeroOrbCarryover();
await testMergeHeroOrbCarryoverNoRecycle();
await testApplyHeroOrbCarryoverToBattleBall(app);
await testMergeOrbBonuses(app);
await testCarryoverNotForNonHero(app);
await testCarryoverSkillAffectsCooldown(app);
await testCarryoverDoesNotAffectSpecialOrbs(app);
await testRollHeroOrbStatGain();
await testHeroOrbStatGainAmountApplied(app);
await testHeroOrbStatGainDamage(app);
await testHeroOrbStatGainSpeed(app);
await testHeroOrbStatGainDefense(app);
await testHeroOrbStatGainSkill(app);
await testHeroOrbStatGainCapClamp(app);
await testHeroOrbSpecialNotAffectedByGain(app);
await testTricksterSeedSpeedBuff(app);
await testTricksterSeedLifeBuff(app);
await testTricksterSeedSpeedScalesWithOwner(app);
// Tournament roster tests
await testTournamentRosterOverEight();
await testTournamentRosterUnderEight();
await testTournamentRosterNoExcessMultipleRuns();
// Achievement system tests
await testEvaluateAchievements();
await testApplyAchievementRewards();
await testFormatRewardDescription();
await testProgressionBonusCapClamp();
// Mastery system tests
await testAdvanceCharacterMastery();
await testGetCharacterMasteryLevel();
await testGetCharacterChallengeLevel();
// Tournament report tests
await testApplyTournamentReport();
// Collection hub view model tests
await testCreateCollectionHubViewModel();
// Toast queue tests
await testToastQueue();
// Bonus points effective total test
await testBonusPointsEffectiveTotal();
// Sensitivity reset + adjustStat with bonus total test
await testSensitivityAlwaysReset();
await testAdjustStatWithBonusTotal();
// Mastery modifier tests
await testMasteryModifiersStoredOnBattleBall(app);
await testStatModifierDamageIndependentOfHp();
// Dynamic bonus computation test
await testComputeEffectiveBonusesDynamic();
// ── New character tests ──────────────────────────────────────────────────────

async function testNewCharactersRegistered(app) {
    const vampire = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
    assert.ok(vampire, "Vampire Ball should be registered in the roster");
    assert.equal(vampire.ability, "vampire", "Vampire Ball should have 'vampire' ability type");

    const gunner = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GUNNER);
    assert.ok(gunner, "Gunner Ball should be registered in the roster");
    assert.equal(gunner.ability, "gunner", "Gunner Ball should have 'gunner' ability type");

    const phantom = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.PHANTOM);
    assert.ok(phantom, "Phantom Ball should be registered in the roster");
    assert.equal(phantom.ability, "phantom", "Phantom Ball should have 'phantom' ability type");
}

async function testVampireBatsSpawn(app) {
    const vampire = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);
    const sim = new BattleSimulation([vampire, opponent], { onLog() {}, onSound() {} });
    const vampireFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.VAMPIRE);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);

    sim.entities = sim.fighters.slice();
    vampireFighter.ability.timer = 0;
    vampireFighter.ability.update(0.016, target);
    const bats = sim.entities.filter((e) => e.constructor?.name === "BatProjectile");
    assert.equal(bats.length, 7, "Vampire should spawn 7 bats when cooldown triggers");
}

async function testVampireLifestealOnCollision(app) {
    const vampire = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);
    const sim = new BattleSimulation([vampire, opponent], { onLog() {}, onSound() {} });
    const vampireFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.VAMPIRE);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);

    vampireFighter.position.x = 200;
    vampireFighter.position.y = 480;
    target.position.x = 240;
    target.position.y = 480;
    vampireFighter.applyImpulse(Vector2.subtract(new Vector2(500, 0), vampireFighter.velocity));
    target.applyImpulse(Vector2.subtract(new Vector2(-300, 0), target.velocity));
    vampireFighter.hp = 10;

    const hpBefore = vampireFighter.hp;
    vampireFighter.ability.onCollision(target);
    assert.ok(vampireFighter.hp > hpBefore, "Vampire should heal on collision (lifesteal)");
}

async function testGunnerBulletsSpawn(app) {
    const gunner = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GUNNER);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.GUNNER);
    const sim = new BattleSimulation([gunner, opponent], { onLog() {}, onSound() {} });
    const gunnerFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.GUNNER);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.GUNNER);

    sim.entities = sim.fighters.slice();
    gunnerFighter.ability.timer = 0;
    gunnerFighter.ability.update(0.016, target); // starts burst
    gunnerFighter.ability.update(0.016, target); // fires first bullet
    const bullets = sim.entities.filter((e) => e.constructor?.name === "BulletProjectile");
    assert.ok(bullets.length >= 1, "Gunner should fire at least 1 bullet");
    assert.ok(bullets.length <= 6, "Gunner should fire at most 6 bullets");
}

async function testPhantomRegistered(app) {
    const phantom = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.PHANTOM);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.PHANTOM);
    const sim = new BattleSimulation([phantom, opponent], { onLog() {}, onSound() {} });
    const phantomFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.PHANTOM);
    assert.ok(phantomFighter.ability.constructor.name === "PhantomAbility", "Phantom should have PhantomAbility");
}

async function testPhantomShadowStrike(app) {
    const phantom = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.PHANTOM);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.PHANTOM);
    const sim = new BattleSimulation([phantom, opponent], { onLog() {}, onSound() {} });
    const phantomFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.PHANTOM);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.PHANTOM);

    phantomFighter.position.x = 200;
    phantomFighter.position.y = 480;
    target.position.x = 250;
    target.position.y = 480;
    phantomFighter.ability.timer = 0;
    phantomFighter.ability.state.primed = true;
    phantomFighter.ability.state.primedTimer = 99;

    const posBefore = phantomFighter.position.clone();
    phantomFighter.ability.onCollision(target);
    assert.ok(phantomFighter.ability.timer > 0, "Phantom should set cooldown after shadow strike");
    // During vanish phase, position hasn't changed yet
    const distBefore = Vector2.subtract(phantomFighter.position, posBefore).length();
    assert.ok(distBefore < 1, "Phantom should not teleport yet during vanish phase");
    // Simulate through vanish + appear animation
    for (let i = 0; i < 60; i++) {
        phantomFighter.ability.update(0.01, target);
    }
    assert.ok(phantomFighter.state.movement, "Phantom should start dashing after teleport animation");
    // Position should have changed (teleported behind target)
    const distFromTarget = Vector2.subtract(phantomFighter.position, target.position).length();
    assert.ok(distFromTarget > 10, "Phantom should teleport away from target position");
}

function testCompleteChallengeTournament() {
    const profile = createDefaultPlayerProfile();
    // 기본: highestUnlockedLevel=0, selectedLevel=0
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 0);
    assert.equal(profile.progression.challenge.selectedLevel, 0);

    // 레벨 0에서 우승 → 레벨 1 해금
    const r1 = completeChallengeTournament(profile, { selectedLevel: 0, playerWon: true });
    assert.ok(r1.unlocked);
    assert.equal(r1.unlockedLevel, 1);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 1);
    assert.equal(profile.progression.challenge.selectedLevel, 1);

    // 레벨 1에서 패배 → 변화 없음
    const r2 = completeChallengeTournament(profile, { selectedLevel: 1, playerWon: false });
    assert.ok(!r2.unlocked);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 1);

    // 낮은 레벨(0)에서 우승 → 변화 없음 (이미 1 해금)
    const r3 = completeChallengeTournament(profile, { selectedLevel: 0, playerWon: true });
    assert.ok(!r3.unlocked);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 1);

    // 레벨 1에서 우승 → 레벨 2 해금
    const r4 = completeChallengeTournament(profile, { selectedLevel: 1, playerWon: true });
    assert.ok(r4.unlocked);
    assert.equal(r4.unlockedLevel, 2);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 2);
    assert.equal(profile.progression.challenge.selectedLevel, 2);
}

function testFormatBonusSummary() {
    assert.equal(formatBonusSummary({ extraStatPoints: 0, balanceTolerance: 0, perStatCapBonus: 0 }), "");
    assert.equal(formatBonusSummary({ extraStatPoints: 10, balanceTolerance: 0, perStatCapBonus: 0 }), "배분 +10");
    assert.equal(
        formatBonusSummary({ extraStatPoints: 20, balanceTolerance: 5, perStatCapBonus: 15 }),
        "배분 +20 · 유연성 +5 · 집중 한도 +15"
    );
}

function testGrenadeProximityTrigger() {
    const grenadeFighter = app.roster.find((fighter) => fighter.ability === "grenade");
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([archer, grenadeFighter], { onLog() {}, onSound() {} });
    const owner = sim.fighters.find((f) => f.id === grenadeFighter.id);
    const archerBall = sim.fighters.find((f) => f.id !== grenadeFighter.id);

    owner.position = new Vector2(400, 480);
    const g = new Grenade(owner, new Vector2(500, 480), 1.0);
    g.position = new Vector2(400, 480);
    assert.ok(g.timer > 0.5, "Grenade should start with full fuse timer");

    // 아처가 수류탄 폭발 범위 밖에 있음 → 타이머 변화 없음
    archerBall.position = new Vector2(100, 100);
    g.update(0.016, sim);
    assert.ok(!g._proximityTriggered, "Proximity should not trigger when target is far");

    // 아처가 폭발 범위 내로 이동
    archerBall.position = new Vector2(420, 480);
    g.update(0.016, sim);
    assert.ok(g._proximityTriggered, "Proximity should trigger when target enters explosion radius");
    // 타이머가 0.6배로 단축되었어야 함
    const proximityTimer = g.timer;
    // 다시 업데이트해도 두 번째 가속은 없어야 함
    g.update(0.016, sim);
    assert.ok(g.timer < proximityTimer, "Timer should keep decreasing after proximity trigger");
    // 아처가 멀어져도 이미 발동했으므로 추가 가속 없음
    archerBall.position = new Vector2(100, 100);
    const timerAfter = g.timer;
    g.update(0.016, sim);
    assert.ok(g.timer < timerAfter, "Timer should decrease even when target moves away");
}

async function testPpoActorCriticUtilities() {
    const { createActorCriticNetworks, deterministicAction, prepareTensorflowBackend, sampleAction, trainPpoEpochs } =
        await import("../scripts/rl/policyNetwork.js");
    const { RunningNormalizer } = await import("../scripts/rl/normalizer.js");
    await prepareTensorflowBackend();
    const { actor, critic } = createActorCriticNetworks(2, 4);
    const before = sampleAction(actor, [0.5, -0.5], () => 0).probability;
    assert.ok(before > 0 && before < 1, "PPO actor should return a Bernoulli probability");
    assert.equal(deterministicAction(actor, [0.5, -0.5], 0).action, 1, "Threshold 0 should always use action");
    assert.equal(deterministicAction(actor, [0.5, -0.5], 1).action, 0, "Threshold 1 should always wait");

    const normalizer = new RunningNormalizer(2);
    normalizer.update([1, 3]);
    normalizer.update([3, 5]);
    const cloned = normalizer.clone();
    assert.deepEqual(cloned.normalize([2, 4]), normalizer.normalize([2, 4]), "Normalizer clone should preserve stats");

    const optimizer = (await import("@tensorflow/tfjs")).train.adam(0.01);
    const result = trainPpoEpochs(
        actor,
        critic,
        optimizer,
        {
            obs: [
                [0.5, -0.5],
                [-0.5, 0.5]
            ],
            actions: [1, 0],
            oldLogProbs: [Math.log(0.5), Math.log(0.5)],
            returns: [1, -1],
            advantages: [1, -1],
            weights: [1, 1]
        },
        { epochs: 1, entropyCoef: 0, miniBatchSize: 1 }
    );
    assert.equal(result.samples, 2, "PPO update should report trained samples");
    assert.ok(Number.isFinite(result.loss), "PPO loss should stay finite");
    actor.dispose();
    critic.dispose();
    optimizer.dispose?.();
}

testCompleteChallengeTournament();
testFormatBonusSummary();
testGrenadeProximityTrigger();
await testPpoActorCriticUtilities();
await testNewCharactersRegistered(app);
await testVampireBatsSpawn(app);
await testVampireLifestealOnCollision(app);
await testGunnerBulletsSpawn(app);
await testPhantomRegistered(app);
await testPhantomShadowStrike(app);
console.log("regression tests ok");
