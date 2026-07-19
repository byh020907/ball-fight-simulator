import { steerBallToward, Vector2 } from "../core.js";
import { DashEffect } from "../combatEffects.js";
import { LaserBeamEffect, applyBurningEffect, circleIntersectsLaserSegment } from "../effects/index.js";
import { Ability } from "./ability.js";

const INITIAL_COOLDOWN_LEVEL = 0;
const HOMING_RANGE = 400;
const MAX_DASH_DURATION = 1.4;
const DASH_SOUND_PITCH = 1.15;
const SLASH_LENGTH = 120;
const LASER_DAMAGE_TICK = 0.05;
const LASER_TICK_EPSILON = 1e-9;
const DASH_LEVEL9_IGNITION_CONFIG = Object.freeze({
    duration: 1,
    tickInterval: 0.1,
    maximumTicks: 10,
    totalDamageMultiplier: 1,
    exactTotalDamage: true
});

export class DashAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.state = { cooldownLevel: INITIAL_COOLDOWN_LEVEL };
        this.baseCooldown = 2.5;
        this.maxCooldownLevel = 2;
        this._baseCooldown = this.getCooldownForLevel();
        this.resetCooldown(this.cooldown);
        this.dashMultiplier = 2.15;
        this.homingTurnRate = 2.4;
        this.laserCombatStates = new WeakMap();
    }

    update(delta, target) {
        if (this.owner.state.movement && target && this.state.cooldownLevel === 0) {
            const dist = Vector2.subtract(target.position, this.owner.position).length();
            if (dist < HOMING_RANGE) {
                this.steerDash(delta, target);
            }
        }

        this.tickCooldown(delta);
        if (this.owner.state.movement || !this.cooldownReady || !target) {
            return;
        }

        this.resetCooldown(this.cooldown);
        const direction = Vector2.subtract(target.position, this.owner.position).normalize();
        this.owner.initiateDash(direction, {
            duration: MAX_DASH_DURATION,
            multiplier: this.getDashMultiplier(),
            collisionDamage: Math.round(this.owner.stats.baseDamage * 0.4),
            collisionLabel: "Dash Contact"
        });
        this.simulation.playSound("dash", DASH_SOUND_PITCH);
        this.simulation.spawnSlash(
            this.owner.position.clone(),
            Vector2.add(this.owner.position, direction.clone().scale(SLASH_LENGTH)),
            this.owner.color
        );
        this.simulation.addLog(`${this.owner.name} lines up a cooldown dash.`);
    }

    steerDash(delta, target) {
        steerBallToward(this.owner, target, delta, { turnRate: this.getHomingTurnRate(), persist: true });
    }

    onDashHit(target) {
        this.state.cooldownLevel = Math.min(this.maxCooldownLevel, this.state.cooldownLevel + 1);
        this.cooldown = this.getCooldownForLevel();
        this.setCooldownDuration(this.cooldown);
        this.simulation.addLog(`${this.owner.name} lands a dash and shortens future cooldowns.`);
        if (this.getLevelUpgrade().laserStrike && target && !target.flags.defeated) {
            this.simulation.entities.push(
                new LaserBeamEffect(this.owner, target, {
                    maxWallBounces: this.getLevelUpgrade().laserWallBounces ?? 0,
                    combatOwner: this
                })
            );
        }
    }

    beginDashLaserCombat(laser) {
        this.laserCombatStates.set(laser, {
            damageTickAccumulator: 0,
            damageTickInterval: laser.fireDuration / Math.max(1, Math.ceil(laser.fireDuration / LASER_DAMAGE_TICK))
        });
    }

    resolveDashLaserFire(laser, activeDuration) {
        const state = this.laserCombatStates.get(laser);
        if (!state) return;
        state.damageTickAccumulator += activeDuration;
        while (state.damageTickAccumulator + LASER_TICK_EPSILON >= state.damageTickInterval) {
            state.damageTickAccumulator -= state.damageTickInterval;
            this._dealDashLaserTick(laser, state.damageTickInterval);
        }
    }

    _dealDashLaserTick(laser, activeDuration) {
        for (const target of this.simulation.getEnemiesOf(this.owner)) {
            laser.segments.forEach((segment, index) => {
                if (!circleIntersectsLaserSegment(target, segment)) return;
                const isFirstLaserHit = !laser.getHitSegmentsByTarget().has(target);
                const rawDamage = this.owner.stats.baseDamage * 0.6 * (activeDuration / laser.fireDuration);
                const { actualDamage } = target.takeDamage(rawDamage, this.owner, "Dash Laser");
                if (actualDamage <= 0) return;
                laser.recordHit(target, index);
                if (isFirstLaserHit) this._igniteDashLaserTarget(target);
            });
        }
    }

    _igniteDashLaserTarget(target) {
        if (!this.getLevelUpgrade().laserIgnition || target.flags.defeated) return;
        applyBurningEffect({
            source: this.owner,
            target,
            simulation: this.simulation,
            label: "Dash Ignition",
            config: DASH_LEVEL9_IGNITION_CONFIG
        });
    }

    finishDashLaserCombat(laser) {
        this.laserCombatStates.delete(laser);
    }

    onDashWall() {
        const previousLevel = this.state.cooldownLevel;
        this.state.cooldownLevel = 0;
        this._baseCooldown = this.getCooldownForLevel();
        this.resetCooldown(this.cooldown);
        this.simulation.addLog(
            `${this.owner.name} hits a wall and ${this.state.cooldownLevel < previousLevel ? "drops" : "keeps"} dash cooldown stage.`
        );
    }

    getDashMultiplier() {
        return this.dashMultiplier;
    }

    getHomingTurnRate() {
        return this.homingTurnRate;
    }

    getCooldownForLevel() {
        return this.baseCooldown * 0.5 ** this.state.cooldownLevel;
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
        if (this.owner.state.movement) {
            return { label: "Dash", progress: 1 };
        }
        return { label: "Dash", progress: this.cooldownProgress };
    }
}
