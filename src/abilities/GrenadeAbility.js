import { Vector2 } from '../core.js';
import { Ability } from './Ability.js';

export class GrenadeAbility extends Ability {
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
