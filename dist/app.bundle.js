"use strict";

(() => {
// src/core.js


class Vector2 {
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }

      clone() {
        return new Vector2(this.x, this.y);
      }

      add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
      }

      subtract(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
      }

      scale(value) {
        this.x *= value;
        this.y *= value;
        return this;
      }

      length() {
        return Math.hypot(this.x, this.y);
      }

      normalize() {
        const size = this.length() || 1;
        this.x /= size;
        this.y /= size;
        return this;
      }

      static add(a, b) {
        return new Vector2(a.x + b.x, a.y + b.y);
      }

      static subtract(a, b) {
        return new Vector2(a.x - b.x, a.y - b.y);
      }

      static fromAngle(angle, radius) {
        return new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    }

class CombatEntity {
      constructor(position, velocity, radius) {
        this.position = position;
        this.velocity = velocity;
        this.radius = radius;
        this.isExpired = false;
      }

      update() {}
      draw() {}
    }

class TimedEffect {
      constructor(duration) {
        this.duration = duration;
        this.elapsed = 0;
      }

      get finished() {
        return this.elapsed >= this.duration;
      }

      tick(delta) {
        this.elapsed += delta;
      }
    }


// src/audio.js


class AudioEngine {
      constructor() {
        this.context = null;
        this.enabled = true;
        this.lastPlayed = new Map();
      }

      unlock() {
        if (!this.enabled) {
          return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          this.enabled = false;
          return;
        }

        if (!this.context) {
          this.context = new AudioContextClass();
        }

        if (this.context.state === "suspended") {
          this.context.resume();
        }
      }

      play(type, intensity = 1) {
        if (!this.enabled) {
          return;
        }

        this.unlock();
        if (!this.context) {
          return;
        }

        const now = this.context.currentTime;
        const throttleKey = type;
        const last = this.lastPlayed.get(throttleKey) ?? -1;
        const throttle = type === "hit" || type === "crash" ? 0.055 : 0.025;
        if (now - last < throttle) {
          return;
        }
        this.lastPlayed.set(throttleKey, now);

        const safeIntensity = Math.max(0.45, Math.min(1.8, intensity));
        const voices = {
          crash: () => this.playThud(96, 0.16, 0.13 * safeIntensity),
          hit: () => this.playZap(420, 0.08, 0.055 * safeIntensity),
          orbit: () => this.playZap(760, 0.12, 0.05 * safeIntensity),
          charge: () => this.playSweep(320, 920, 0.2, 0.04 * safeIntensity),
          chomp: () => {
            this.playThud(130, 0.12, 0.12 * safeIntensity);
            this.playZap(180, 0.07, 0.045 * safeIntensity);
          },
          dash: () => this.playSweep(180, 620, 0.15, 0.045 * safeIntensity),
          spit: () => this.playSweep(120, 520, 0.18, 0.055 * safeIntensity),
          shoot: () => this.playZap(520, 0.1, 0.052 * safeIntensity),
          seed: () => {
            this.playZap(360, 0.075, 0.035 * safeIntensity);
            this.playZap(520, 0.09, 0.025 * safeIntensity);
          },
          toss: () => this.playSweep(240, 120, 0.18, 0.04 * safeIntensity),
          rage: () => {
            this.playThud(72, 0.22, 0.1 * safeIntensity);
            this.playNoiseBurst(0.18, 0.055 * safeIntensity);
          },
          wall: () => this.playThud(116, 0.1, 0.08 * safeIntensity),
          explosion: () => this.playNoiseBurst(0.38, 0.16 * safeIntensity),
          ko: () => {
            this.playNoiseBurst(0.58, 0.22 * safeIntensity);
            this.playThud(58, 0.34, 0.18 * safeIntensity);
          },
          start: () => this.playSweep(260, 760, 0.22, 0.045),
          overtime: () => this.playSweep(620, 180, 0.28, 0.055)
        };

        voices[type]?.();
      }

      createGain(volume, duration) {
        const gain = this.context.createGain();
        const now = this.context.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        gain.connect(this.context.destination);
        return gain;
      }

      playThud(frequency, duration, volume) {
        const oscillator = this.context.createOscillator();
        const gain = this.createGain(volume, duration);
        const now = this.context.currentTime;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * 0.46), now + duration);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      }

      playZap(frequency, duration, volume) {
        const oscillator = this.context.createOscillator();
        const gain = this.createGain(volume, duration);
        const now = this.context.currentTime;
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.8, now + duration);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      }

      playSweep(from, to, duration, volume) {
        const oscillator = this.context.createOscillator();
        const gain = this.createGain(volume, duration);
        const now = this.context.currentTime;
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      }

      playNoiseBurst(duration, volume) {
        const sampleRate = this.context.sampleRate;
        const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < data.length; index += 1) {
          const fade = 1 - index / data.length;
          data[index] = (Math.random() * 2 - 1) * fade * fade;
        }

        const source = this.context.createBufferSource();
        const gain = this.createGain(volume, duration);
        source.buffer = buffer;
        source.connect(gain);
        source.start(this.context.currentTime);
      }
    }


// src/effects.js

class VisualBurst extends CombatEntity {
      constructor(position, color, radiusGrowth, life) {
        super(position, new Vector2(), 10);
        this.color = color;
        this.radiusGrowth = radiusGrowth;
        this.life = life;
        this.maxLife = life;
      }

      update(delta) {
        this.life -= delta;
        this.radius += this.radiusGrowth * delta;
        if (this.life <= 0) {
          this.isExpired = true;
        }
      }

      draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

class OrbitHitEffect extends CombatEntity {
      constructor(shardPosition, targetPosition, color) {
        super(targetPosition, new Vector2(), 0);
        this.shardPosition = shardPosition;
        this.targetPosition = targetPosition;
        this.color = color;
        this.life = 0.24;
        this.maxLife = this.life;
      }

      update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
          this.isExpired = true;
        }
      }

      draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 7;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.shardPosition.x, this.shardPosition.y);
        ctx.lineTo(this.targetPosition.x, this.targetPosition.y);
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.82;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.targetPosition.x, this.targetPosition.y, 18 + (1 - alpha) * 48, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = this.color;
        for (let index = 0; index < 6; index += 1) {
          const angle = (Math.PI * 2 * index) / 6;
          const distance = 22 + (1 - alpha) * 36;
          ctx.save();
          ctx.translate(
            this.targetPosition.x + Math.cos(angle) * distance,
            this.targetPosition.y + Math.sin(angle) * distance
          );
          ctx.rotate(angle);
          ctx.fillRect(-7, -3, 14, 6);
          ctx.restore();
        }
        ctx.restore();
      }
    }

class DeathBurstEffect extends CombatEntity {
      constructor(position, color) {
        super(position, new Vector2(), 0);
        this.color = color;
        this.life = 0.78;
        this.maxLife = this.life;
      }

      update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
          this.isExpired = true;
        }
      }

      draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 8;
        ctx.shadowBlur = 28;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 26 + progress * 110, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 10 + progress * 72, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        for (let index = 0; index < 10; index += 1) {
          const angle = (Math.PI * 2 * index) / 10 + progress * 0.7;
          const distance = 34 + progress * 82;
          ctx.save();
          ctx.translate(
            this.position.x + Math.cos(angle) * distance,
            this.position.y + Math.sin(angle) * distance
          );
          ctx.rotate(angle + progress * Math.PI);
          ctx.fillRect(-10, -4, 20, 8);
          ctx.restore();
        }
        ctx.restore();
      }
    }

class GravityParticle extends CombatEntity {
      constructor(position, velocity, options = {}) {
        super(position, velocity, options.radius ?? 4);
        this.color = options.color ?? "#ffffff";
        this.gravity = options.gravity ?? 820;
        this.bounce = options.bounce ?? 0.22;
        this.drag = options.drag ?? 0.986;
        this.floorFriction = options.floorFriction ?? 0.9;
        this.life = options.life ?? 1.6;
        this.maxLife = this.life;
        this.settled = false;
        this.settleDelay = options.settleDelay ?? 0.65;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 12;
        this.width = this.radius * (1.4 + Math.random() * 0.9);
        this.height = this.radius * (0.9 + Math.random() * 0.8);
      }

      update(delta, simulation) {
        this.life -= delta;
        if (this.life <= 0) {
          this.isExpired = true;
          return;
        }

        if (this.settled) {
          this.settleDelay -= delta;
          if (this.settleDelay <= 0) {
            this.life -= delta * 3.2;
          }
          return;
        }

        this.velocity.y += this.gravity * delta;
        this.velocity.x *= this.drag;
        this.rotation += this.spin * delta;
        this.position.add(this.velocity.clone().scale(delta));

        const left = 24 + this.radius;
        const right = simulation.width - 24 - this.radius;
        const floor = simulation.height - 24 - this.radius;

        if (this.position.x <= left) {
          this.position.x = left;
          this.velocity.x = Math.abs(this.velocity.x) * 0.72;
        } else if (this.position.x >= right) {
          this.position.x = right;
          this.velocity.x = -Math.abs(this.velocity.x) * 0.72;
        }

        if (this.position.y >= floor) {
          this.position.y = floor;
          if (Math.abs(this.velocity.y) > 42) {
            this.velocity.y = -Math.abs(this.velocity.y) * this.bounce;
            this.velocity.x *= this.floorFriction;
          } else {
            this.velocity.x *= 0.35;
            this.velocity.y = 0;
            this.settled = true;
          }
        }
      }

      draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = this.settled ? alpha * 0.46 : alpha * 0.85;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.settled ? 0 : 10;
        ctx.shadowColor = this.color;
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.settled ? 0 : this.rotation);
        const width = this.settled ? this.width * 1.45 : this.width;
        const height = this.settled ? Math.max(2, this.height * 0.42) : this.height;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.globalAlpha = this.settled ? alpha * 0.18 : alpha * 0.36;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-width / 2, -height / 2, width, Math.max(1, height * 0.24));
        ctx.restore();
      }
    }

class SlashTrail extends CombatEntity {
      constructor(from, to, color) {
        super(from, new Vector2(), 0);
        this.from = from;
        this.to = to;
        this.color = color;
        this.life = 0.18;
      }

      update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
          this.isExpired = true;
        }
      }

      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / 0.18);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 10;
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.from.x, this.from.y);
        ctx.lineTo(this.to.x, this.to.y);
        ctx.stroke();
        ctx.restore();
      }
    }


// src/abilities/Ability.js


class Ability {
      constructor(owner, simulation) {
        this.owner = owner;
        this.simulation = simulation;
      }

      update() {}
      onCollision() {}
      onDamageTaken() {}
      getRadiusScale() {
        return 1;
      }
      getStatModifiers() {
        return { speed: 1, damage: 1, defense: 1, impact: 1 };
      }
      getUiState() {
        return { label: "Passive", progress: 1 };
      }
    }


// src/abilities/ArcherAbility.js

class ArcherAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldown = 3.9;
        this.timer = 1.2;
      }

      update(delta, target) {
        this.timer -= delta;
        if (this.timer <= 0 && target) {
          this.timer = this.cooldown;
          const direction = Vector2.subtract(target.position, this.owner.position).normalize();
          const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + 24));
          this.simulation.spawnArrow(this.owner, start, direction.scale(520));
          this.simulation.playSound("shoot");
          this.simulation.spawnSlash(this.owner.position.clone(), start.clone(), this.owner.color);
          this.simulation.addLog(`${this.owner.name} fires a piercing arrow.`);
        }
      }

      getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: 1, impact: 1 };
      }

      getUiState() {
        return { label: "Arrow", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
      }
    }


// src/abilities/OrbitAbility.js

class OrbitAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.angle = Math.random() * Math.PI * 2;
        this.hitCooldown = 0;
        this.shardCount = 3;
        this.shards = Array.from({ length: this.shardCount }, () => ({
          active: true,
          refilling: false,
          refillProgress: 1
        }));
        this.orbitRadius = 44;
        this.shardRadius = 11;
        this.baseSpinSpeed = 4.2;
        this.spinBurstMultiplier = 3.15;
        this.spinBurstDuration = 0.85;
        this.spinBurst = 0;
        this.rechargeDelay = 0;
        this.rechargeDuration = 0.42;
        this.rechargeGap = 0.16;
        this.rechargeGapTimer = 0;
      }

      update(delta, target) {
        if (this.spinBurst > 0) {
          this.spinBurst = Math.max(0, this.spinBurst - delta);
        }

        const spinMultiplier = this.spinBurst > 0 ? this.spinBurstMultiplier : 1;
        this.angle += delta * this.baseSpinSpeed * spinMultiplier;
        this.hitCooldown = Math.max(0, this.hitCooldown - delta);
        this.updateRecharge(delta);

        if (!target) {
          return;
        }

        const hitShard = this.getActiveShardEntries().find(({ position }) => Vector2.subtract(position, target.position).length() <= target.radius + this.shardRadius);
        if (hitShard && this.hitCooldown <= 0) {
          const repelDirection = Vector2.subtract(target.position, hitShard.position).normalize();
          target.takeDamage(8, this.owner, "Orbit Shard");
          target.velocity = repelDirection.scale(Math.max(target.baseSpeed * 1.35, target.velocity.length()));
          this.consumeShard(hitShard.index);
          this.hitCooldown = 0.32;
          this.simulation.spawnOrbitHit(hitShard.position.clone(), target.position.clone(), this.owner.color);
          this.simulation.playSound("orbit");
          this.simulation.addSparkBurst(target.position.clone(), this.owner.color);
          this.simulation.spawnParticleBurst(hitShard.position.clone(), this.owner.color, { count: 20, speed: 250, radiusMin: 2, radiusMax: 5, upBias: 20 });
          this.simulation.addLog(`${this.owner.name}'s orbit shard breaks after clipping ${target.name}.`);
        }
      }

      consumeShard(index) {
        const shard = this.shards[index];
        if (!shard || !shard.active) {
          return;
        }

        shard.active = false;
        shard.refilling = false;
        shard.refillProgress = 0;
        this.spinBurst = this.spinBurstDuration;
        this.rechargeDelay = this.getActiveShardCount() === 0 ? 0 : this.spinBurstDuration;
        this.rechargeGapTimer = 0;
        this.simulation.playSound("charge", 0.9);
      }

      updateRecharge(delta) {
        if (this.getMissingShardCount() === 0) {
          return;
        }

        if (this.getActiveShardCount() === 0 && !this.getRefillingShard()) {
          this.rechargeDelay = 0;
          this.rechargeGapTimer = 0;
        }

        if (this.rechargeDelay > 0) {
          this.rechargeDelay = Math.max(0, this.rechargeDelay - delta);
          return;
        }

        const refilling = this.getRefillingShard();
        if (refilling) {
          const shard = this.shards[refilling.index];
          shard.refillProgress = Math.min(1, shard.refillProgress + delta / this.rechargeDuration);
          if (shard.refillProgress >= 1) {
            shard.active = true;
            shard.refilling = false;
            this.rechargeGapTimer = this.rechargeGap;
            this.simulation.spawnPulse(this.getOrbitPosition(refilling.index), this.owner.color);
            this.simulation.playSound("seed", 0.75);
          }
          return;
        }

        if (this.rechargeGapTimer > 0) {
          this.rechargeGapTimer = Math.max(0, this.rechargeGapTimer - delta);
          return;
        }

        const nextIndex = this.shards.findIndex((shard) => !shard.active && !shard.refilling);
        if (nextIndex >= 0) {
          this.shards[nextIndex].refilling = true;
          this.shards[nextIndex].refillProgress = 0.01;
          this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
            count: 8,
            speed: 120,
            radiusMin: 2,
            radiusMax: 4,
            upBias: 8
          });
        }
      }

      getActiveShardCount() {
        return this.shards.filter((shard) => shard.active).length;
      }

      getMissingShardCount() {
        return this.shards.filter((shard) => !shard.active).length;
      }

      getRefillingShard() {
        const index = this.shards.findIndex((shard) => shard.refilling);
        return index >= 0 ? { index, shard: this.shards[index] } : null;
      }

      getOrbitPosition(index) {
        const angle = this.angle + (Math.PI * 2 * index) / this.shardCount;
        return Vector2.add(this.owner.position, Vector2.fromAngle(angle, this.owner.radius + this.orbitRadius));
      }

      getActiveShardEntries() {
        return this.shards
          .map((shard, index) => ({ index, shard, position: this.getOrbitPosition(index) }))
          .filter(({ shard }) => shard.active);
      }

      getShardPositions() {
        return this.getActiveShardEntries().map(({ position }) => position);
      }

      getShardRenderStates() {
        return this.shards
          .map((shard, index) => {
            if (!shard.active && !shard.refilling) {
              return null;
            }

            const orbitPosition = this.getOrbitPosition(index);
            if (shard.active) {
              return {
                index,
                active: true,
                refilling: false,
                progress: 1,
                position: orbitPosition
              };
            }

            const progress = this.easeOutCubic(shard.refillProgress);
            return {
              index,
              active: false,
              refilling: true,
              progress,
              position: Vector2.add(
                this.owner.position.clone().scale(1 - progress),
                orbitPosition.clone().scale(progress)
              )
            };
          })
          .filter(Boolean);
      }

      easeOutCubic(value) {
        const clamped = Math.max(0, Math.min(1, value));
        return 1 - Math.pow(1 - clamped, 3);
      }

      getUiState() {
        if (this.spinBurst > 0) {
          return { label: "Fast Orbit", progress: Math.max(0, Math.min(1, this.spinBurst / this.spinBurstDuration)) };
        }
        if (this.getMissingShardCount() > 0) {
          return { label: `Refill ${this.getActiveShardCount()}/${this.shardCount}`, progress: this.getActiveShardCount() / this.shardCount };
        }
        return { label: "Orbit Ready", progress: 1 };
      }
    }


// src/abilities/CloneAbility.js

class CloneAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldown = 6.4;
        this.timer = 1.9;
      }

      update(delta, target) {
        this.timer -= delta;
        if (this.timer > 0 || !target) {
          return;
        }

        this.timer = this.cooldown;
        const baseAngle = Math.random() * Math.PI * 2;
        const speed = 250;
        for (let index = 0; index < 3; index += 1) {
          const angle = baseAngle + (Math.PI * 2 * index) / 3;
          const direction = Vector2.fromAngle(angle, 1);
          const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + 20));
          this.simulation.spawnSeedOrb(this.owner, start, direction.scale(speed));
        }
        this.simulation.playSound("seed");
        this.simulation.addLog(`${this.owner.name} launches three dash seeds.`);
      }

      getUiState() {
        return { label: "Seeds", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
      }
    }


// src/abilities/GrenadeAbility.js

class GrenadeAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldown = 4.7;
        this.timer = 1.5;
        this.missStreak = 0;
        this.baseFuse = 1.08;
        this.minFuse = 0.48;
      }

      update(delta, target) {
        this.timer -= delta;
        if (this.timer > 0 || !target) {
          return;
        }

        this.timer = this.cooldown;
        const prediction = Vector2.add(target.position.clone(), target.velocity.clone().scale(0.48));
        this.simulation.spawnGrenade(this.owner, prediction, this.getFuseTime());
        this.simulation.playSound("toss");
        this.simulation.addLog(`${this.owner.name} tosses a grenade into the arena.`);
      }

      getFuseTime() {
        return Math.max(this.minFuse, this.baseFuse - this.missStreak * 0.18);
      }

      onGrenadeResult(hit) {
        if (hit) {
          this.missStreak = 0;
          return;
        }

        this.missStreak = Math.min(4, this.missStreak + 1);
        this.simulation.addLog(`${this.owner.name}'s next grenade fuse shortens.`);
      }

      getUiState() {
        return {
          label: this.missStreak > 0 ? `Fuse x${this.missStreak}` : "Grenade",
          progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
      }
    }


// src/abilities/FrostySwordAbility.js

class FrostySwordAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldown = 6.2;
        this.timer = 3.1;
      }

      update(delta, target) {
        this.timer -= delta;
        if (this.timer > 0 || !target) {
          return;
        }

        this.timer = this.cooldown;
        const direction = Vector2.subtract(target.position, this.owner.position).normalize();
        this.owner.startDash(direction, {
          multiplier: 1.72,
          color: this.owner.color,
          collisionDamage: 10,
          collisionLabel: "Frost Slash",
          collisionSlow: { duration: 0.9, amount: 0.76 },
          untilImpact: true,
          untilWall: true,
          maxDuration: 1.4
        });
        this.simulation.playSound("dash", 1.15);
        this.simulation.spawnSlash(
          this.owner.position.clone(),
          Vector2.add(this.owner.position, direction.clone().scale(120)),
          this.owner.color
        );
        this.simulation.addLog(`${this.owner.name} lines up a frost dash.`);
      }

      getUiState() {
        if (this.owner.dashState) {
          return { label: "Dash", progress: 1 };
        }
        return { label: "Slash", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
      }
    }


// src/abilities/BerserkerAbility.js

class BerserkerAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.particleTimer = 0;
        this.timeWithoutCollision = 0;
        this.maxChargeTime = 7.0;
      }

      update(delta) {
        this.timeWithoutCollision = Math.min(this.maxChargeTime, this.timeWithoutCollision + delta);
        if (this.getChargeProgress() > 0.22) {
          this.particleTimer -= delta;
          if (this.particleTimer <= 0) {
            this.particleTimer = 0.15 - this.getChargeProgress() * 0.07;
            this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
              count: 1 + Math.floor(this.getChargeProgress() * 3),
              speed: 90 + this.getChargeProgress() * 90,
              radiusMin: 2,
              radiusMax: 4,
              upBias: 120,
              gravity: 900,
              life: 1.1
            });
          }
        }
      }

      onCollision() {
        if (this.getChargeProgress() > 0.45) {
          this.simulation.playSound("rage", 0.75);
          this.simulation.addLog(`${this.owner.name}'s momentum resets on impact.`);
        }
        this.timeWithoutCollision = 0;
      }

      getChargeProgress() {
        return Math.max(0, Math.min(1, this.timeWithoutCollision / this.maxChargeTime));
      }

      isCharged() {
        return this.getChargeProgress() > 0.22;
      }

      getStatModifiers() {
        const charge = this.getChargeProgress();
        return {
          speed: 0.78 + charge * 1.05,
          damage: 0.96 + charge * 0.34,
          defense: 1,
          impact: 0.9 + charge * 0.62
        };
      }

      getUiState() {
        return { label: "Momentum", progress: Math.max(0.08, this.getChargeProgress()) };
      }
    }


// src/abilities/EaterAbility.js

class EaterAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldown = 7.2;
        this.timer = 2.4;
        this.feastDuration = 3.3;
        this.feastTimer = 0;
        this.feastElapsed = 0;
        this.radiusScale = 1;
        this.swallowedTarget = null;
        this.swallowTimer = 0;
        this.spitDirection = new Vector2(1, 0);
        this.hasEatenThisFeast = false;
      }

      update(delta, target) {
        this.timer -= delta;
        this.updateRadiusScale(delta);

        if (this.swallowedTarget) {
          this.swallowTimer -= delta;
          this.swallowedTarget.position = this.owner.position.clone();
          if (this.swallowTimer <= 0 || this.swallowedTarget.isDefeated) {
            this.releaseSwallowed();
          }
        }

        if (this.feastTimer > 0) {
          this.feastTimer = Math.max(0, this.feastTimer - delta);
          this.feastElapsed = Math.min(this.feastDuration, this.feastElapsed + delta);
          if (this.feastTimer > 0 && !this.swallowedTarget && Math.random() < delta * 8) {
            this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
              count: 1,
              speed: 80,
              radiusMin: 3,
              radiusMax: 5,
              upBias: 70,
              gravity: 720,
              life: 0.8
            });
          }
          return;
        }

        if (this.timer <= 0 && target) {
          this.timer = this.cooldown;
          this.feastTimer = this.feastDuration;
          this.feastElapsed = 0;
          this.hasEatenThisFeast = false;
          this.simulation.playSound("chomp", 0.8);
          this.simulation.spawnPulse(this.owner.position.clone(), this.owner.color);
          this.simulation.addLog(`${this.owner.name} enters feast mode.`);
        }
      }

      onCollision(target) {
        if (!this.isFeasting() || this.hasEatenThisFeast || this.swallowedTarget || target.swallowedState || target.isDefeated) {
          return;
        }

        this.hasEatenThisFeast = true;
        this.feastTimer = Math.min(this.feastTimer, 0.28);
        this.swallowedTarget = target;
        this.swallowTimer = 0.72;
        this.spitDirection =
          this.owner.velocity.length() > 0
            ? this.owner.velocity.clone().normalize()
            : Vector2.subtract(target.position, this.owner.position).normalize();

        target.swallowedState = { owner: this.owner };
        target.clearDash();
        target.velocity = new Vector2();
        target.trail = [];
        this.simulation.playSound("chomp", 1.25);
        this.simulation.spawnParticleBurst(target.position.clone(), this.owner.color, {
          count: 30,
          speed: 230,
          radiusMin: 3,
          radiusMax: 6,
          upBias: 30,
          gravity: 940,
          life: 1.35
        });
        this.simulation.addLog(`${this.owner.name} swallows ${target.name}.`);
      }

      releaseSwallowed() {
        const target = this.swallowedTarget;
        if (!target) {
          return;
        }

        if (target.isDefeated) {
          target.swallowedState = null;
          this.swallowedTarget = null;
          return;
        }

        const direction = this.spitDirection.clone().normalize();
        target.swallowedState = null;
        target.position = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + target.radius + 10));
        target.startDash(direction, {
          multiplier: 2,
          speedOverride: target.baseSpeed * 2,
          color: target.color,
          collisionDamage: 0,
          collisionLabel: "Spit Dash",
          lockHeading: false,
          showSpeedRing: false,
          maxDuration: 2.45
        });
        target.wallSlamState = {
          effect: new TimedEffect(2.45),
          source: this.owner,
          damage: 8,
          cooldown: 0
        };
        this.simulation.keepInsideArena(target);
        this.simulation.playSound("spit", 1.2);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), this.owner.color);
        this.simulation.addSparkBurst(target.position.clone(), this.owner.color);
        this.simulation.addLog(`${this.owner.name} spits ${target.name} into the walls.`);
        this.swallowedTarget = null;
      }

      isFeasting() {
        return this.feastTimer > 0 && !this.hasEatenThisFeast;
      }

      getMouthTarget() {
        return this.simulation.getOpponent(this.owner);
      }

      updateRadiusScale(delta) {
        const activeProgress =
          this.feastTimer > 0
            ? Math.min(1, this.feastElapsed / this.feastDuration)
            : 0;
        const targetScale = this.feastTimer > 0 ? 1 + activeProgress : 1;
        const smoothing = 1 - Math.exp(-delta * (targetScale > this.radiusScale ? 4.8 : 7.2));
        this.radiusScale += (targetScale - this.radiusScale) * smoothing;
        if (Math.abs(this.radiusScale - 1) < 0.01 && targetScale === 1) {
          this.radiusScale = 1;
        }
      }

      getRadiusScale() {
        return Math.max(1, Math.min(2, this.radiusScale));
      }

      getUiState() {
        if (this.swallowedTarget) {
          return { label: "Eating", progress: Math.max(0, Math.min(1, this.swallowTimer / 0.72)) };
        }
        if (this.feastTimer > 0) {
          return { label: "Feast", progress: Math.max(0, Math.min(1, this.feastTimer / this.feastDuration)) };
        }
        return { label: "Feast", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
      }
    }


// src/entities.js

class SeedOrb extends CombatEntity {
      constructor(owner, position, velocity) {
        super(position, velocity, 14);
        this.owner = owner;
        this.life = 4.6;
      }

      update(delta, simulation) {
        this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);
        if (this.life <= 0) {
          this.isExpired = true;
        }

        for (const fighter of simulation.fighters.filter((candidate) => !candidate.isDefeated)) {
          const distance = Vector2.subtract(this.position, fighter.position).length();
          if (distance > this.radius + fighter.radius) {
            continue;
          }

          const target = simulation.getOpponent(this.owner);
          const dashDirection = target
            ? Vector2.subtract(target.position, this.owner.position).normalize()
            : this.velocity.clone().normalize();
          this.owner.startDash(dashDirection, {
            multiplier: 2.05,
            color: this.owner.color,
            collisionDamage: 13,
            collisionLabel: "Seed Dash",
            untilImpact: true,
            untilWall: true,
            maxDuration: 1.55
          });
          simulation.spawnSlash(
            this.owner.position.clone(),
            Vector2.add(this.owner.position, dashDirection.clone().scale(150)),
            this.owner.color
          );
          simulation.spawnPulse(this.position.clone(), this.owner.color);
          simulation.playSound("dash");
          simulation.addLog(`${fighter.name} catches a seed and triggers ${this.owner.name}'s dash.`);

          simulation.addSparkBurst(this.position.clone(), this.owner.color);
          this.isExpired = true;
          break;
        }
      }

      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.84;
        ctx.fillStyle = this.owner.color;
        ctx.shadowBlur = 22;
        ctx.shadowColor = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    }

class ArrowProjectile extends CombatEntity {
      constructor(owner, position, velocity) {
        super(position, velocity, 8);
        this.owner = owner;
        this.life = 1.55;
        this.angle = 0;
        this.syncFacingToVelocity();
      }

      syncFacingToVelocity() {
        if (this.velocity.length() > 0) {
          this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        }
      }

      update(delta, simulation) {
        this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);
        this.syncFacingToVelocity();
        if (this.life <= 0) {
          this.isExpired = true;
        }

        const target = simulation.getOpponent(this.owner);
        if (!target || target.isDefeated) {
          return;
        }

        const distance = Vector2.subtract(this.position, target.position).length();
        if (distance <= target.radius + this.radius) {
          target.takeDamage(14, this.owner, "Arrow Shot");
          target.velocity.add(this.velocity.clone().normalize().scale(160));
          simulation.playSound("hit");
          simulation.spawnSlash(
            this.position.clone(),
            Vector2.add(this.position, this.velocity.clone().normalize().scale(70)),
            this.owner.color
          );
          simulation.addSparkBurst(this.position.clone(), this.owner.color);
          simulation.addLog(`${this.owner.name}'s arrow pierces ${target.name}.`);
          this.isExpired = true;
        }
      }

      draw(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.owner.color;
        ctx.shadowBlur = 14;
        ctx.shadowColor = this.owner.color;
        ctx.fillRect(-20, -4, 40, 8);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(6, -2, 14, 4);
        ctx.restore();
      }
    }

class Grenade extends CombatEntity {
      constructor(owner, targetPosition, fuseTime = 1.08) {
        const start = owner.position.clone();
        const safeFuse = Math.max(0.32, fuseTime);
        const drift = Vector2.subtract(targetPosition, start).scale(1 / safeFuse);
        super(start, drift, 12);
        this.owner = owner;
        this.targetPosition = targetPosition;
        this.timer = safeFuse;
        this.maxTimer = this.timer;
        this.explosionRadius = 150;
        this.innerRadius = 62;
      }

      update(delta, simulation) {
        this.timer -= delta;
        const travelDelta = Math.min(delta, Math.max(this.timer, 0) + delta);
        this.position.add(this.velocity.clone().scale(travelDelta));

        if (this.timer > 0) {
          return;
        }

        const target = simulation.getOpponent(this.owner);
        let hit = false;
        if (target && !target.isDefeated) {
          const distance = Vector2.subtract(this.position, target.position).length();
          if (distance <= this.explosionRadius) {
            hit = true;
            const edgeProgress = Math.max(0, Math.min(1, (distance - this.innerRadius) / (this.explosionRadius - this.innerRadius)));
            const damage = 22 - edgeProgress * 11;
            const knockback = 350 - edgeProgress * 140;
            target.takeDamage(damage, this.owner, "Grenade");
            target.velocity.add(Vector2.subtract(target.position, this.position).normalize().scale(knockback));
          }
        }

        simulation.spawnExplosion(this.position.clone(), this.owner.color);
        simulation.playSound("explosion");
        this.owner.ability?.onGrenadeResult?.(hit);
        simulation.addLog(`${this.owner.name}'s grenade explodes.`);
        this.isExpired = true;
      }

      draw(ctx) {
        const charge = 1 - Math.max(0, this.timer / this.maxTimer);
        ctx.save();
        ctx.globalAlpha = 0.16 + charge * 0.22;
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.explosionRadius * (0.72 + charge * 0.28), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 1;
        ctx.fillStyle = this.owner.color;
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

class BattleBall {
      constructor(spec, position) {
        this.id = spec.id;
        this.name = spec.name;
        this.title = spec.title;
        this.description = spec.description;
        this.color = spec.color;
        this.face = spec.face ?? spec.id;
        this.maxHp = spec.stats.hp;
        this.hp = spec.stats.hp;
        this.baseDamage = spec.stats.damage;
        this.baseSpeed = spec.stats.speed;
        this.baseForce = spec.stats.force;
        this.baseRadius = spec.stats.radius;
        this.radius = spec.stats.radius;
        this.mass = spec.stats.mass;
        this.position = position;
        this.velocity = Vector2.fromAngle(Math.random() * Math.PI * 2, 120 + Math.random() * 90);
        this.slowEffect = null;
        this.speedBoost = null;
        this.forcedHeading = null;
        this.dashState = null;
        this.swallowedState = null;
        this.wallSlamState = null;
        this.flags = {};
        this.ability = null;
        this.isDefeated = false;
        this.isDestroyed = false;
        this.trail = [];
        this.trailTimer = 0;
        this.spinRotation = 0;
      }

      bindAbility(ability) {
        this.ability = ability;
      }

      getStatModifiers() {
        return this.ability ? this.ability.getStatModifiers() : { speed: 1, damage: 1, defense: 1, impact: 1 };
      }

      setSpeedBoost(duration, multiplier, color = this.color) {
        this.speedBoost = { effect: new TimedEffect(duration), multiplier, color };
      }

      forceHeading(direction, duration) {
        this.forcedHeading = { effect: new TimedEffect(duration), direction: direction.clone().normalize() };
      }

      startDash(direction, config = {}) {
        const duration = config.maxDuration ?? 1.4;
        const normalized = direction.clone().normalize();
        this.dashState = {
          color: config.color ?? this.color,
          multiplier: config.multiplier ?? 1.8,
          speedOverride: config.speedOverride ?? null,
          collisionDamage: config.collisionDamage ?? 0,
          collisionLabel: config.collisionLabel ?? "Dash",
          collisionSlow: config.collisionSlow ?? null,
          untilImpact: Boolean(config.untilImpact),
          untilWall: Boolean(config.untilWall),
          effect: new TimedEffect(duration)
        };
        this.forcedHeading = config.lockHeading === false ? null : { effect: new TimedEffect(duration), direction: normalized.clone() };
        const dashSpeed = this.dashState.speedOverride ?? this.baseSpeed * this.dashState.multiplier;
        this.velocity = normalized.clone().scale(dashSpeed);
        this.speedBoost = {
          effect: new TimedEffect(duration),
          multiplier: this.dashState.multiplier,
          color: this.dashState.color,
          speedOverride: this.dashState.speedOverride,
          showRing: config.showSpeedRing !== false
        };
      }

      clearDash() {
        this.dashState = null;
        this.forcedHeading = null;
        this.speedBoost = null;
      }

      freezeForResult() {
        this.velocity = new Vector2();
        this.clearDash();
        this.slowEffect = null;
        this.swallowedState = null;
        this.wallSlamState = null;
        this.trail = [];
      }

      destroyForResult() {
        this.freezeForResult();
        this.isDefeated = true;
        this.isDestroyed = true;
      }

      heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
      }

      getAbilityUiState() {
        return this.ability?.getUiState?.() ?? { label: "Passive", progress: 1 };
      }

      update(delta, simulation) {
        if (this.isDefeated) {
          return;
        }

        if (this.swallowedState) {
          this.position = this.swallowedState.owner.position.clone();
          this.velocity = new Vector2();
          return;
        }

        const target = simulation.getOpponent(this);

        if (this.slowEffect) {
          this.slowEffect.tick(delta);
          if (this.slowEffect.finished) {
            this.slowEffect = null;
          }
        }

        if (this.speedBoost) {
          this.speedBoost.effect.tick(delta);
          if (this.speedBoost.effect.finished) {
            this.speedBoost = null;
          }
        }

        if (this.forcedHeading) {
          this.forcedHeading.effect.tick(delta);
          if (this.forcedHeading.effect.finished) {
            this.forcedHeading = null;
          }
        }

        if (this.dashState) {
          this.dashState.effect.tick(delta);
          if (this.dashState.effect.finished) {
            this.clearDash();
          }
        }

        if (this.wallSlamState) {
          this.wallSlamState.effect.tick(delta);
          this.wallSlamState.cooldown = Math.max(0, this.wallSlamState.cooldown - delta);
          const spinDirection = this.velocity.x >= 0 ? 1 : -1;
          this.spinRotation += spinDirection * Math.max(8, this.velocity.length() / Math.max(1, this.radius)) * delta * 1.55;
          if (this.wallSlamState.effect.finished) {
            this.wallSlamState = null;
          }
        }

        this.ability?.update(delta, target);
        const radiusScale = this.ability?.getRadiusScale?.() ?? 1;
        this.radius = this.baseRadius * radiusScale;
        const modifiers = this.getStatModifiers();
        const slowMultiplier = this.slowEffect ? this.slowEffect.amount : 1;
        const boostMultiplier = this.speedBoost ? this.speedBoost.multiplier : 1;
        const currentDirection =
          this.velocity.length() > 0
            ? this.velocity.clone().normalize()
            : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const direction = this.forcedHeading ? this.forcedHeading.direction.clone() : currentDirection;

        const speedLimit = this.dashState?.speedOverride ?? this.speedBoost?.speedOverride ?? this.baseSpeed * modifiers.speed * slowMultiplier * boostMultiplier * simulation.getSpeedMultiplier();
        this.velocity = direction.scale(speedLimit);

        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepInsideArena(this);

        this.trailTimer -= delta;
        if (this.trailTimer <= 0) {
          this.trailTimer = 0.04;
          this.trail.unshift({
            position: this.position.clone(),
            radius: this.radius,
            alpha: this.speedBoost ? 0.34 : 0.18
          });
          this.trail = this.trail.slice(0, this.speedBoost ? 12 : 7);
        }
        this.trail.forEach((item) => {
          item.alpha *= 0.88;
          item.radius *= 0.992;
        });
        this.trail = this.trail.filter((item) => item.alpha > 0.03);
      }

      applySlow(duration, amount) {
        this.slowEffect = new TimedEffect(duration);
        this.slowEffect.amount = amount;
      }

      takeDamage(amount, source, label = "Hit") {
        if (this.isDefeated) {
          return;
        }

        const modifiers = this.getStatModifiers();
        const actual = Math.max(1, amount * modifiers.defense);
        this.hp = Math.max(0, this.hp - actual);
        if (label !== "Wall Slam") {
          source?.simulation?.shakeScreen?.(0.16, Math.min(18, 7 + actual * 0.55));
        }
        if (label !== "Crash") {
          source?.simulation?.playSound?.("hit", Math.min(1.8, 0.7 + actual / 18));
        }
        if (actual >= 10) {
          source?.simulation?.addLog?.(`${label} lands on ${this.name} for ${Math.round(actual)} damage.`);
        }
        if (this.hp <= 0) {
          this.isDefeated = true;
        }
      }

      draw(ctx) {
        if (this.isDestroyed || this.swallowedState) {
          return;
        }

        for (const [index, ghost] of this.trail.entries()) {
          ctx.save();
          ctx.globalAlpha = ghost.alpha * (1 - index / Math.max(1, this.trail.length + 1));
          ctx.fillStyle = this.speedBoost?.color ?? this.color;
          ctx.beginPath();
          ctx.arc(ghost.position.x, ghost.position.y, ghost.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.shadowBlur = this.speedBoost ? 18 : 0;
        ctx.shadowColor = this.speedBoost?.color ?? this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(3, this.radius * 0.07);
        ctx.stroke();

        this.drawFace(ctx, this.wallSlamState ? this.spinRotation : 0);

        if (this.id === "orbit") {
          const shards = this.ability?.getShardRenderStates?.() ?? [];
          const fastOrbit = this.ability?.spinBurst > 0;
          const missingCount = this.ability?.getMissingShardCount?.() ?? 0;
          ctx.strokeStyle = fastOrbit ? "rgba(255, 255, 255, 0.78)" : "rgba(111, 227, 255, 0.42)";
          ctx.lineWidth = fastOrbit ? 5 : 3;
          ctx.globalAlpha = missingCount >= 3 ? 0.5 : 1;
          ctx.setLineDash(fastOrbit ? [16, 7] : missingCount > 0 ? [6, 13] : [8, 9]);
          ctx.beginPath();
          ctx.arc(this.position.x, this.position.y, this.radius + (this.ability?.orbitRadius ?? 44), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          for (const shard of shards) {
            const size = shard.refilling ? 8 + shard.progress * 10 : fastOrbit ? 22 : 16;
            if (shard.refilling) {
              ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(this.position.x, this.position.y);
              ctx.lineTo(shard.position.x, shard.position.y);
              ctx.stroke();
            }
            ctx.globalAlpha = shard.refilling ? 0.58 + shard.progress * 0.42 : 1;
            ctx.fillStyle = fastOrbit || shard.refilling ? "#ffffff" : "#dff7ff";
            ctx.shadowBlur = fastOrbit || shard.refilling ? 28 : 18;
            ctx.shadowColor = this.color;
            ctx.fillRect(shard.position.x - size / 2, shard.position.y - size / 2, size, size);
            ctx.globalAlpha = 1;
          }
        }

        if (this.id === "berserker" && this.ability?.isCharged?.()) {
          const charge = this.ability.getChargeProgress();
          const pulse = 1 + Math.sin(performance.now() / 70) * (0.04 + charge * 0.08);
          ctx.strokeStyle = "rgba(255, 66, 26, 0.82)";
          ctx.lineWidth = 4 + charge * 4;
          ctx.beginPath();
          ctx.arc(this.position.x, this.position.y, (this.radius + 12 + charge * 16) * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255, 180, 80, 0.55)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(this.position.x, this.position.y, (this.radius + 22 + charge * 20) * pulse, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (this.id === "eater" && this.ability?.isFeasting?.()) {
          const radiusScale = this.ability?.getRadiusScale?.() ?? 1;
          const pulse = 1 + Math.sin(performance.now() / 55) * 0.09;
          const target = this.ability?.getMouthTarget?.();
          const mouthAngle = target
            ? Math.atan2(target.position.y - this.position.y, target.position.x - this.position.x)
            : Math.atan2(this.velocity.y, this.velocity.x);
          const mouthOpen = 0.5 + Math.sin(performance.now() / 95) * 0.12;
          ctx.strokeStyle = "rgba(160, 255, 72, 0.88)";
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(this.position.x, this.position.y, (this.radius + 14 + radiusScale * 10) * pulse, 0.2, Math.PI * 1.8);
          ctx.stroke();

          ctx.fillStyle = "#fafafa";
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.moveTo(this.position.x, this.position.y);
          ctx.arc(
            this.position.x,
            this.position.y,
            this.radius + 3,
            mouthAngle - mouthOpen,
            mouthAngle + mouthOpen
          );
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "rgba(32, 32, 32, 0.68)";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(this.position.x, this.position.y);
          ctx.lineTo(
            this.position.x + Math.cos(mouthAngle - mouthOpen) * (this.radius + 8),
            this.position.y + Math.sin(mouthAngle - mouthOpen) * (this.radius + 8)
          );
          ctx.moveTo(this.position.x, this.position.y);
          ctx.lineTo(
            this.position.x + Math.cos(mouthAngle + mouthOpen) * (this.radius + 8),
            this.position.y + Math.sin(mouthAngle + mouthOpen) * (this.radius + 8)
          );
          ctx.stroke();
        }

        if (this.speedBoost && this.speedBoost.showRing !== false) {
          ctx.strokeStyle = this.speedBoost.color;
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(this.position.x, this.position.y, this.radius + 18, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      drawFace(ctx, rotation = 0) {
        const r = this.radius;
        const x = this.position.x;
        const y = this.position.y;
        const time = performance.now() / 1000;
        const bob = Math.sin(time * 5 + x * 0.01) * r * 0.025;
        const blink = Math.sin(time * 2.6 + y * 0.01) > 0.93 ? 0.22 : 1;

        ctx.save();
        ctx.translate(x, y + bob);
        ctx.rotate(rotation);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#202020";
        ctx.fillStyle = "#202020";
        ctx.lineWidth = Math.max(3, r * 0.075);

        const eye = (ex, ey, size = 0.08) => {
          const half = size * r * 1.18;
          const lift = size * r * 0.32 * blink;
          ctx.beginPath();
          ctx.moveTo(ex * r - half, ey * r + lift);
          ctx.quadraticCurveTo(ex * r, ey * r - lift, ex * r + half, ey * r + lift);
          ctx.stroke();
        };
        const dotEye = (ex, ey, size = 0.055) => {
          ctx.beginPath();
          ctx.ellipse(ex * r, ey * r, size * r, size * r * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        };
        const sharpEye = (ex, ey, flip = 1, size = 0.12) => {
          ctx.beginPath();
          ctx.moveTo((ex - size) * r, (ey - 0.02 * flip) * r);
          ctx.lineTo((ex + size) * r, (ey + 0.04 * flip) * r);
          ctx.stroke();
        };
        const line = (points) => {
          ctx.beginPath();
          points.forEach(([px, py], index) => {
            if (index === 0) ctx.moveTo(px * r, py * r);
            else ctx.lineTo(px * r, py * r);
          });
          ctx.stroke();
        };
        const arc = (cx, cy, radius, start, end) => {
          ctx.beginPath();
          ctx.arc(cx * r, cy * r, radius * r, start, end);
          ctx.stroke();
        };

        switch (this.face) {
          case "archer":
            line([[-0.34, -0.2], [-0.12, -0.12]]);
            line([[0.34, -0.2], [0.12, -0.12]]);
            sharpEye(-0.23, -0.02, 1, 0.095);
            sharpEye(0.23, -0.02, -1, 0.095);
            line([[-0.18, 0.28], [0.2, 0.2]]);
            break;
          case "orbit":
            dotEye(-0.23, -0.08, 0.055);
            dotEye(0.23, -0.08, 0.055);
            arc(0, 0.18, 0.12, 0.1, Math.PI - 0.1);
            break;
          case "clone":
            dotEye(-0.25, -0.08, 0.047);
            eye(0.25, -0.08, 0.07);
            arc(-0.1, 0.18, 0.16, 0.15, Math.PI - 0.15);
            arc(0.18, 0.18, 0.16, 0.15, Math.PI - 0.15);
            break;
          case "grenade":
            line([[-0.36, -0.2], [-0.12, -0.05]]);
            line([[0.36, -0.2], [0.12, -0.05]]);
            sharpEye(-0.22, 0, 1, 0.09);
            sharpEye(0.22, 0, -1, 0.09);
            line([[-0.22, 0.28], [-0.07, 0.22], [0.08, 0.29], [0.24, 0.22]]);
            break;
          case "frosty":
            line([[-0.34, -0.16], [-0.1, -0.16]]);
            line([[0.1, -0.16], [0.34, -0.16]]);
            sharpEye(-0.22, -0.02, 0.3, 0.075);
            sharpEye(0.22, -0.02, -0.3, 0.075);
            line([[-0.22, 0.26], [0.22, 0.18]]);
            break;
          case "berserker": {
            const growl = this.ability?.getChargeProgress?.() ?? 0;
            line([[-0.38, -0.24], [-0.12, -0.08]]);
            line([[0.38, -0.24], [0.12, -0.08]]);
            dotEye(-0.22, 0, 0.052 + growl * 0.025);
            dotEye(0.22, 0, 0.052 + growl * 0.025);
            arc(0, 0.32, 0.2, Math.PI + 0.15, Math.PI * 2 - 0.15);
            break;
          }
          case "eater":
            dotEye(-0.22, -0.12, 0.06);
            dotEye(0.22, -0.12, 0.06);
            arc(0, 0.14, 0.24, 0.15, Math.PI - 0.15);
            break;
          default:
            dotEye(-0.22, -0.08, 0.052);
            dotEye(0.22, -0.08, 0.052);
            arc(0, 0.16, 0.2, 0.1, Math.PI - 0.1);
        }

        ctx.restore();
      }
    }


// src/simulation.js

class BattleSimulation {
      constructor(fighterSpecs, hooks) {
        this.hooks = hooks;
        this.width = 960;
        this.height = 960;
        const spawnPoints = this.createSpawnPoints(fighterSpecs.length);
        this.fighters = fighterSpecs.map((spec, index) => new BattleBall(spec, spawnPoints[index]));
        this.fighters[0].simulation = this;
        this.fighters[1].simulation = this;
        this.fighters[0].bindAbility(this.createAbility(fighterSpecs[0].ability, this.fighters[0]));
        this.fighters[1].bindAbility(this.createAbility(fighterSpecs[1].ability, this.fighters[1]));
        this.entities = [];
        this.elapsed = 0;
        this.overtimeStartsAt = 26;
        this.overtimeAnnounced = false;
        this.overtimeParticleTimer = 0;
        this.finished = false;
        this.winner = null;
        this.loser = null;
        this.resultAnimationTime = 0;
        this.resultReady = false;
        this.screenShake = null;
      }

      createSpawnPoints(count) {
        const points = [];
        const margin = 140;
        const center = new Vector2(this.width / 2, this.height / 2);
        while (points.length < count) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 170 + Math.random() * 120;
          const candidate = new Vector2(
            center.x + Math.cos(angle) * distance,
            center.y + Math.sin(angle) * distance
          );
          candidate.x = Math.max(margin, Math.min(this.width - margin, candidate.x));
          candidate.y = Math.max(margin, Math.min(this.height - margin, candidate.y));
          const clear = points.every((point) => Vector2.subtract(point, candidate).length() > 210);
          if (clear) {
            points.push(candidate);
          }
        }
        return points;
      }

      createAbility(type, owner) {
        const table = {
          archer: ArcherAbility,
          orbit: OrbitAbility,
          clone: CloneAbility,
          grenade: GrenadeAbility,
          frostySword: FrostySwordAbility,
          berserker: BerserkerAbility,
          eater: EaterAbility
        };
        const AbilityClass = table[type];
        return new AbilityClass(owner, this);
      }

      getOpponent(ball) {
        return this.fighters.find((fighter) => fighter !== ball && !fighter.isDefeated && !fighter.swallowedState) || null;
      }

      isOvertime() {
        return this.elapsed >= this.overtimeStartsAt;
      }

      getOvertimeProgress() {
        return Math.max(0, this.elapsed - this.overtimeStartsAt);
      }

      getDamageMultiplier() {
        return this.isOvertime() ? Math.min(3, 1.35 + this.getOvertimeProgress() * 0.085) : 1;
      }

      getSpeedMultiplier() {
        return this.isOvertime() ? Math.min(1.58, 1.12 + this.getOvertimeProgress() * 0.026) : 1;
      }

      keepInsideArena(ball) {
        let bounced = false;
        let wallNormal = null;
        let wallPoint = null;
        if (ball.position.x <= ball.radius) {
          ball.position.x = ball.radius;
          ball.velocity.x = Math.abs(ball.velocity.x);
          bounced = true;
          wallNormal = new Vector2(1, 0);
          wallPoint = ball.position.clone();
          if (ball.dashState?.untilWall) {
            ball.clearDash();
          }
        } else if (ball.position.x >= this.width - ball.radius) {
          ball.position.x = this.width - ball.radius;
          ball.velocity.x = -Math.abs(ball.velocity.x);
          bounced = true;
          wallNormal = new Vector2(-1, 0);
          wallPoint = ball.position.clone();
          if (ball.dashState?.untilWall) {
            ball.clearDash();
          }
        }

        if (ball.position.y <= ball.radius) {
          ball.position.y = ball.radius;
          ball.velocity.y = Math.abs(ball.velocity.y);
          bounced = true;
          wallNormal = new Vector2(0, 1);
          wallPoint = ball.position.clone();
          if (ball.dashState?.untilWall) {
            ball.clearDash();
          }
        } else if (ball.position.y >= this.height - ball.radius) {
          ball.position.y = this.height - ball.radius;
          ball.velocity.y = -Math.abs(ball.velocity.y);
          bounced = true;
          wallNormal = new Vector2(0, -1);
          wallPoint = ball.position.clone();
          if (ball.dashState?.untilWall) {
            ball.clearDash();
          }
        }

        if (bounced && ball.wallSlamState && ball.wallSlamState.cooldown <= 0) {
          ball.wallSlamState.cooldown = 0.18;
          ball.takeDamage(ball.wallSlamState.damage, ball.wallSlamState.source, "Wall Slam");
          this.spawnWallImpact(wallPoint ?? ball.position.clone(), wallNormal ?? ball.velocity.clone().normalize().scale(-1), ball.wallSlamState.source?.color ?? ball.color);
          this.playSound("wall", 1.15);
          this.shakeScreen(0.24, 16);
          this.addLog(`${ball.name} takes wall slam damage.`);
        }
      }

      keepEntityInsideArena(entity) {
        if (entity.position.x <= entity.radius) {
          entity.position.x = entity.radius;
          entity.velocity.x = Math.abs(entity.velocity.x);
        } else if (entity.position.x >= this.width - entity.radius) {
          entity.position.x = this.width - entity.radius;
          entity.velocity.x = -Math.abs(entity.velocity.x);
        }

        if (entity.position.y <= entity.radius) {
          entity.position.y = entity.radius;
          entity.velocity.y = Math.abs(entity.velocity.y);
        } else if (entity.position.y >= this.height - entity.radius) {
          entity.position.y = this.height - entity.radius;
          entity.velocity.y = -Math.abs(entity.velocity.y);
        }
      }

      update(delta) {
        if (this.finished) {
          this.updateResultEffects(delta);
          return;
        }

        this.elapsed += delta;
        this.updateScreenShake(delta);

        if (this.isOvertime()) {
          if (!this.overtimeAnnounced) {
            this.overtimeAnnounced = true;
            this.hooks.onOvertime?.();
            this.addLog("Overtime begins. Impact speed and crash damage are rising.");
          }
          this.updateOvertimeParticles(delta);
        }

        for (const fighter of this.fighters) {
          fighter.update(delta, this);
        }

        this.handleCollision();

        for (const entity of this.entities) {
          entity.update(delta, this);
        }
        this.entities = this.entities.filter((entity) => !entity.isExpired);

        this.checkResult();
      }

      handleCollision() {
        const [a, b] = this.fighters;
        if (a.isDefeated || b.isDefeated || a.swallowedState || b.swallowedState) {
          return;
        }

        const difference = Vector2.subtract(b.position, a.position);
        const distance = difference.length();
        const overlap = a.radius + b.radius - distance;
        if (overlap <= 0) {
          return;
        }

        const normal = difference.normalize();
        a.position.add(normal.clone().scale(-overlap / 2));
        b.position.add(normal.clone().scale(overlap / 2));

        const aModifiers = a.getStatModifiers();
        const bModifiers = b.getStatModifiers();
        const damageFromAToB = this.calculateCollisionDamage(a, b, normal) * aModifiers.damage;
        const damageFromBToA = this.calculateCollisionDamage(b, a, normal.clone().scale(-1)) * bModifiers.damage;

        a.takeDamage(damageFromBToA, b, "Crash");
        b.takeDamage(damageFromAToB, a, "Crash");

        const tangent = new Vector2(-normal.y, normal.x);
        const aNormal = a.velocity.x * normal.x + a.velocity.y * normal.y;
        const bNormal = b.velocity.x * normal.x + b.velocity.y * normal.y;
        const aTangent = a.velocity.x * tangent.x + a.velocity.y * tangent.y;
        const bTangent = b.velocity.x * tangent.x + b.velocity.y * tangent.y;

        const nextANormal =
          (aNormal * (a.mass - b.mass) + 2 * b.mass * bNormal) / (a.mass + b.mass);
        const nextBNormal =
          (bNormal * (b.mass - a.mass) + 2 * a.mass * aNormal) / (a.mass + b.mass);

        a.velocity = tangent.clone().scale(aTangent).add(normal.clone().scale(nextANormal * bModifiers.impact));
        b.velocity = tangent.clone().scale(bTangent).add(normal.clone().scale(nextBNormal * aModifiers.impact));

        if (a.dashState?.collisionDamage) {
          b.takeDamage(a.dashState.collisionDamage, a, a.dashState.collisionLabel);
          if (a.dashState.collisionSlow) {
            b.applySlow(a.dashState.collisionSlow.duration, a.dashState.collisionSlow.amount);
          }
        }

        if (b.dashState?.collisionDamage) {
          a.takeDamage(b.dashState.collisionDamage, b, b.dashState.collisionLabel);
          if (b.dashState.collisionSlow) {
            a.applySlow(b.dashState.collisionSlow.duration, b.dashState.collisionSlow.amount);
          }
        }

        if (a.dashState?.untilImpact) {
          a.clearDash();
        }

        if (b.dashState?.untilImpact) {
          b.clearDash();
        }

        a.ability?.onCollision(b);
        b.ability?.onCollision(a);

        this.playSound("crash", Math.min(1.8, 0.8 + Math.abs(damageFromAToB + damageFromBToA) / 24));
        this.addSparkBurst(Vector2.add(a.position, b.position).scale(0.5), "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
      }

      calculateCollisionDamage(attacker, defender, attackerToDefender) {
        const attackerSpeed = attacker.velocity.length();
        const defenderSpeed = defender.velocity.length();
        const attackerDirection =
          attackerSpeed > 0 ? attacker.velocity.clone().normalize() : attackerToDefender.clone();
        const defenderDirection =
          defenderSpeed > 0 ? defender.velocity.clone().normalize() : attackerToDefender.clone().scale(-1);
        const aimAlignment = Math.max(0, attackerDirection.x * attackerToDefender.x + attackerDirection.y * attackerToDefender.y);
        const defenderFacing = Math.max(0, defenderDirection.x * -attackerToDefender.x + defenderDirection.y * -attackerToDefender.y);
        const sideExposure = 1 - defenderFacing;
        const relativeSpeed = Math.max(0, attacker.velocity.clone().subtract(defender.velocity).length());
        const speedScore = attackerSpeed * 0.72 + relativeSpeed * 0.28;
        const directionalMultiplier = 0.38 + aimAlignment * 0.72 + sideExposure * 0.55;
        const glancingFloor = aimAlignment < 0.22 ? 0.45 : 1;

        return Math.max(2, speedScore * 0.018 * directionalMultiplier * glancingFloor * this.getDamageMultiplier());
      }

      checkResult() {
        const alive = this.fighters.filter((fighter) => !fighter.isDefeated);
        if (alive.length === 1) {
          this.resolveResult(alive[0]);
          return;
        }

        if (alive.length === 0) {
          this.resolveResult(this.fighters.reduce((best, current) => (current.hp > best.hp ? current : best)));
        }
      }

      resolveResult(winner) {
        if (this.finished) {
          return;
        }

        this.finished = true;
        this.winner = winner;
        this.loser = this.fighters.find((fighter) => fighter !== winner) ?? null;
        this.resultAnimationTime = 0;
        this.resultReady = false;

        for (const fighter of this.fighters) {
          fighter.freezeForResult();
        }

        if (this.loser) {
          const burstPosition = this.loser.position.clone();
          const burstColor = this.loser.color;
          this.loser.destroyForResult();
          this.spawnDeathExplosion(burstPosition, burstColor);
          this.addLog(`${this.loser.name} bursts apart in the arena.`);
        }
      }

      updateResultEffects(delta) {
        this.resultAnimationTime += delta;
        this.updateScreenShake(delta);
        for (const entity of this.entities) {
          entity.update(delta, this);
        }
        this.entities = this.entities.filter((entity) => !entity.isExpired);
        if (this.resultAnimationTime >= 2.15) {
          this.resultReady = true;
        }
      }

      updateScreenShake(delta) {
        if (!this.screenShake) {
          return;
        }

        this.screenShake.remaining -= delta;
        if (this.screenShake.remaining <= 0) {
          this.screenShake = null;
        }
      }

      spawnSeedOrb(owner, position, velocity) {
        this.entities.push(new SeedOrb(owner, position, velocity));
      }

      spawnArrow(owner, position, velocity) {
        this.entities.push(new ArrowProjectile(owner, position, velocity));
      }

      spawnGrenade(owner, targetPosition, fuseTime) {
        this.entities.push(new Grenade(owner, targetPosition, fuseTime));
      }

      spawnPulse(position, color) {
        this.entities.push(new VisualBurst(position, color, 180, 0.34));
        this.spawnParticleBurst(position, color, { count: 16, speed: 200, radiusMin: 2, radiusMax: 4 });
      }

      addSparkBurst(position, color) {
        this.entities.push(new VisualBurst(position, color, 120, 0.22));
        this.spawnParticleBurst(position, color, { count: 10, speed: 140, radiusMin: 2, radiusMax: 3 });
      }

      spawnExplosion(position, color) {
        this.entities.push(new VisualBurst(position, color, 340, 0.48));
        this.spawnParticleBurst(position, color, { count: 34, speed: 320, radiusMin: 2, radiusMax: 6, gravity: 940 });
      }

      spawnDeathExplosion(position, color) {
        this.playSound("ko");
        this.entities.push(new DeathBurstEffect(position, color));
        this.entities.push(new VisualBurst(position, "#ffffff", 280, 0.5));
        this.spawnParticleBurst(position, color, {
          count: 58,
          speed: 390,
          radiusMin: 3,
          radiusMax: 7,
          gravity: 1120,
          life: 2.25,
          bounce: 0.18,
          settleDelay: 0.85
        });
        this.spawnParticleBurst(position, "#ffffff", {
          count: 22,
          speed: 300,
          radiusMin: 2,
          radiusMax: 4,
          gravity: 980,
          life: 1.55,
          bounce: 0.12,
          settleDelay: 0.45
        });
      }

      spawnOrbitHit(shardPosition, targetPosition, color) {
        this.entities.push(new OrbitHitEffect(shardPosition, targetPosition, color));
      }

      spawnSlash(from, to, color) {
        this.entities.push(new SlashTrail(from, to, color));
        this.playSound("dash", 0.72);
        const center = Vector2.add(from, to).scale(0.5);
        this.spawnParticleBurst(center, color, { count: 12, speed: 180, radiusMin: 2, radiusMax: 4, gravity: 760 });
      }

      spawnParticleBurst(position, color, options = {}) {
        const count = options.count ?? 12;
        for (let index = 0; index < count; index += 1) {
          const spread = options.spread ?? Math.PI * 2;
          const baseAngle = options.direction
            ? Math.atan2(options.direction.y, options.direction.x)
            : Math.random() * Math.PI * 2;
          const angle = options.direction
            ? baseAngle + (Math.random() - 0.5) * spread
            : Math.random() * Math.PI * 2;
          const speed = (options.speed ?? 180) * (0.45 + Math.random() * 0.9);
          const velocity = new Vector2(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - (options.upBias ?? 40)
          );
          this.entities.push(
            new GravityParticle(position.clone(), velocity, {
              color,
              gravity: options.gravity ?? 1280,
              radius: (options.radiusMin ?? 2) + Math.random() * ((options.radiusMax ?? 4) - (options.radiusMin ?? 2)),
              life: options.life ?? (2.0 + Math.random() * 0.9),
              bounce: options.bounce ?? 0.12,
              floorFriction: options.floorFriction ?? 0.88,
              settleDelay: options.settleDelay ?? (0.9 + Math.random() * 0.8)
            })
          );
        }
      }

      spawnWallImpact(position, normal, color) {
        const direction = normal.clone().normalize();
        this.spawnParticleBurst(position, color, {
          count: 28,
          speed: 340,
          radiusMin: 3,
          radiusMax: 7,
          gravity: 1040,
          life: 1.65,
          bounce: 0.1,
          settleDelay: 0.45,
          upBias: 10,
          direction,
          spread: Math.PI * 0.72
        });
        this.entities.push(new VisualBurst(position.clone(), color, 180, 0.22));
      }

      shakeScreen(duration = 0.18, strength = 10) {
        if (this.screenShake) {
          this.screenShake.duration = Math.max(this.screenShake.duration, duration);
          this.screenShake.remaining = Math.max(this.screenShake.remaining, duration);
          this.screenShake.strength = Math.max(this.screenShake.strength, strength);
          return;
        }

        this.screenShake = {
          duration,
          remaining: duration,
          strength
        };
      }

      updateOvertimeParticles(delta) {
        this.overtimeParticleTimer -= delta;
        if (this.overtimeParticleTimer > 0) {
          return;
        }

        this.overtimeParticleTimer = 0.055;
        const count = 2 + Math.floor(Math.min(4, this.getOvertimeProgress() / 4));
        for (let index = 0; index < count; index += 1) {
          const x = 40 + Math.random() * (this.width - 80);
          const y = 24 + Math.random() * 80;
          const color = Math.random() > 0.45 ? "#ff8a00" : "#ff2d2d";
          this.entities.push(
            new GravityParticle(
              new Vector2(x, y),
              new Vector2((Math.random() - 0.5) * 70, 80 + Math.random() * 120),
              {
                color,
                gravity: 1200,
                radius: 2 + Math.random() * 3,
                life: 1.7 + Math.random() * 0.8,
                bounce: 0.08,
                settleDelay: 0.55 + Math.random() * 0.45
              }
            )
          );
        }
      }

      addLog(message) {
        this.hooks.onLog(message);
      }

      playSound(type, intensity = 1) {
        this.hooks.onSound?.(type, intensity);
      }
    }


// src/ui.js


class ArenaRenderer {
      constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
      }

      render(simulation) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        const shake = simulation.screenShake;
        if (shake) {
          const progress = shake.remaining / shake.duration;
          const strength = shake.strength * progress;
          ctx.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
        }

        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (const entity of simulation.entities) {
          entity.draw(ctx, simulation);
        }

        for (const fighter of simulation.fighters) {
          fighter.draw(ctx);
          this.drawNameplate(fighter);
        }

        ctx.restore();
      }

      drawNameplate(fighter) {
        if (fighter.isDestroyed) {
          return;
        }

        const ctx = this.ctx;
        const y = fighter.position.y + fighter.radius + 18;
        ctx.save();
        ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(32, 32, 32, 0.7)";
        ctx.fillText(fighter.name, fighter.position.x, y);
        ctx.restore();
      }
    }

class UIController {
      constructor(elements, roster) {
        this.elements = elements;
        this.roster = roster;
        this.logItems = [];
        this.renderRoster();
      }

      renderRoster(activeIds = []) {
        this.elements.fighterCards.innerHTML = "";
        const visibleRoster = activeIds.length
          ? this.roster.filter((fighter) => activeIds.includes(fighter.id))
          : [];

        for (const fighter of visibleRoster) {
          const card = document.createElement("article");
          card.className = `fighter-card${activeIds.includes(fighter.id) ? " active" : ""}`;
          card.innerHTML = `
            <div class="fighter-head">
              <div class="fighter-meta">
                <strong>${fighter.name}</strong>
                <span>250 / 250</span>
              </div>
            </div>
            <div class="hp-bar"><div class="hp-fill" style="background:${fighter.color};width:${activeIds.includes(fighter.id) ? "100%" : "18%"}"></div></div>
            <div class="cooldown-wrap">
              <div class="cooldown-meta"><span class="cooldown-label">Skill</span><span class="cooldown-text">Ready</span></div>
              <div class="cooldown-bar"><div class="cooldown-fill" style="width:100%"></div></div>
            </div>
          `;
          this.elements.fighterCards.appendChild(card);
        }
      }

      updateStatus(text, badge = "Ready") {
        this.elements.matchupLabel.innerHTML = `${text}<small>랜덤 대진과 전투 결과가 여기에 갱신됩니다.</small>`;
        this.elements.statusBadge.textContent = badge.toUpperCase();
        const topBar = this.elements.statusBadge.closest(".top-bar");
        topBar?.classList.toggle("overtime", badge.toLowerCase() === "overtime");
        topBar?.classList.toggle("result", badge.toLowerCase() === "result");
      }

      showOverlay(label, text) {
        this.elements.overlay.innerHTML = `
          <div class="overlay-card">
            <span>${label}</span>
            <strong>${text}</strong>
          </div>
        `;
        this.elements.overlay.classList.add("visible");
      }

      hideOverlay() {
        this.elements.overlay.classList.remove("visible");
      }

      resetLog() {
        this.logItems = [];
        this.renderLog();
      }

      addLog(text) {
        this.logItems.unshift(text);
        this.logItems = this.logItems.slice(0, 9);
        this.renderLog();
      }

      renderLog() {
        this.elements.battleLog.innerHTML = this.logItems.map((text) => `<li>${text}</li>`).join("");
      }

      renderTournament(tournament = null) {
        if (!this.elements.tournamentBracket) {
          return;
        }

        if (!tournament) {
          this.elements.tournamentPhase.textContent = "Ready";
          this.elements.tournamentBracket.innerHTML = `
            <div class="bracket-round">
              <div class="round-title">Round 1</div>
              <div class="bracket-match"><div class="bracket-slot empty">Press start</div><span class="bracket-status">WAIT</span></div>
            </div>
            <div class="bracket-round">
              <div class="round-title">Semi</div>
              <div class="bracket-match"><div class="bracket-slot empty">Auto battle</div><span class="bracket-status">LOCK</span></div>
            </div>
            <div class="bracket-round">
              <div class="round-title">Final</div>
              <div class="bracket-match"><div class="bracket-slot empty">Champion</div><span class="bracket-status">LOCK</span></div>
            </div>
          `;
          return;
        }

        this.elements.tournamentPhase.textContent = tournament.champion ? "Champion" : "Running";
        this.elements.tournamentBracket.innerHTML = tournament.rounds.map((round, roundIndex) => `
          <div class="bracket-round">
            <div class="round-title">${["Round 1", "Semi", "Final"][roundIndex]}</div>
            ${round.map((match) => this.renderTournamentMatch(match)).join("")}
          </div>
        `).join("");
      }

      renderTournamentMatch(match) {
        const classes = ["bracket-match", match.status];
        const status = match.winner ? "WIN" : match.status === "active" ? "LIVE" : match.status === "bye" ? "BYE" : "WAIT";
        return `
          <div class="${classes.join(" ")}">
            ${this.renderTournamentSlot(match.a, match.winner, match.roundIndex === 0 ? "BYE" : "TBD")}
            ${this.renderTournamentSlot(match.b, match.winner, match.roundIndex === 0 ? "BYE" : "TBD")}
            <span class="bracket-status">${status}</span>
          </div>
        `;
      }

      renderTournamentSlot(fighter, winner, emptyLabel = "TBD") {
        if (!fighter) {
          return `<div class="bracket-slot empty"><span class="bracket-dot"></span>${emptyLabel}</div>`;
        }

        const isWinner = winner?.id === fighter.id;
        return `
          <div class="bracket-slot${isWinner ? " winner" : ""}">
            <span class="bracket-dot" style="background:${fighter.color}"></span>${fighter.name}
          </div>
        `;
      }

      updateLiveCards(fighters) {
        const cards = Array.from(this.elements.fighterCards.children);
        for (const fighter of fighters) {
          const card = cards.find((item) => item.querySelector(".fighter-meta strong").textContent === fighter.name);
          if (!card) {
            continue;
          }

          const fill = card.querySelector(".hp-fill");
          const hpText = card.querySelector(".fighter-meta span");
          const cooldownFill = card.querySelector(".cooldown-fill");
          const cooldownLabel = card.querySelector(".cooldown-label");
          const cooldownText = card.querySelector(".cooldown-text");
          const abilityUi = fighter.getAbilityUiState();
          fill.style.width = `${Math.max(0, (fighter.hp / fighter.maxHp) * 100)}%`;
          hpText.textContent = `${Math.ceil(fighter.hp)} / ${fighter.maxHp}`;
          cooldownFill.style.width = `${Math.max(0, Math.min(1, abilityUi.progress)) * 100}%`;
          cooldownLabel.textContent = abilityUi.label;
          cooldownText.textContent = abilityUi.progress >= 0.995 ? "Ready" : `${Math.round(abilityUi.progress * 100)}%`;
          card.classList.toggle("active", !fighter.isDefeated);
          if (fighter.isDefeated) {
            fill.style.opacity = "0.3";
            cooldownFill.style.opacity = "0.35";
          }
        }
      }
    }


// src/tournament.js


class Matchmaker {
      constructor(roster) {
        this.roster = roster;
      }

      pick() {
        const shuffled = [...this.roster].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 2);
      }
    }

class TournamentManager {
      constructor(roster) {
        const entrants = [...roster].sort(() => Math.random() - 0.5);
        const slots = new Array(8).fill(null);
        const byeIndexes = [1, 6, 3, 4].slice(0, Math.max(0, 8 - entrants.length));
        const playIndexes = slots.map((_, index) => index).filter((index) => !byeIndexes.includes(index));
        entrants.slice(0, playIndexes.length).forEach((entrant, index) => {
          slots[playIndexes[index]] = entrant;
        });
        this.rounds = [
          this.createRound(slots, 0),
          this.createRound([null, null, null, null], 1),
          this.createRound([null, null], 2)
        ];
        this.champion = null;
        this.autoAdvanceByes();
      }

      createRound(slots, roundIndex) {
        const matches = [];
        for (let index = 0; index < slots.length; index += 2) {
          matches.push({
            id: `r${roundIndex}m${index / 2}`,
            roundIndex,
            matchIndex: index / 2,
            a: slots[index],
            b: slots[index + 1],
            winner: null,
            status: "pending"
          });
        }
        return matches;
      }

      autoAdvanceByes() {
        for (const match of this.rounds[0]) {
          if (match.status !== "pending") {
            continue;
          }

          if (match.a && !match.b) {
            this.complete(match, match.a, "bye");
          } else if (!match.a && match.b) {
            this.complete(match, match.b, "bye");
          }
        }
      }

      nextMatch() {
        for (const round of this.rounds) {
          const match = round.find((candidate) => candidate.status === "pending" && candidate.a && candidate.b);
          if (match) {
            return match;
          }
        }
        return null;
      }

      markActive(match) {
        match.status = "active";
      }

      complete(match, winner, status = "done") {
        match.winner = winner;
        match.status = status;
        if (match.roundIndex >= this.rounds.length - 1) {
          this.champion = winner;
          return;
        }

        const next = this.rounds[match.roundIndex + 1][Math.floor(match.matchIndex / 2)];
        if (match.matchIndex % 2 === 0) {
          next.a = winner;
        } else {
          next.b = winner;
        }
      }
    }


// src/roster.js
function createRoster() {
  return [
          {
            id: "archer",
            name: "Archer Ball",
            title: "Piercing Arrow",
            description: "잠시 자세를 고정해 피해를 버티고, 충돌 순간 강한 앵커 충격파를 되돌려줍니다.",
            color: "#f7b34d",
            face: "archer",
            ability: "archer",
            stats: { hp: 112, damage: 1.02, speed: 270, force: 240, radius: 50, mass: 1.2 }
          },
          {
            id: "orbit",
            name: "Orbit Ball",
            title: "Visible Halo",
            description: "몸 주위를 도는 위성이 가까운 적을 계속 긁어내며 체력을 깎습니다.",
            color: "#6fe3ff",
            face: "orbit",
            ability: "orbit",
            stats: { hp: 102, damage: 1, speed: 308, force: 290, radius: 48, mass: 1.1 }
          },
          {
            id: "clone",
            name: "Clone Ball",
            title: "Seed Gamble",
            description: "분신을 전방으로 쏘아 상대를 압박하는 속임수형 전투 공입니다.",
            color: "#d99cff",
            face: "clone",
            ability: "clone",
            stats: { hp: 98, damage: 1.02, speed: 320, force: 275, radius: 46, mass: 1.02 }
          },
          {
            id: "grenade",
            name: "Grenade Ball",
            title: "Blast Arc",
            description: "상대 예상 위치로 수류탄을 던져 지연 폭발을 노리는 폭격형 공입니다.",
            color: "#ff7676",
            face: "grenade",
            ability: "grenade",
            stats: { hp: 108, damage: 1.08, speed: 278, force: 255, radius: 49, mass: 1.18 }
          },
          {
            id: "frosty",
            name: "Frosty Sword",
            title: "Freeze Clash",
            description: "순간 대시로 적을 베고, 짧게 둔화시켜 다음 충돌을 유리하게 만듭니다.",
            color: "#8ee8d7",
            face: "frosty",
            ability: "frostySword",
            stats: { hp: 110, damage: 1.12, speed: 294, force: 280, radius: 49, mass: 1.16 }
          },
          {
            id: "berserker",
            name: "Berserker",
            title: "Visible Rage",
            description: "체력이 낮아질수록 속도와 충돌 화력이 폭발적으로 올라갑니다.",
            color: "#ffae6e",
            face: "berserker",
            ability: "berserker",
            stats: { hp: 124, damage: 1.02, speed: 238, force: 250, radius: 51, mass: 1.28 }
          },
          {
            id: "eater",
            name: "Eater Ball",
            title: "Feast Bounce",
            description: "Enters feast mode, swallows on impact, then spits the enemy into wall-damaging speed.",
            color: "#a6ff4d",
            face: "eater",
            ability: "eater",
            stats: { hp: 118, damage: 0.98, speed: 268, force: 265, radius: 52, mass: 1.34 }
          }
        ];
}


// src/app.js

class BattleApp {
      constructor() {
        this.elements = {
          canvas: document.getElementById("arenaCanvas"),
          overlay: document.getElementById("overlay"),
          startButton: document.getElementById("startButton"),
          matchupLabel: document.getElementById("matchupLabel"),
          statusBadge: document.getElementById("statusBadge"),
          fighterCards: document.getElementById("fighterCards"),
          battleLog: document.getElementById("battleLog"),
          tournamentBracket: document.getElementById("tournamentBracket"),
          tournamentPhase: document.getElementById("tournamentPhase")
        };

        this.roster = createRoster();
        this.renderer = new ArenaRenderer(this.elements.canvas);
        this.ui = new UIController(this.elements, this.roster);
        this.ui.renderTournament();
        this.matchmaker = new Matchmaker(this.roster);
        this.audio = new AudioEngine();
        this.tournament = null;
        this.currentTournamentMatch = null;
        this.simulation = null;
        this.lastTime = 0;
        this.rafId = 0;
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        this.elements.startButton.addEventListener("click", () => this.startTournament());
      }

      async startTournament() {
        this.audio.unlock();
        cancelAnimationFrame(this.rafId);
        this.elements.startButton.disabled = true;
        this.elements.startButton.classList.add("hidden");
        this.elements.startButton.textContent = "다시 시작";
        this.ui.resetLog();
        this.tournament = new TournamentManager(this.roster);
        this.currentTournamentMatch = null;
        this.ui.renderTournament(this.tournament);
        this.ui.addLog("Tournament bracket locked. Battles will run automatically to the final.");
        await this.runNextTournamentMatch();
      }

      async runNextTournamentMatch() {
        if (!this.tournament) {
          return;
        }

        const nextMatch = this.tournament.nextMatch();
        if (!nextMatch) {
          this.showTournamentChampion();
          return;
        }

        this.currentTournamentMatch = nextMatch;
        this.tournament.markActive(nextMatch);
        this.ui.renderTournament(this.tournament);
        await this.startMatch([nextMatch.a, nextMatch.b], { keepLog: true });
      }

      async startMatch(customMatch = null, options = {}) {
        this.audio.unlock();
        this.elements.startButton.disabled = true;
        this.elements.startButton.classList.add("hidden");
        this.resultSequenceAnnounced = false;
        this.matchFinalized = false;
        if (!options.keepLog) {
          this.ui.resetLog();
        }

        const match = customMatch ?? this.matchmaker.pick();
        const label = `${match[0].name} vs ${match[1].name}`;
        this.ui.renderRoster(match.map((fighter) => fighter.id));
        this.ui.updateStatus(label, "Drawing");
        this.ui.showOverlay("Matchup", label);
        this.ui.addLog(`Random matchup locked: ${label}`);
        this.ui.addLog(`The arena recognizes ${match[0].title} and ${match[1].title}.`);

        this.simulation = new BattleSimulation(match, {
          onLog: (message) => this.ui.addLog(message),
          onOvertime: () => {
            this.ui.updateStatus(label, "Overtime");
            this.audio.play("overtime");
          },
          onSound: (type, intensity) => this.audio.play(type, intensity)
        });

        this.renderer.render(this.simulation);
        await this.wait(1350);

        this.ui.hideOverlay();
        this.ui.updateStatus(label, "Fight");
        this.audio.play("start");
        this.ui.addLog("Fight starts automatically.");
        this.lastTime = performance.now();
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame((time) => this.loop(time));
      }

      loop(timestamp) {
        const delta = Math.min(0.032, (timestamp - this.lastTime) / 1000 || 0.016);
        this.lastTime = timestamp;
        this.simulation.update(delta);
        this.renderer.render(this.simulation);
        this.ui.updateLiveCards(this.simulation.fighters);

        if (this.simulation.finished) {
          if (!this.resultSequenceAnnounced) {
            this.resultSequenceAnnounced = true;
            const loser = this.simulation.loser;
            this.ui.updateStatus(loser ? `${loser.name} is down` : "Final impact", "KO");
          }

          if (this.simulation.resultReady) {
            this.finishMatch();
            return;
          }

          this.rafId = requestAnimationFrame((time) => this.loop(time));
          return;
        }

        this.rafId = requestAnimationFrame((time) => this.loop(time));
      }

      finishMatch() {
        if (this.matchFinalized) {
          return;
        }

        this.matchFinalized = true;
        const winner = this.simulation.winner;
        const loser = this.simulation.loser ?? this.simulation.fighters.find((fighter) => fighter !== winner);
        if (this.tournament && this.currentTournamentMatch) {
          const winnerSpec =
            [this.currentTournamentMatch.a, this.currentTournamentMatch.b].find((fighter) => fighter?.id === winner.id)
            ?? this.roster.find((fighter) => fighter.id === winner.id);
          this.tournament.complete(this.currentTournamentMatch, winnerSpec);
          this.ui.renderTournament(this.tournament);
          this.ui.showOverlay(this.tournament.champion ? "Champion" : "Advances", winner.name);
          this.ui.updateStatus(
            this.tournament.champion ? `${winner.name} is champion` : `${winner.name} advances`,
            "Result"
          );
          this.ui.addLog(`${winner.name} defeats ${loser.name}.`);
          this.currentTournamentMatch = null;

          if (this.tournament.champion) {
            this.showTournamentChampion();
            return;
          }

          window.setTimeout(() => this.runNextTournamentMatch(), 1450);
          return;
        }

        this.ui.showOverlay("Winner", winner.name);
        this.ui.updateStatus(`${winner.name} wins`, "Result");
        this.ui.addLog(`${winner.name} defeats ${loser.name}.`);
        this.ui.addLog("Press the button again for another random matchup.");
        this.elements.startButton.textContent = "다시 시작";
        this.elements.startButton.classList.remove("hidden");
        this.elements.startButton.disabled = false;
      }

      showTournamentChampion() {
        if (!this.tournament?.champion) {
          return;
        }

        const champion = this.tournament.champion;
        this.ui.renderTournament(this.tournament);
        this.ui.showOverlay("Champion", champion.name);
        this.ui.updateStatus(`${champion.name} wins the tournament`, "Result");
        this.ui.addLog(`${champion.name} takes the whole bracket.`);
        this.elements.startButton.textContent = "다시 시작";
        this.elements.startButton.classList.remove("hidden");
        this.elements.startButton.disabled = false;
      }

      wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
      }
    }



// src/main.js

window.ballFightApp = new BattleApp();

})();
