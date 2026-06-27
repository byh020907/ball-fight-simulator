import { Vector2, evadeTarget } from "../core.js";
import { Ability } from "./ability.js";

const EVADE_RANGE = 320;
const EVADE_STRENGTH = 0.7;
const PREDICTION_FACTOR = 0.3;
const FUSE_REDUCTION_PER_MISS = 0.18;
const MAX_MISS_STREAK = 4;

export class GrenadeAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 3.8);
        this.missStreak = 0;
        this.baseFuse = 1.08;
        this.minFuse = 0.48;
    }

    update(delta, target) {
        this._evade(target);
        this.timer -= delta;
        if (this.timer > 0 || !target) {
            return;
        }

        this.timer = this.cooldown * (0.3 + Math.random() * 1.0);
        const prediction = Vector2.add(target.position.clone(), target.velocity.clone().scale(PREDICTION_FACTOR));
        this.simulation.spawnGrenade(this.owner, prediction, this.getFuseTime());
        this.simulation.playSound("toss");
        this.simulation.addLog(`${this.owner.name} tosses a grenade into the arena.`);
    }

    getFuseTime() {
        return Math.max(this.minFuse, this.baseFuse - this.missStreak * FUSE_REDUCTION_PER_MISS);
    }

    onGrenadeResult(hit) {
        if (hit) {
            this.missStreak = 0;
            return;
        }

        this.missStreak = Math.min(MAX_MISS_STREAK, this.missStreak + 1);
        this.simulation.addLog(`${this.owner.name}'s next grenade fuse shortens.`);
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
            label: this.missStreak > 0 ? `Fuse x${this.missStreak}` : "Grenade",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }

    _evade(target) {
        evadeTarget(this.owner, target, EVADE_RANGE, EVADE_STRENGTH);
    }
}
