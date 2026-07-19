import { Vector2 } from "../core.js";
import { BURST_RESULTS, BurstSequencer } from "../physics/index.js";
import { Ability } from "./ability.js";

const GRENADE_COOLDOWN = 3.0;
const BURST_COUNT_MIN = 3;
const BURST_COUNT_MAX = 5;
const BURST_INTERVAL = 0.12;
const BASE_GRENADE_SPEED = 290;
const PROJECTILE_SPEED_MULTIPLIER = 1.1;
const FIRST_FUSE_COOLDOWN_RATIO = 0.2;

export class GrenadeAbility extends BurstSequencer(Ability) {
    constructor(owner, simulation) {
        super(owner, simulation, GRENADE_COOLDOWN);
    }

    update(delta, target) {
        if (this.isBursting) {
            this.tickBurst(delta, () => this._fireNext(target));
            return;
        }

        this.tickCooldown(delta);
        if (!this.cooldownReady || !target) {
            return;
        }

        this.resetCooldown(this.cooldown);
        this._startBurst(target);
    }

    _startBurst(target) {
        const count = BURST_COUNT_MIN + Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1));
        this.startBurst(count, BURST_INTERVAL);
        this.tickBurst(0, () => this._fireNext(target));
    }

    _fireNext(target) {
        if (!target) return BURST_RESULTS.PAUSED;

        const shotIndex = this._burstTotal - this._burstRemaining;
        const progress = this._burstTotal > 1 ? shotIndex / (this._burstTotal - 1) : 0.5;
        const firstFuse = this.cooldown * FIRST_FUSE_COOLDOWN_RATIO;
        const fuse = firstFuse + progress * (this.cooldown - firstFuse);

        const angle = Math.random() * Math.PI * 2;
        const dir = Vector2.fromAngle(angle, 1);
        const projectileSpeed = (this.owner.stats?.baseSpeed ?? BASE_GRENADE_SPEED) * PROJECTILE_SPEED_MULTIPLIER;
        const targetPos = Vector2.add(this.owner.position, dir.clone().scale(projectileSpeed * fuse));

        this.simulation.spawnGrenade(this.owner, targetPos, fuse, {
            launchSpeed: projectileSpeed,
            sticky: Boolean(this.getLevelUpgrade().stickyGrenade),
            burning: Boolean(this.getLevelUpgrade().burningExplosion),
            stickyHoming: Boolean(this.getLevelUpgrade().stickyHoming)
        });

        return BURST_RESULTS.FIRED;
    }

    drawFace(ctx, rotation, ball) {
        this._line(ctx, ball, [
            [-0.36, -0.2],
            [-0.12, -0.05]
        ]);
        this._line(ctx, ball, [
            [0.36, -0.2],
            [0.12, -0.05]
        ]);
        this._sharpEye(ctx, ball, -0.22, 0, 1, 0.09);
        this._sharpEye(ctx, ball, 0.22, 0, -1, 0.09);
        this._line(ctx, ball, [
            [-0.22, 0.28],
            [-0.07, 0.22],
            [0.08, 0.29],
            [0.24, 0.22]
        ]);
        return true;
    }

    getUiState() {
        if (this.isBursting) {
            const fired = this._burstTotal - this._burstRemaining;
            return {
                label: `${fired + 1}/${this._burstTotal}`,
                progress: fired / this._burstTotal
            };
        }
        return {
            label: "Scatter",
            progress: this.cooldownProgress
        };
    }
}
