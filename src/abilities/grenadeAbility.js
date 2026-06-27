import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";
import { GrenadeFragment } from "../entities/index.js";

const GRENADE_COOLDOWN = 4.0;
const FRAGMENT_SPEED_MULT = 3.0;
const FRAGMENT_DAMAGE_MULT = 1.2;
const SPREAD_ANGLE = Math.PI * 0.6;

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
        const count = 2 + Math.floor(Math.random() * 3);

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const baseAngle = Math.atan2(toTarget.y, toTarget.x);
        const halfSpread = SPREAD_ANGLE / 2;

        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 0.5;
            const jitter = (Math.random() - 0.5) * 0.2;
            const angle = baseAngle - halfSpread + SPREAD_ANGLE * t + jitter;
            const dir = Vector2.fromAngle(angle, 1);
            const speed = this.owner.baseSpeed * FRAGMENT_SPEED_MULT;
            const start = Vector2.add(this.owner.position, dir.clone().scale(this.owner.radius + 12));
            const fragment = new GrenadeFragment(this.owner, start, dir.scale(speed));
            this.simulation.entities.push(fragment);
        }

        this.simulation.playSound("shoot", 0.7);
        this.simulation.addLog(`${this.owner.name} fires ${count} shrapnel round${count > 1 ? "s" : ""}!`);
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
