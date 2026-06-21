import { Vector2 } from './core.js';
import { ArcherAbility, BerserkerAbility, CloneAbility, EaterAbility, FrostySwordAbility, GrenadeAbility, OrbitAbility } from './abilities/index.js';
import { ArrowProjectile, BattleBall, Grenade, SeedOrb } from './entities.js';
import { DeathBurstEffect, GravityParticle, OrbitHitEffect, SlashTrail, VisualBurst } from './effects.js';

export class BattleSimulation {
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
          this.clearWallDash(ball);
        } else if (ball.position.x >= this.width - ball.radius) {
          ball.position.x = this.width - ball.radius;
          ball.velocity.x = -Math.abs(ball.velocity.x);
          bounced = true;
          wallNormal = new Vector2(-1, 0);
          wallPoint = ball.position.clone();
          this.clearWallDash(ball);
        }

        if (ball.position.y <= ball.radius) {
          ball.position.y = ball.radius;
          ball.velocity.y = Math.abs(ball.velocity.y);
          bounced = true;
          wallNormal = new Vector2(0, 1);
          wallPoint = ball.position.clone();
          this.clearWallDash(ball);
        } else if (ball.position.y >= this.height - ball.radius) {
          ball.position.y = this.height - ball.radius;
          ball.velocity.y = -Math.abs(ball.velocity.y);
          bounced = true;
          wallNormal = new Vector2(0, -1);
          wallPoint = ball.position.clone();
          this.clearWallDash(ball);
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

      clearWallDash(ball) {
        if (!ball.dashState?.untilWall) {
          return;
        }

        ball.ability?.onDashWall?.(ball.dashState);
        ball.clearDash();
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

        if (a.dashState) {
          if (a.dashState.collisionDamage) {
            b.takeDamage(a.dashState.collisionDamage, a, a.dashState.collisionLabel);
            if (a.dashState.collisionSlow) {
              b.applySlow(a.dashState.collisionSlow.duration, a.dashState.collisionSlow.amount);
            }
          }
          a.ability?.onDashHit?.(b, a.dashState);
        }

        if (b.dashState) {
          if (b.dashState.collisionDamage) {
            a.takeDamage(b.dashState.collisionDamage, b, b.dashState.collisionLabel);
            if (b.dashState.collisionSlow) {
              a.applySlow(b.dashState.collisionSlow.duration, b.dashState.collisionSlow.amount);
            }
          }
          b.ability?.onDashHit?.(a, b.dashState);
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

      spawnSeedOrb(owner, position, velocity, life) {
        this.entities.push(new SeedOrb(owner, position, velocity, life));
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
