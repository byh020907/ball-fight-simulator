import { CombatEntity, TimedEffect, Vector2 } from './core.js';

export class SeedOrb extends CombatEntity {
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

export class ArrowProjectile extends CombatEntity {
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

export class Grenade extends CombatEntity {
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

export class BattleBall {
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
