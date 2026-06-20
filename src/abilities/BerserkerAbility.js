import { Ability } from './Ability.js';

export class BerserkerAbility extends Ability {
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
