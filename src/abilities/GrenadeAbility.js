import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

const EVADE_RANGE = 260;
const EVADE_STRENGTH = 0.5;

export class GrenadeAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this._baseCooldown = 4.7;
        this.timer = 1.5;
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
        if (!target || target.isDefeated || this.owner.swallowedState || this.owner.wallSlamState) return;

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const dist = toTarget.length();
        if (dist >= EVADE_RANGE || dist <= 5) return;

        const towardOpponent = toTarget.normalize();

        const myDir = this.owner.velocity.length() > 5 ? this.owner.velocity.clone().normalize() : null;
        const movingToward = myDir ? myDir.x * towardOpponent.x + myDir.y * towardOpponent.y > 0 : true;
        if (!movingToward) return;

        const oppDir =
            target.velocity.length() > 5 ? target.velocity.clone().normalize() : towardOpponent.clone().scale(-1);

        const side =
            oppDir.x * (this.owner.position.y - target.position.y) -
            oppDir.y * (this.owner.position.x - target.position.x);

        const dodgeDir = side > 0 ? new Vector2(-oppDir.y, oppDir.x) : new Vector2(oppDir.y, -oppDir.x);

        const intensity = (1 - dist / EVADE_RANGE) * EVADE_STRENGTH;
        const current = myDir ?? dodgeDir;
        const blended = current.add(dodgeDir.scale(intensity)).normalize();

        if (this.owner.forcedHeading) {
            this.owner.forcedHeading.direction = blended;
            this.owner.forcedHeading.effect.elapsed = 0;
        } else {
            this.owner.forceHeading(blended, 0.35);
        }
    }
}
