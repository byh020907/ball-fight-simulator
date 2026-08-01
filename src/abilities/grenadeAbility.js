import { Vector2 } from "../core.js";
import { BURST_RESULTS, BurstSequencer } from "../game-kit/physics/index.js";
import { Ability } from "./ability.js";

const GRENADE_COOLDOWN = 3.0;
const BURST_COUNT_MIN = 3;
const BURST_COUNT_MAX = 5;
const BURST_INTERVAL = 0.12;
const BASE_GRENADE_SPEED = 290;
const PROJECTILE_SPEED_MULTIPLIER = 1.1;
const FIRST_FUSE_COOLDOWN_RATIO = 0.2;
const COMMAND_WINDOW_DURATION = 0.8;
const MAX_GUIDED_SHOTS = 4;

export class GrenadeAbility extends BurstSequencer(Ability) {
    constructor(owner, simulation) {
        super(owner, simulation, GRENADE_COOLDOWN);
        this.commandWindow = null;
        this.preparedCommand = null;
        this.commandCycles = new Map();
        this.activeCommandCycle = null;
    }

    update(delta, target) {
        if (this.isBursting) {
            this.tickBurst(delta, () => this._fireNext(target));
            this._finalizeCommandCycles();
            return;
        }

        this.tickCooldown(delta);
        this._finalizeCommandCycles();
        if (this.commandWindow) {
            const aiming = this.simulation.dragCombat?.input?.state === "aiming";
            if (aiming) this.commandWindow.wasAiming = true;
            const fallbackTarget = this._getFallbackTarget(target);
            if (!this._canAcceptPlayerCommand() || !fallbackTarget) {
                this.commandWindow = null;
                if (fallbackTarget) this._startBurst(fallbackTarget);
                return;
            }
            if (!aiming && this.commandWindow.wasAiming) {
                this.commandWindow = null;
                this._startBurst(fallbackTarget);
                return;
            }
            if (!aiming) this.commandWindow.remaining = Math.max(0, this.commandWindow.remaining - delta);
            if (aiming || this.commandWindow.remaining > 0) return;
            this.commandWindow = null;
            this._startBurst(fallbackTarget);
            return;
        }
        if (!this.cooldownReady || !target) {
            return;
        }

        if (this._canAcceptPlayerCommand()) {
            this.commandWindow = { target, remaining: COMMAND_WINDOW_DURATION, wasAiming: false };
            return;
        }
        this._startBurst(target);
    }

    _startBurst(target) {
        this.resetCooldown(this.cooldown);
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

        const cycle = this.activeCommandCycle;
        const guided = cycle && shotIndex < cycle.guidedPlanned;
        const dir = guided ? cycle.direction.clone() : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const projectileSpeed = (this.owner.stats?.baseSpeed ?? BASE_GRENADE_SPEED) * PROJECTILE_SPEED_MULTIPLIER;
        const targetPos = Vector2.add(this.owner.position, dir.clone().scale(projectileSpeed * fuse));

        const options = {
            launchSpeed: projectileSpeed,
            sticky: Boolean(this.getLevelUpgrade().stickyGrenade),
            burning: Boolean(this.getLevelUpgrade().burningExplosion),
            stickyHoming: Boolean(this.getLevelUpgrade().stickyHoming),
            commandGuided: Boolean(guided),
            onDetonate: cycle ? (outcome) => this._recordGrenadeOutcome(cycle, outcome) : null
        };
        this.simulation.spawnGrenade(this.owner, targetPos, fuse, options);
        if (guided) cycle.guidedLaunched += 1;
        if (shotIndex + 1 >= this._burstTotal && cycle) {
            cycle.launchComplete = true;
            if (this.activeCommandCycle === cycle) this.activeCommandCycle = null;
        }

        return BURST_RESULTS.FIRED;
    }

    getCommandState() {
        if (!this._canAcceptPlayerCommand()) return { available: false, reserveResource: false };
        return { available: Boolean(this.commandWindow), reserveResource: !this.commandWindow };
    }

    prepareCommand(intent) {
        if (!this.commandWindow || !this._isCommandEligible()) return intent;
        const direction = this._getCommandDirection(intent);
        this.preparedCommand = {
            ...intent,
            direction: { x: direction.x, y: direction.y },
            pathSegments: intent.pathSegments?.map((point) => ({ ...point })) ?? [],
            bouncePoints: intent.bouncePoints?.map((point) => ({ ...point })) ?? [],
            target: this.commandWindow.target
        };
        this.commandWindow = null;
        return this.preparedCommand;
    }

    resolveCommandLaunch(intent) {
        const command = this.preparedCommand;
        this.preparedCommand = null;
        if (!command || command.sequence !== intent?.sequence) return { mode: "default-shot" };
        const plannedBounces = command.bouncePoints.length;
        const cycle = {
            commandSequence: command.sequence,
            direction: new Vector2(command.direction.x, command.direction.y),
            targetId: command.target.id,
            totalGrenades: 0,
            guidedPlanned: Math.min(MAX_GUIDED_SHOTS, 1 + Math.min(3, plannedBounces)),
            guidedLaunched: 0,
            settledGrenades: 0,
            guidedEnemyExplosions: 0,
            initialTargetExplosions: 0,
            stickyContacts: 0,
            homingActivations: 0,
            wastedExplosions: 0,
            actualDamage: 0,
            plannedSegments: command.pathSegments.length,
            plannedBounces,
            createdAt: command.createdAt ?? this.simulation.elapsed,
            reason: "pending",
            launchComplete: false,
            finalized: false
        };
        this.commandCycles.set(command.sequence, cycle);
        this.activeCommandCycle = cycle;
        this._startBurst(command.target);
        cycle.totalGrenades = this._burstTotal;
        cycle.guidedPlanned = Math.min(cycle.guidedPlanned, cycle.totalGrenades);
        return { mode: "payload-only" };
    }

    onCommandEnd(event) {
        if (this.preparedCommand?.sequence === event.commandSequence) this.preparedCommand = null;
    }

    onOwnerDefeated() {
        this._clearPendingCommand();
        this._finalizeAllCommandCycles("owner-defeat");
        return false;
    }

    onBattleEnded() {
        this._clearPendingCommand();
        this._finalizeAllCommandCycles("battle-ended");
    }

    _clearPendingCommand() {
        this.commandWindow = null;
        this.preparedCommand = null;
        this.activeCommandCycle = null;
        this._burstRemaining = 0;
        this._burstTimer = 0;
    }

    _getFallbackTarget(target) {
        const windowTarget = this.commandWindow?.target;
        if (windowTarget && !windowTarget.flags.defeated) return windowTarget;
        if (target && !target.flags.defeated) return target;
        return this.simulation.getNearestEnemy(this.owner);
    }

    _canAcceptPlayerCommand() {
        return Boolean(this._isCommandEligible() && this.simulation.commandResource?.canSpend?.());
    }

    _isCommandEligible() {
        return Boolean(
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            this.simulation.dragCombat &&
            !this.simulation.dragCombat.automated
        );
    }

    _getCommandDirection(intent) {
        const point = intent.pathSegments?.[0];
        const direction = point
            ? new Vector2(point.x - this.owner.position.x, point.y - this.owner.position.y)
            : new Vector2(intent.direction?.x ?? 1, intent.direction?.y ?? 0);
        return direction.length() > 0.001 ? direction.normalize() : new Vector2(1, 0);
    }

    _recordGrenadeOutcome(cycle, outcome) {
        if (!cycle || cycle.finalized) return;
        cycle.settledGrenades += 1;
        cycle.guidedEnemyExplosions += outcome.commandGuided && outcome.affectedTargetIds.length > 0 ? 1 : 0;
        cycle.initialTargetExplosions += outcome.affectedTargetIds.includes(cycle.targetId) ? 1 : 0;
        cycle.stickyContacts += outcome.wasSticky ? 1 : 0;
        cycle.homingActivations += outcome.homingActivated ? 1 : 0;
        cycle.wastedExplosions += outcome.affectedTargetIds.length ? 0 : 1;
        cycle.actualDamage += outcome.actualDamage;
    }

    _finalizeCommandCycles() {
        for (const [sequence, cycle] of this.commandCycles) {
            if (!cycle.launchComplete || cycle.settledGrenades < cycle.totalGrenades) continue;
            cycle.reason = cycle.guidedEnemyExplosions ? "completed" : "no-guided-hit";
            this._finalizeCommandCycle(sequence);
        }
    }

    _finalizeAllCommandCycles(reason) {
        for (const cycle of this.commandCycles.values()) cycle.reason = reason;
        for (const sequence of [...this.commandCycles.keys()]) this._finalizeCommandCycle(sequence);
    }

    _finalizeCommandCycle(sequence) {
        const cycle = this.commandCycles.get(sequence);
        if (!cycle || cycle.finalized) return;
        cycle.finalized = true;
        this.recordAbilityResult({
            commandSequence: sequence,
            resultType: "grenade-command-bombing-line",
            success: cycle.reason === "completed" && cycle.guidedEnemyExplosions > 0,
            value: {
                totalGrenades: cycle.totalGrenades,
                guidedPlanned: cycle.guidedPlanned,
                guidedLaunched: cycle.guidedLaunched,
                settledGrenades: cycle.settledGrenades,
                guidedEnemyExplosions: cycle.guidedEnemyExplosions,
                initialTargetExplosions: cycle.initialTargetExplosions,
                stickyContacts: cycle.stickyContacts,
                homingActivations: cycle.homingActivations,
                wastedExplosions: cycle.wastedExplosions,
                actualDamage: cycle.actualDamage,
                plannedSegments: cycle.plannedSegments,
                plannedBounces: cycle.plannedBounces,
                elapsed: Math.max(0, this.simulation.elapsed - cycle.createdAt),
                reason: cycle.reason
            }
        });
        this.commandCycles.delete(sequence);
        if (this.activeCommandCycle === cycle) this.activeCommandCycle = null;
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
        if (this.commandWindow) {
            return { label: "폭격선", text: "반사마다 유도탄 +1", progress: this.cooldownProgress };
        }
        if (this.isBursting) {
            const fired = this._burstTotal - this._burstRemaining;
            const cycle = this.activeCommandCycle ?? [...this.commandCycles.values()].at(-1);
            return {
                label: `${fired + 1}/${this._burstTotal}`,
                text: cycle ? `유도 ${cycle.guidedPlanned}발` : null,
                progress: fired / this._burstTotal
            };
        }
        return {
            label: "Scatter",
            progress: this.cooldownProgress
        };
    }
}
