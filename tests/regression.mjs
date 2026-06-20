import assert from "node:assert/strict";
import {
  PLAYER_STAT_POINTS,
  adjustStatAllocation,
  applyStatAllocation,
  createRandomStatAllocation,
  createTournamentRoster,
  formatStatAllocation,
  getSpentStatPoints
} from "../src/stat-allocation.js";

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
    app.roster.find((fighter) => fighter.id === "clone"),
    app.roster.find((fighter) => fighter.id === "orbit")
  ]);
  const [clone, opponent] = app.simulation.fighters;
  clone.position.x = 200;
  clone.position.y = 480;
  opponent.position.x = 640;
  opponent.position.y = 480;
  app.simulation.entities = [];
  clone.ability.timer = 0;
  clone.ability.update(0.016, opponent);
  const seeds = app.simulation.entities.filter((entity) => entity.constructor.name === "SeedOrb");
  assert.equal(seeds.length, 3, "Clone should launch three seeds");

  const angles = seeds
    .map((seed) => Math.atan2(seed.velocity.y, seed.velocity.x))
    .sort((a, b) => a - b);
  const gaps = angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0);
    return Math.round(((next - angle) * 180) / Math.PI);
  });
  assert.deepEqual(gaps, [120, 120, 120], "Clone seeds should spread at 120 degree intervals");

  seeds[0].position = opponent.position.clone();
  seeds[0].update(0.016, app.simulation);
  assert.ok(clone.dashState, "Clone should dash when any seed is collected");
  assert.equal(opponent.dashState, null, "The collector should not dash");
}

async function testEaterFeast(app) {
  await app.startMatch([
    app.roster.find((fighter) => fighter.id === "eater"),
    app.roster.find((fighter) => fighter.id === "archer")
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
  assert.ok(eater.ability.getRadiusScale() > 1.5, "Eater should grow during feast mode");
  eater.ability.feastTimer = 0;
  eater.ability.update(0.5, target);
  assert.ok(eater.ability.getRadiusScale() < 1.5, "Eater should smoothly shrink after feast mode");

  eater.ability.feastTimer = 1.2;
  eater.ability.hasEatenThisFeast = false;
  eater.ability.onCollision(target);
  assert.ok(target.swallowedState, "Eater should swallow on feast collision");

  app.simulation.update(0.8);
  assert.equal(target.swallowedState, null, "Eater should spit target back out");
  assert.ok(target.wallSlamState, "Spat target should receive wall slam state");
  assert.equal(target.forcedHeading, null, "Spit dash should allow wall bounce direction changes");
  assert.equal(Math.round(target.velocity.length()), target.baseSpeed * 2, "Spat target should launch at twice its base speed");
  assert.equal(target.speedBoost.showRing, false, "Spit dash should not draw the normal speed ring");
  const spinBefore = target.spinRotation;
  target.update(0.12, app.simulation);
  assert.ok(Math.abs(target.spinRotation - spinBefore) > 1, "Spat target face should spin while flying");
  const beforeHp = target.hp;
  target.velocity.x = Math.abs(target.velocity.x) || 500;
  target.position.x = app.simulation.width + target.radius + 5;
  app.simulation.keepInsideArena(target);
  assert.equal(beforeHp - target.hp, 8, "Wall bounce should deal wall slam damage");
  assert.ok(target.velocity.x < 0, "Wall bounce should reverse spat target direction");
  assert.ok(app.simulation.screenShake, "Wall slam should trigger screen shake");
  assert.ok(
    app.simulation.entities.filter((entity) => entity.constructor.name === "GravityParticle").length >= 20,
    "Wall slam should emit wall particles"
  );
}

async function testBerserkerMomentum(app) {
  await app.startMatch([
    app.roster.find((fighter) => fighter.id === "berserker"),
    app.roster.find((fighter) => fighter.id === "orbit")
  ]);
  const [berserker, opponent] = app.simulation.fighters;
  const initialSpeed = berserker.ability.getStatModifiers().speed;
  berserker.ability.update(7.5, opponent);
  const chargedSpeed = berserker.ability.getStatModifiers().speed;
  assert.ok(initialSpeed < 1, "Berserker should start slower than normal");
  assert.ok(chargedSpeed > 1.7, "Berserker should gain speed while avoiding collision");
  berserker.ability.onCollision(opponent);
  assert.equal(berserker.ability.getChargeProgress(), 0, "Berserker collision should reset momentum");
}

async function testFrostyDash(app) {
  await app.startMatch([
    app.roster.find((fighter) => fighter.id === "frosty"),
    app.roster.find((fighter) => fighter.id === "archer")
  ]);
  const [frosty, target] = app.simulation.fighters;
  frosty.position.x = 300;
  frosty.position.y = 480;
  target.position.x = 620;
  target.position.y = 480;
  frosty.ability.timer = 0;
  frosty.ability.update(0.016, target);
  assert.ok(frosty.dashState, "Frosty should enter dash state");
  assert.ok(
    Math.abs(frosty.forcedHeading.direction.length() - 1) < 0.001,
    "Frosty forced heading should remain a unit direction"
  );
  frosty.update(0.016, app.simulation);
  assert.ok(frosty.velocity.length() < 800, "Frosty dash velocity should stay bounded");

  frosty.position.x = 480;
  frosty.position.y = 480;
  target.position.x = 480 + frosty.radius + target.radius - 2;
  target.position.y = 480;
  const hpBefore = target.hp;
  app.simulation.handleCollision();
  assert.ok(target.hp < hpBefore, "Frosty collision should damage target");
  assert.ok(target.slowEffect, "Frosty collision should slow target");
  assert.equal(frosty.dashState, null, "Frosty dash should clear after impact");
}

async function testGrenadeAdaptiveFuse(app) {
  await app.startMatch([
    app.roster.find((fighter) => fighter.id === "grenade"),
    app.roster.find((fighter) => fighter.id === "orbit")
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
    app.roster.find((fighter) => fighter.id === "archer"),
    app.roster.find((fighter) => fighter.id === "orbit")
  ]);
  const [attacker, target] = app.simulation.fighters;
  target.takeDamage(10, attacker, "Test Hit");
  assert.ok(app.simulation.screenShake, "Taking damage should trigger screen shake");
  assert.ok(app.simulation.screenShake.strength >= 12, "Damage shake should be visible");
  assert.ok(app.simulation.screenShake.remaining >= 0.16, "Damage shake should last multiple frames");
}

async function testArrowBounceFacing(app) {
  await app.startMatch([
    app.roster.find((fighter) => fighter.id === "archer"),
    app.roster.find((fighter) => fighter.id === "orbit")
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
    app.roster.find((fighter) => fighter.id === "orbit"),
    app.roster.find((fighter) => fighter.id === "archer")
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
  ability.update(0.45, target);
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
  assert.ok(app.elements.playerPanel.innerHTML.includes("내 캐릭터"), "Player setup should render readable Korean title text");
  assert.ok(app.elements.playerPanel.innerHTML.includes("+10"), "Player setup should render touch-friendly large step buttons");

  const archer = app.roster.find((fighter) => fighter.id === "archer");
  let stepped = { hp: 0, damage: 0, speed: 0 };
  stepped = adjustStatAllocation(stepped, "hp", 10);
  stepped = adjustStatAllocation(stepped, "damage", 95);
  assert.deepEqual(stepped, { hp: 10, damage: 90, speed: 0 }, "Large stat steps should clamp to the remaining budget");
  stepped = adjustStatAllocation(stepped, "damage", -10);
  assert.equal(stepped.damage, 80, "Large negative stat steps should subtract multiple points");

  const allocation = { hp: 30, damage: 40, speed: 30 };
  const boosted = applyStatAllocation(archer, allocation, true);
  assert.equal(boosted.stats.hp, Number((archer.stats.hp * 1.3).toFixed(3)), "HP points should multiply base health");
  assert.equal(boosted.stats.damage, Number((archer.stats.damage * 1.4).toFixed(3)), "Damage points should multiply base damage");
  assert.equal(boosted.stats.speed, Number((archer.stats.speed * 1.3).toFixed(3)), "Speed points should multiply base speed");
  assert.equal("force" in boosted.stats, false, "Force should not exist as an unused gameplay stat");
  assert.equal(formatStatAllocation(allocation), "체력 +30% · 공격 +40% · 속도 +30%", "Allocation summary should show percentages instead of raw stats");
  assert.equal(boosted.stats.radius, archer.stats.radius, "Radius should stay character-specific");
  assert.equal(boosted.stats.mass, archer.stats.mass, "Mass should stay character-specific");

  const roster = createTournamentRoster(app.roster, archer.id, allocation, () => 0);
  assert.equal(roster.length, app.roster.length, "Tournament roster should keep every fighter");
  assert.ok(roster.every((fighter) => getSpentStatPoints(fighter.statAllocation) === PLAYER_STAT_POINTS), "Every fighter should receive the same stat budget");
}

const app = await loadModuleApp();
testStatAllocationRules(app);
await testCloneSeedDash(app);
await testEaterFeast(app);
await testBerserkerMomentum(app);
await testFrostyDash(app);
await testGrenadeAdaptiveFuse(app);
await testDamageShake(app);
await testArrowBounceFacing(app);
await testOrbitShardRecharge(app);
await testTournament(app);
console.log("regression tests ok");
