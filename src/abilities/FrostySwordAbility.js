import { Vector2 } from '../core.js';
import { Ability } from './Ability.js';

export class FrostySwordAbility extends Ability {
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
