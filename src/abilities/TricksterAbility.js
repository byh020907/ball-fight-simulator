import { Vector2 } from '../core.js';
import { Ability } from './Ability.js';

export class TricksterAbility extends Ability {
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
          this.simulation.spawnSeedOrb(this.owner, start, direction.scale(speed), this.cooldown);
        }
        this.simulation.playSound("seed");
        this.simulation.addLog(`${this.owner.name} launches three dash seeds.`);
      }

      getUiState() {
        return { label: "Seeds", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
      }
    }
