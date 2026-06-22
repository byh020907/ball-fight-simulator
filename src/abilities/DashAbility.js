import { steerBallToward, Vector2 } from "../core.js";
import { DashEffect } from "../combat-effects.js";
import { Ability } from "./Ability.js";

const INITIAL_COOLDOWN_LEVEL = 0;
const HOMING_RANGE = 400;
const MAX_DASH_DURATION = 1.4;
const DASH_SOUND_PITCH = 1.15;
const SLASH_LENGTH = 120;

export class DashAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.baseCooldown = 3;
        this.cooldownLevel = INITIAL_COOLDOWN_LEVEL;
        this.maxCooldownLevel = 2;
        this._baseCooldown = this.getCooldownForLevel();
        this.timer = this.cooldown * 0.5;
        this.dashMultiplier = 2.15;
        this.homingTurnRate = 2.4;
    }

    update(delta, target) {
        if (this.owner.movementEffect && target && this.cooldownLevel === 0) {
            const dist = Vector2.subtract(target.position, this.owner.position).length();
            if (dist < HOMING_RANGE) {
                this.steerDash(delta, target);
            }
        }

        this.timer -= delta;
        if (this.owner.movementEffect || this.timer > 0 || !target) {
            return;
        }

        this.timer = this.cooldown;
        const direction = Vector2.subtract(target.position, this.owner.position).normalize();
        this.owner.setMovementEffect(
            new DashEffect({
                duration: MAX_DASH_DURATION,
                multiplier: this.dashMultiplier,
                color: this.owner.color,
                collisionLabel: "Dash Contact",
                untilImpact: true,
                untilWall: true
            })
        );
        this.owner.forceHeading(direction, MAX_DASH_DURATION);
        this.owner.velocity = direction.clone().scale(this.owner.baseSpeed * this.dashMultiplier);
        this.simulation.playSound("dash", DASH_SOUND_PITCH);
        this.simulation.spawnSlash(
            this.owner.position.clone(),
            Vector2.add(this.owner.position, direction.clone().scale(SLASH_LENGTH)),
            this.owner.color
        );
        this.simulation.addLog(`${this.owner.name} lines up a cooldown dash.`);
    }

    steerDash(delta, target) {
        steerBallToward(this.owner, target, delta, { turnRate: this.homingTurnRate, persist: true });
    }

    onDashHit() {
        this.cooldownLevel = Math.min(this.maxCooldownLevel, this.cooldownLevel + 1);
        this.cooldown = this.getCooldownForLevel();
        this.timer = Math.min(this.timer, this.cooldown);
        this.simulation.addLog(`${this.owner.name} lands a dash and shortens future cooldowns.`);
    }

    onDashWall() {
        this.cooldownLevel = 0;
        this._baseCooldown = this.getCooldownForLevel();
        this.timer = this.cooldown;
        this.simulation.addLog(`${this.owner.name} hits a wall and resets dash cooldown.`);
    }

    getCooldownForLevel() {
        return this.baseCooldown * 0.5 ** this.cooldownLevel;
    }

    drawFace(ctx, rotation, ball) {
        this._line(ctx, ball, [
            [-0.34, -0.16],
            [-0.1, -0.16]
        ]);
        this._line(ctx, ball, [
            [0.1, -0.16],
            [0.34, -0.16]
        ]);
        this._sharpEye(ctx, ball, -0.22, -0.02, 0.3, 0.075);
        this._sharpEye(ctx, ball, 0.22, -0.02, -0.3, 0.075);
        this._line(ctx, ball, [
            [-0.22, 0.26],
            [0.22, 0.18]
        ]);
        return true;
    }

    getUiState() {
        if (this.owner.movementEffect) {
            return { label: "Dash", progress: 1 };
        }
        return { label: "Dash", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
    }
}
