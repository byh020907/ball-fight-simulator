import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";

const GRENADE_COOLDOWN = 3.5;
const BURST_COUNT_MIN = 3;
const BURST_COUNT_MAX = 5;
const BURST_INTERVAL = 0.12;
const SCATTER_SPEED = 800;
const FUSE_FIRST = 0.6;
const FUSE_LAST = 2.0;

export class GrenadeAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, GRENADE_COOLDOWN);
        this.state = { burstRemaining: 0, burstTotal: 0, burstTimer: 0 };
    }

    update(delta, target) {
        if (this.state.burstRemaining > 0) {
            this.state.burstTimer -= delta;
            if (this.state.burstTimer <= 0) {
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
        this.state.burstTotal = BURST_COUNT_MIN + Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1));
        this.state.burstRemaining = this.state.burstTotal;
        this.state.burstTimer = BURST_INTERVAL;
        this._fireNext(target);
    }

    _fireNext(target) {
        if (this.state.burstRemaining <= 0 || !target) return;

        const shotIndex = this.state.burstTotal - this.state.burstRemaining;
        const progress = this.state.burstTotal > 1 ? shotIndex / (this.state.burstTotal - 1) : 0.5;
        const fuse = FUSE_FIRST + progress * (FUSE_LAST - FUSE_FIRST);

        const angle = Math.random() * Math.PI * 2;
        const dir = Vector2.fromAngle(angle, 1);
        const targetPos = Vector2.add(this.owner.position, dir.clone().scale(SCATTER_SPEED * fuse));

        this.simulation.spawnGrenade(this.owner, targetPos, fuse);

        this.state.burstRemaining--;
        this.state.burstTimer = BURST_INTERVAL;
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
        if (this.state.burstRemaining > 0) {
            const fired = this.state.burstTotal - this.state.burstRemaining;
            return {
                label: `${fired + 1}/${this.state.burstTotal}`,
                progress: fired / this.state.burstTotal
            };
        }
        return {
            label: "Scatter",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
