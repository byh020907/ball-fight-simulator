import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";

const GRENADE_COOLDOWN = 4.5;
const BURST_COUNT_MIN = 2;
const BURST_COUNT_MAX = 4;
const BURST_INTERVAL = 0.12;
const SPREAD_ANGLE = (Math.PI * 2) / 3;
const SCATTER_RANGE = 800;
const FUSE_FIRST = 0.25;
const FUSE_LAST = 0.8;

export class GrenadeAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, GRENADE_COOLDOWN);
        this._burstRemaining = 0;
        this._burstTotal = 0;
        this._burstTimer = 0;
    }

    update(delta, target) {
        if (this._burstRemaining > 0) {
            this._burstTimer -= delta;
            if (this._burstTimer <= 0) {
                this._fireNext(target);
            }
            return;
        }

        this.timer -= delta;
        if (this.timer > 0 || !target) {
            return;
        }

        this.timer = this.cooldown;
        this._startBurst(target);
    }

    _startBurst(target) {
        this._burstTotal = BURST_COUNT_MIN + Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1));
        this._burstRemaining = this._burstTotal;
        this._burstTimer = BURST_INTERVAL;
        this._fireNext(target);
    }

    _fireNext(target) {
        if (this._burstRemaining <= 0 || !target) return;

        const shotIndex = this._burstTotal - this._burstRemaining;
        const progress = this._burstTotal > 1 ? shotIndex / (this._burstTotal - 1) : 0.5;
        const fuse = FUSE_FIRST + progress * (FUSE_LAST - FUSE_FIRST);

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const baseAngle = Math.atan2(toTarget.y, toTarget.x);
        const angle = baseAngle + (Math.random() - 0.5) * SPREAD_ANGLE;
        const dir = Vector2.fromAngle(angle, 1);
        const targetPos = Vector2.add(this.owner.position, dir.clone().scale(SCATTER_RANGE));

        this.simulation.spawnGrenade(this.owner, targetPos, fuse);

        this._burstRemaining--;
        this._burstTimer = BURST_INTERVAL;
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
        if (this._burstRemaining > 0) {
            const fired = this._burstTotal - this._burstRemaining;
            return {
                label: `${fired + 1}/${this._burstTotal}`,
                progress: fired / this._burstTotal
            };
        }
        return {
            label: "Scatter",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
