import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";

const GRENADE_COOLDOWN = 4.0;
const SCATTER_COUNT_MIN = 2;
const SCATTER_COUNT_MAX = 4;
const SPREAD_ANGLE = Math.PI * 0.6;
const SCATTER_RANGE = 800;
const SCATTER_FUSE = 0.8;

export class GrenadeAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, GRENADE_COOLDOWN);
    }

    update(delta, target) {
        this.timer -= delta;
        if (this.timer > 0 || !target) {
            return;
        }

        this.timer = this.cooldown;
        const count = SCATTER_COUNT_MIN + Math.floor(Math.random() * (SCATTER_COUNT_MAX - SCATTER_COUNT_MIN + 1));

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const baseAngle = Math.atan2(toTarget.y, toTarget.x);
        const halfSpread = SPREAD_ANGLE / 2;

        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 0.5;
            const jitter = (Math.random() - 0.5) * 0.2;
            const angle = baseAngle - halfSpread + SPREAD_ANGLE * t + jitter;
            const dir = Vector2.fromAngle(angle, 1);
            const targetPos = Vector2.add(this.owner.position, dir.clone().scale(SCATTER_RANGE));
            this.simulation.spawnGrenade(this.owner, targetPos, SCATTER_FUSE);
        }

        this.simulation.playSound("shoot", 0.7);
        this.simulation.addLog(`${this.owner.name} scatters ${count} grenade${count > 1 ? "s" : ""}!`);
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
        return {
            label: "Scatter",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
