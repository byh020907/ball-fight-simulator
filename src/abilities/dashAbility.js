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
const COMMAND_WINDOW_DURATION = 0.8;
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
        this.state = {
            cooldownLevel: INITIAL_COOLDOWN_LEVEL,
            commandWindow: null,
            preparedCommand: null,
            commandCycles: new Map()
        };
        this.baseCooldown = 2.5;
        this.maxCooldownLevel = 2;
        this._baseCooldown = this.getCooldownForLevel();
        this.resetCooldown(this.cooldown);
        this.dashMultiplier = 2.15;
        this.homingTurnRate = 2.4;
        this.laserCombatStates = new WeakMap();
    }

    update(delta, target) {
        if (this.owner.state.movement && target && this.state.cooldownLevel === 0 && !this._isCommandDash()) {
            const dist = Vector2.subtract(target.position, this.owner.position).length();
            if (dist < HOMING_RANGE) {
                this.steerDash(delta, target);
            }
        }

        this.tickCooldown(delta);
        this._finalizeCommandCycles();
        const window = this.state.commandWindow;
        if (window) {
            const aiming = this.simulation.dragCombat?.input?.state === "aiming";
            if (aiming) window.wasAiming = true;
            if (!this._isValidTarget(window.target)) {
                this._clearCommandState();
                return;
            }
            if (!this._canAcceptPlayerCommand()) {
                this._clearCommandState();
                if (!this.owner.state.movement) this._startDash(window.target);
                return;
            }
            if (!aiming && window.wasAiming) {
                this._clearCommandState();
                if (!this.owner.state.movement) this._startDash(window.target);
                return;
            }
            if (aiming || window.remaining > 0) {
                if (!aiming) window.remaining = Math.max(0, window.remaining - delta);
                if (aiming || window.remaining > 0) return;
            }
            this._clearCommandState();
            this._startDash(window.target);
            return;
        }
        if (this.owner.state.movement || !this.cooldownReady || !target) {
            return;
        }
        if (this._canAcceptPlayerCommand()) {
            this.state.commandWindow = { target, remaining: COMMAND_WINDOW_DURATION, wasAiming: false };
            return;
        }
        this._startDash(target);
    }

    steerDash(delta, target) {
        steerBallToward(this.owner, target, delta, { turnRate: this.getHomingTurnRate(), persist: true });
    }

    onDashHit(target, effect) {
        this.state.cooldownLevel = Math.min(this.maxCooldownLevel, this.state.cooldownLevel + 1);
        this.cooldown = this.getCooldownForLevel();
        this.setCooldownDuration(this.cooldown);
        this.simulation.addLog(`${this.owner.name} lands a dash and shortens future cooldowns.`);
        if (this.getLevelUpgrade().laserStrike && target && !target.flags.defeated) {
            const laser = new LaserBeamEffect(this.owner, target, {
                maxWallBounces: this.getLevelUpgrade().laserWallBounces ?? 0,
                combatOwner: this
            });
            this.simulation.entities.push(laser);
            const cycle = this._getCommandCycle(effect);
            if (cycle) cycle.laser = laser;
        }
        const cycle = this._getCommandCycle(effect);
        if (cycle) {
            cycle.dashHit = true;
            cycle.cooldownLevelAfter = this.state.cooldownLevel;
        }
    }

    beginDashLaserCombat(laser) {
        const cycle = [...this.state.commandCycles.values()].find((candidate) => candidate.laser === laser);
        this.laserCombatStates.set(laser, {
            damageTickAccumulator: 0,
            damageTickInterval: laser.fireDuration / Math.max(1, Math.ceil(laser.fireDuration / LASER_DAMAGE_TICK)),
            commandSequence: cycle?.commandSequence ?? null
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
                const cycle = this.state.commandCycles.get(this.laserCombatStates.get(laser)?.commandSequence);
                if (cycle) cycle.laserDamage += actualDamage;
                if (isFirstLaserHit) this._igniteDashLaserTarget(target, cycle);
            });
        }
    }

    _igniteDashLaserTarget(target, cycle = null) {
        if (!this.getLevelUpgrade().laserIgnition || target.flags.defeated) return;
        const applied = applyBurningEffect({
            source: this.owner,
            target,
            simulation: this.simulation,
            label: "Dash Ignition",
            config: DASH_LEVEL9_IGNITION_CONFIG
        });
        if (applied && cycle) cycle.ignitionTargetIds.add(target.id);
    }

    finishDashLaserCombat(laser) {
        this.laserCombatStates.delete(laser);
    }

    onDashWall(effect) {
        const previousLevel = this.state.cooldownLevel;
        this.state.cooldownLevel = 0;
        this._baseCooldown = this.getCooldownForLevel();
        this.resetCooldown(this.cooldown);
        this.simulation.addLog(
            `${this.owner.name} hits a wall and ${this.state.cooldownLevel < previousLevel ? "drops" : "keeps"} dash cooldown stage.`
        );
        const cycle = this._getCommandCycle(effect);
        if (cycle) {
            cycle.wallFailed = true;
            cycle.cooldownLevelAfter = this.state.cooldownLevel;
        }
    }

    getCommandState() {
        if (!this._canAcceptPlayerCommand()) return { available: false, reserveResource: false };
        return { available: Boolean(this.state.commandWindow), reserveResource: !this.state.commandWindow };
    }

    prepareCommand(intent) {
        const window = this.state.commandWindow;
        if (!window || !this._canLaunchCommand(window.target)) return intent;
        this.state.preparedCommand = {
            ...intent,
            direction: { ...intent.direction },
            pathSegments: intent.pathSegments?.map((point) => ({ ...point })) ?? [],
            bouncePoints: intent.bouncePoints?.map((point) => ({ ...point })) ?? [],
            target: window.target
        };
        this.state.commandWindow = null;
        return this.state.preparedCommand;
    }

    resolveCommandLaunch(intent) {
        const command = this.state.preparedCommand;
        if (!command || command.sequence !== intent?.sequence || !this._canLaunchCommand(command.target)) {
            if (command?.sequence === intent?.sequence) this.state.preparedCommand = null;
            return { mode: "default-shot" };
        }
        const direction = this._getCommandDirection(command);
        const cycle = {
            commandSequence: command.sequence,
            effect: null,
            laser: null,
            tier: this.abilityTier,
            cooldownLevelAtLaunch: this.state.cooldownLevel,
            plannedSegments: command.pathSegments.length,
            plannedBounces: command.bouncePoints.length,
            target: command.target,
            dashHit: false,
            wallFailed: false,
            laserDamage: 0,
            ignitionTargetIds: new Set(),
            cooldownLevelAfter: null,
            createdAt: command.createdAt ?? this.simulation.elapsed,
            finalized: false
        };
        this.state.commandCycles.set(command.sequence, cycle);
        cycle.effect = this._startDash(command.target, direction, command.sequence);
        this.state.preparedCommand = null;
        return { mode: "replace-shot" };
    }

    onCommandEnd() {}

    onBattleEnded() {
        this._clearCommandState();
        for (const sequence of [...this.state.commandCycles.keys()]) this._finalizeCommandCycle(sequence);
    }

    _startDash(
        target,
        direction = Vector2.subtract(target.position, this.owner.position).normalize(),
        commandSequence = null
    ) {
        this.resetCooldown(this.cooldown);
        this.owner.initiateDash(direction, {
            duration: MAX_DASH_DURATION,
            multiplier: this.getDashMultiplier(),
            collisionDamage: Math.round(this.owner.stats.baseDamage * 0.4),
            collisionLabel: "Dash Contact",
            commandSequence
        });
        this.simulation.playSound("dash", DASH_SOUND_PITCH);
        this.simulation.spawnSlash(
            this.owner.position.clone(),
            Vector2.add(this.owner.position, direction.clone().scale(SLASH_LENGTH)),
            this.owner.color
        );
        this.simulation.addLog(`${this.owner.name} lines up a cooldown dash.`);
        return this.owner.state.movement;
    }

    _canAcceptPlayerCommand() {
        return Boolean(
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            this.simulation.dragCombat &&
            !this.simulation.dragCombat.automated &&
            this.simulation.commandResource?.canSpend?.()
        );
    }

    _canLaunchCommand(target) {
        return Boolean(
            this._isValidTarget(target) &&
            this.cooldownReady &&
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            this.simulation.dragCombat &&
            !this.simulation.dragCombat.automated
        );
    }

    _isValidTarget(target) {
        return Boolean(target && !target.flags.defeated && !target.flags.destroyed);
    }

    _getCommandDirection(command) {
        for (const point of command.pathSegments ?? []) {
            const direction = new Vector2(point.x - this.owner.position.x, point.y - this.owner.position.y);
            if (direction.length() > 0.001) return direction.normalize();
        }
        const direction = new Vector2(command.direction?.x ?? 1, command.direction?.y ?? 0);
        return direction.length() > 0.001 ? direction.normalize() : new Vector2(1, 0);
    }

    _isCommandDash() {
        return Number.isFinite(this.owner.state.movement?.commandSequence);
    }

    _getCommandCycle(effect) {
        const sequence = effect?.commandSequence;
        return Number.isFinite(sequence) ? this.state.commandCycles.get(sequence) : null;
    }

    _finalizeCommandCycles() {
        for (const [sequence, cycle] of this.state.commandCycles) {
            const effectActive = this.owner.state.movement === cycle.effect && !cycle.effect?.expired;
            const laserActive = cycle.laser && !cycle.laser.isExpired && this.simulation.entities.includes(cycle.laser);
            const ownerActive = this._isValidTarget(this.owner);
            if ((!ownerActive || !this._isValidTarget(cycle.target)) && !laserActive) {
                this._finalizeCommandCycle(sequence);
            } else if (!effectActive && !laserActive) {
                this._finalizeCommandCycle(sequence);
            }
        }
    }

    _finalizeCommandCycle(sequence) {
        const cycle = this.state.commandCycles.get(sequence);
        if (!cycle || cycle.finalized) return;
        cycle.finalized = true;
        const laserHits = cycle.laser?.getHitSegmentsByTarget?.() ?? new Map();
        const laserHitSegments = [...laserHits.values()].reduce((sum, segments) => sum + segments.size, 0);
        if (cycle.cooldownLevelAfter === null) cycle.cooldownLevelAfter = this.state.cooldownLevel;
        this.recordAbilityResult({
            commandSequence: sequence,
            resultType: "dash-command-manual-entry",
            success: cycle.dashHit,
            value: {
                tier: cycle.tier,
                cooldownLevelAtLaunch: cycle.cooldownLevelAtLaunch,
                plannedSegments: cycle.plannedSegments,
                plannedBounces: cycle.plannedBounces,
                dashHit: cycle.dashHit,
                wallFailed: cycle.wallFailed,
                laserHitSegments,
                laserDamage: cycle.laserDamage,
                ignitionTargets: cycle.ignitionTargetIds.size,
                cooldownLevelAfter: cycle.cooldownLevelAfter,
                elapsed: Math.max(0, this.simulation.elapsed - cycle.createdAt)
            }
        });
        this.state.commandCycles.delete(sequence);
    }

    _clearCommandState() {
        this.state.commandWindow = null;
        this.state.preparedCommand = null;
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
