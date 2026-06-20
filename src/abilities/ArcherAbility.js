import { Vector2 } from '../core.js';
import { Ability } from './Ability.js';

export class ArcherAbility extends Ability {
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
