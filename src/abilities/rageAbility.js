import { Ability } from "./ability.js";

const CHARGE_THRESHOLD_PARTICLES = 0.22;
const PARTICLE_BASE_INTERVAL = 0.15;
const PARTICLE_INTERVAL_REDUCTION = 0.07;
const PARTICLE_BASE_COUNT = 1;
const PARTICLE_COUNT_PER_CHARGE = 3;
const PARTICLE_BASE_SPEED = 90;
const PARTICLE_SPEED_PER_CHARGE = 90;
const SPEED_BASE = 0.78;
const SPEED_PER_CHARGE = 0.2;
const DAMAGE_BASE = 0.96;
const DAMAGE_PER_CHARGE = 0.04;
const IMPACT_BASE = 0.9;
const IMPACT_PER_CHARGE = 0.1;

export class RageAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.particleTimer = 0;
        this.timeWithoutCollision = 0;
        this._baseMaxChargeTime = 14.0;
    }

    getMaxChargeTime() {
        const skill = this.owner.statAllocation?.skill ?? 0;
        const factor = 100 / (100 + skill);
        return this._baseMaxChargeTime * factor;
    }

    update(delta) {
        this.timeWithoutCollision = Math.min(this.getMaxChargeTime(), this.timeWithoutCollision + delta);
        if (this.getChargeProgress() > CHARGE_THRESHOLD_PARTICLES) {
            this.particleTimer -= delta;
            if (this.particleTimer <= 0) {
                this.particleTimer = PARTICLE_BASE_INTERVAL - this.getChargeProgress() * PARTICLE_INTERVAL_REDUCTION;
                this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
                    count: PARTICLE_BASE_COUNT + Math.floor(this.getChargeProgress() * PARTICLE_COUNT_PER_CHARGE),
                    speed: PARTICLE_BASE_SPEED + this.getChargeProgress() * PARTICLE_SPEED_PER_CHARGE,
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
        return Math.max(0, Math.min(1, this.timeWithoutCollision / this.getMaxChargeTime()));
    }

    isCharged() {
        return this.getChargeProgress() > 0.22;
    }

    getStatModifiers() {
        const charge = this.getChargeProgress();
        return {
            speed: 0.78 + charge * 4.22,
            damage: 0.96 + charge * 0.34,
            defense: 1,
            impact: 0.9 + charge * 0.62
        };
    }

    draw(ctx) {
        if (!this.isCharged()) {
            return;
        }

        const pos = this.owner.position;
        const r = this.owner.radius;
        const charge = this.getChargeProgress();
        const pulse = 1 + Math.sin(performance.now() / 70) * (0.04 + charge * 0.08);

        ctx.save();
        ctx.strokeStyle = "#ff421a";
        ctx.lineWidth = 4 + charge * 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (r + 12 + charge * 16) * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#ffb450";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (r + 22 + charge * 20) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        const growl = this.getChargeProgress();
        this._line(ctx, ball, [
            [-0.38, -0.24],
            [-0.12, -0.08]
        ]);
        this._line(ctx, ball, [
            [0.38, -0.24],
            [0.12, -0.08]
        ]);
        this._dotEye(ctx, ball, -0.22, 0, 0.052 + growl * 0.025);
        this._dotEye(ctx, ball, 0.22, 0, 0.052 + growl * 0.025);
        this._arc(ctx, ball, 0, 0.32, 0.2, Math.PI + 0.15, Math.PI * 2 - 0.15);
        return true;
    }

    getUiState() {
        return { label: "Momentum", progress: Math.max(0.08, this.getChargeProgress()) };
    }
}
