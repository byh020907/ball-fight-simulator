import { Vector2 } from '../core.js';
import { Ability } from './Ability.js';

export class FrostySwordAbility extends Ability {
      constructor(owner, simulation) {
        super(owner, simulation);
        this.baseCooldown = 3;
        this.cooldownLevel = 0;
        this.maxCooldownLevel = 3;
        this.cooldown = this.getCooldownForLevel();
        this.timer = this.cooldown * 0.5;
        this.dashMultiplier = 2.15;
        this.homingTurnRate = 2.4;
      }

      update(delta, target) {
        if (this.owner.dashState && target && this.cooldownLevel === 0) {
          this.steerDash(delta, target);
        }

        this.timer -= delta;
        if (this.owner.dashState || this.timer > 0 || !target) {
          return;
        }

        this.timer = this.cooldown;
        const direction = Vector2.subtract(target.position, this.owner.position).normalize();
        this.owner.startDash(direction, {
          multiplier: this.dashMultiplier,
          color: this.owner.color,
          collisionLabel: "Dash Contact",
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
        this.simulation.addLog(`${this.owner.name} lines up a cooldown dash.`);
      }

      steerDash(delta, target) {
        const current = this.owner.forcedHeading?.direction?.clone()
          ?? this.owner.velocity.clone().normalize();
        const desired = Vector2.subtract(target.position, this.owner.position).normalize();
        const cross = current.x * desired.y - current.y * desired.x;
        const dot = current.x * desired.x + current.y * desired.y;
        const angle = Math.atan2(cross, dot);
        const turn = Math.max(-this.homingTurnRate * delta, Math.min(this.homingTurnRate * delta, angle));
        const nextAngle = Math.atan2(current.y, current.x) + turn;
        const nextDirection = Vector2.fromAngle(nextAngle, 1);

        if (this.owner.forcedHeading) {
          this.owner.forcedHeading.direction = nextDirection;
        }
      }

      onDashHit() {
        this.cooldownLevel = Math.min(this.maxCooldownLevel, this.cooldownLevel + 1);
        this.cooldown = this.getCooldownForLevel();
        this.timer = Math.min(this.timer, this.cooldown);
        this.simulation.addLog(`${this.owner.name} lands a dash and shortens future cooldowns.`);
      }

      onDashWall() {
        this.cooldownLevel = Math.max(0, this.cooldownLevel - 1);
        this.cooldown = this.getCooldownForLevel();
        this.timer = this.cooldown;
        this.simulation.addLog(`${this.owner.name} hits a wall and loses one dash cooldown stack.`);
      }

      getCooldownForLevel() {
        return this.baseCooldown * (0.5 ** this.cooldownLevel);
      }

      getUiState() {
        if (this.owner.dashState) {
          return { label: "Dash", progress: 1 };
        }
        return { label: "Dash", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
      }
    }
