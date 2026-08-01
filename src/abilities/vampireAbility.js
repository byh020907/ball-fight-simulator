import { Vector2 } from "../core.js";
import { BatProjectile } from "../entities/index.js";
import { BloodMarkEffect, BloodRuptureEffect, BloodTetherEffect } from "../effects/index.js";
import { applyRotationalContactDamage } from "../game-kit/physics/contactDamage.js";
import { TimedKeyMap } from "../game-kit/physics/index.js";
import { Ability } from "./ability.js";

const LIFESTEAL_RATE_NORMAL = 0.35;
const LIFESTEAL_RATE_LOW_HP = 0.5;
const BAT_DAMAGE_LIFESTEAL_RATE = 0.7;
const LOW_HP_THRESHOLD = 0.3;
const BAT_COOLDOWN = 3.0;
const BAT_COUNT = 7;
const BAT_SPEED_MULT = 0.5;
const BAT_SPREAD_DEG = 40;
const BAT_LIFE_MIN = 3.25;
const BAT_LIFE_MAX = 4.75;
const BLOOD_PULL_COOLDOWN = 1;
const BLOOD_PULL_SPEED = 180;
const BLOOD_MARK_DURATION = 0.6;
const BLOOD_RUPTURE_DAMAGE_MULTIPLIER = 0.15;
const COMMAND_WINDOW_DURATION = 0.8;
const COMMAND_LEAD_INDEX = Math.floor(BAT_COUNT / 2);

export class VampireAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, BAT_COOLDOWN);
        this._bloodPullCooldowns = new TimedKeyMap({ isInvalid: (target) => target.flags.defeated });
        this._bloodMarks = new Map();
        this.commandWindow = null;
        this.preparedCommand = null;
        this.commandCycles = new Map();
        this.activeCommandCycle = null;
    }

    update(delta, target) {
        this._tickRewardState(delta);
        this.tickCooldown(delta);
        this._finalizeCommandCycles();
        if (this.commandWindow) return this._tickCommandWindow(delta, target);
        if (!this.cooldownReady || !target) return;
        if (this._canAcceptPlayerCommand()) {
            this.commandWindow = { target, remaining: COMMAND_WINDOW_DURATION, wasAiming: false };
            return;
        }
        this._launchBats(target);
    }

    _tickRewardState(delta) {
        this._bloodPullCooldowns.tick(delta);
        for (const [target, mark] of this._bloodMarks) {
            mark.remaining -= delta;
            if (mark.remaining <= 0 || target.flags.defeated) {
                mark.effect.isExpired = true;
                this._bloodMarks.delete(target);
            }
        }
    }

    _tickCommandWindow(delta, target) {
        const aiming = this.simulation.dragCombat?.input?.state === "aiming";
        if (aiming) this.commandWindow.wasAiming = true;
        const fallbackTarget = this._getFallbackTarget(target);
        if (!this._canAcceptPlayerCommand() || !fallbackTarget || (!aiming && this.commandWindow.wasAiming)) {
            this.commandWindow = null;
            if (fallbackTarget) this._launchBats(fallbackTarget);
            return;
        }
        if (!aiming) this.commandWindow.remaining = Math.max(0, this.commandWindow.remaining - delta);
        if (aiming || this.commandWindow.remaining > 0) return;
        this.commandWindow = null;
        this._launchBats(fallbackTarget);
    }

    _launchBats(target, cycle = null) {
        this.resetCooldown(this.cooldown);
        this._spawnBats(target, cycle);
    }

    _spawnBats(target, cycle = null) {
        const owner = this.owner;
        const upgrade = this.getLevelUpgrade();
        const baseAngle = Math.atan2(target.position.y - owner.position.y, target.position.x - owner.position.x);
        const spreadRad = (BAT_SPREAD_DEG * Math.PI) / 180;
        const speed = owner.stats.baseSpeed * BAT_SPEED_MULT * (upgrade.batSpeedMultiplier ?? 1);
        const bats = [];

        for (const index of Array.from({ length: BAT_COUNT }, (_, batIndex) => batIndex)) {
            const t = BAT_COUNT > 1 ? index / (BAT_COUNT - 1) - 0.5 : 0;
            const angle = baseAngle + t * spreadRad;
            const dir = new Vector2(Math.cos(angle), Math.sin(angle));
            const start = Vector2.add(owner.position, dir.clone().scale(owner.radius + 16));
            const life = BAT_LIFE_MIN + Math.random() * (BAT_LIFE_MAX - BAT_LIFE_MIN);
            const bat = new BatProjectile(owner, start, dir.clone().scale(speed), bats, {
                ability: this,
                life,
                repeatBite: Boolean(upgrade.repeatBite),
                lifeBurst: Boolean(upgrade.lifeBurst),
                commandGuided: Boolean(cycle && index === COMMAND_LEAD_INDEX),
                commandRoute: cycle && index === COMMAND_LEAD_INDEX ? cycle.pathSegments : [],
                commandTerminalTargetId: cycle?.targetId ?? null,
                commandCycle: cycle,
                onSettled: cycle ? (outcome) => this._recordBatOutcome(cycle, outcome) : null
            });
            bats.push(bat);
            this.simulation.entities.push(bat);
        }
        for (const bat of bats) bat._flock = bats;
        if (cycle) {
            cycle.totalBats = bats.length;
            cycle.guidedLaunched = 1;
            cycle.launchComplete = true;
            this.activeCommandCycle = null;
        }
        this.simulation.spawnParticleBurst(owner.position.clone(), "#442233", {
            count: 10,
            speed: 160,
            radiusMin: 2,
            radiusMax: 4,
            gravity: 300
        });
        this.simulation.spawnPulse(owner.position.clone(), "#cc3355");
        this.simulation.playSound("shoot", 0.8);
        this.simulation.addLog(`${owner.name} releases a swarm of bats!`);
    }

    getCommandState() {
        if (!this._canAcceptPlayerCommand()) return { available: false, reserveResource: false };
        return { available: Boolean(this.commandWindow), reserveResource: !this.commandWindow };
    }

    prepareCommand(intent) {
        if (!this.commandWindow || !this._isCommandEligible()) return intent;
        const direction = this._getCommandDirection(intent);
        const target = this._selectCommandTarget(intent.predictedTerminal, this.commandWindow.target);
        this.preparedCommand = {
            ...intent,
            direction: { x: direction.x, y: direction.y },
            pathSegments: intent.pathSegments?.map((point) => ({ ...point })) ?? [],
            bouncePoints: intent.bouncePoints?.map((point) => ({ ...point })) ?? [],
            target
        };
        this.commandWindow = null;
        return this.preparedCommand;
    }

    resolveCommandLaunch(intent) {
        const command = this.preparedCommand;
        this.preparedCommand = null;
        if (!command || command.sequence !== intent?.sequence) return { mode: "default-shot" };
        const cycle = {
            commandSequence: command.sequence,
            tier: this.abilityTier,
            targetId: command.target.id,
            pathSegments: command.pathSegments.map((point) => ({ ...point })),
            totalBats: 0,
            settledBats: 0,
            leadBites: 0,
            totalBites: 0,
            terminalBites: 0,
            bloodMarks: 0,
            ruptures: 0,
            actualDamage: 0,
            actualHealing: 0,
            plannedSegments: command.pathSegments.length,
            plannedBounces: command.bouncePoints.length,
            createdAt: command.createdAt ?? this.simulation.elapsed,
            reason: "pending",
            launchComplete: false,
            finalized: false,
            guidedLaunched: 0
        };
        this.commandCycles.set(command.sequence, cycle);
        this.activeCommandCycle = cycle;
        this._launchBats(command.target, cycle);
        return { mode: "default-shot" };
    }

    onCommandEnd(event) {
        if (this.preparedCommand?.sequence === event.commandSequence) this.preparedCommand = null;
    }

    onOwnerDefeated() {
        this.commandWindow = null;
        this.preparedCommand = null;
        this._finalizeAllCommandCycles("owner-defeat");
        return false;
    }

    onBattleEnded() {
        this.commandWindow = null;
        this.preparedCommand = null;
        this._finalizeAllCommandCycles("battle-ended");
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

    _selectCommandTarget(predictedTerminal, fallbackTarget) {
        if (!predictedTerminal) return fallbackTarget;
        const terminal = new Vector2(predictedTerminal.x, predictedTerminal.y);
        return (
            this.simulation
                .getEnemiesOf(this.owner)
                .filter((target) => !target.flags.defeated)
                .find(
                    (target) =>
                        Vector2.subtract(target.position, terminal).length() <= this.owner.radius + target.radius + 8
                ) ?? fallbackTarget
        );
    }

    _recordBatOutcome(cycle, outcome) {
        if (!cycle || cycle.finalized) return;
        cycle.settledBats += 1;
        cycle.leadBites += outcome.commandGuided ? outcome.bites : 0;
        cycle.totalBites += outcome.bites;
        cycle.terminalBites += outcome.terminalBites;
        cycle.actualDamage += outcome.actualDamage;
        cycle.actualHealing += outcome.actualHealing;
    }

    _recordBloodMark(cycle) {
        if (cycle && !cycle.finalized) cycle.bloodMarks += 1;
    }

    _recordRupture(cycle, result) {
        if (!cycle || cycle.finalized) return;
        cycle.ruptures += 1;
        cycle.actualDamage += result.actualDamage;
        cycle.actualHealing += result.healedAmount;
    }

    _finalizeCommandCycles() {
        for (const [sequence, cycle] of this.commandCycles) {
            if (!cycle.launchComplete || cycle.settledBats < cycle.totalBats) continue;
            cycle.reason = cycle.terminalBites > 0 ? "completed" : "no-terminal-bite";
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
            resultType: "vampire-command-blood-route",
            success: cycle.terminalBites > 0,
            value: {
                tier: cycle.tier,
                totalBats: cycle.totalBats,
                settledBats: cycle.settledBats,
                leadBites: cycle.leadBites,
                totalBites: cycle.totalBites,
                terminalBites: cycle.terminalBites,
                bloodMarks: cycle.bloodMarks,
                ruptures: cycle.ruptures,
                actualDamage: cycle.actualDamage,
                actualHealing: cycle.actualHealing,
                plannedSegments: cycle.plannedSegments,
                plannedBounces: cycle.plannedBounces,
                elapsed: Math.max(0, this.simulation.elapsed - cycle.createdAt),
                reason: cycle.reason
            }
        });
        this.commandCycles.delete(sequence);
        if (this.activeCommandCycle === cycle) this.activeCommandCycle = null;
    }

    dealVampireDamage(target, rawDamage, label, { projectile = null } = {}) {
        if (rawDamage <= 0 || target.flags.defeated || !this.simulation.isHostile(this.owner, target)) {
            return { actualDamage: 0, healedAmount: 0 };
        }
        const finalDamage = projectile
            ? (target.actionContext?.onProjectileDamage?.(
                  rawDamage,
                  projectile,
                  this.owner,
                  label,
                  this.simulation,
                  target
              ) ?? rawDamage)
            : rawDamage;
        const { actualDamage } = target.takeDamage(finalDamage, this.owner, label);
        const healedAmount = actualDamage > 0 ? this.owner.heal(actualDamage * BAT_DAMAGE_LIFESTEAL_RATE) : 0;
        if (healedAmount > 0) {
            this.simulation.spawnActionText(this.owner.position.clone(), `+${healedAmount} HP`, "#ff426d");
        }
        return { actualDamage, healedAmount };
    }

    onBatBite(target, contactPoint, projectile = null) {
        if (!this.getLevelUpgrade().bloodPull || target.flags.defeated) return false;
        if (this._bloodPullCooldowns.has(target)) return false;

        const pullDirection = Vector2.subtract(this.owner.position, target.position);
        if (pullDirection.length() > 0) {
            target.applyImpulse(pullDirection.normalize().scale(BLOOD_PULL_SPEED));
        }
        this._bloodPullCooldowns.start(target, BLOOD_PULL_COOLDOWN);
        this._setBloodMark(target, projectile?.commandCycle ?? null);
        this.simulation.entities.push(new BloodTetherEffect(contactPoint, this.owner));
        return true;
    }

    _setBloodMark(target, cycle = null) {
        const previous = this._bloodMarks.get(target);
        if (previous) previous.effect.isExpired = true;
        const effect = new BloodMarkEffect(target, BLOOD_MARK_DURATION);
        this._bloodMarks.set(target, { remaining: BLOOD_MARK_DURATION, effect, cycle });
        this._recordBloodMark(cycle);
        this.simulation.entities.push(effect);
    }

    getBloodMarkRemaining(target) {
        return Math.max(0, this._bloodMarks.get(target)?.remaining ?? 0);
    }

    onCollision(target, context) {
        this._applyBodyCollisionLifesteal(target, context?.contactPoint);
        this._consumeBloodMark(target, context?.contactPoint);
    }

    _applyBodyCollisionLifesteal(target, contactPoint) {
        const owner = this.owner;
        const damage = this._getCollisionDamage(owner, target, contactPoint);
        if (damage <= 0) return;
        const hpRatio = owner.hp / owner.maxHp;
        const rate = hpRatio < LOW_HP_THRESHOLD ? LIFESTEAL_RATE_LOW_HP : LIFESTEAL_RATE_NORMAL;
        const healAmount = Math.max(1, Math.round(damage * rate));
        owner.heal(healAmount);
        this.simulation.spawnActionText(owner.position.clone(), `+${healAmount} HP`, "#ff4466");
    }

    _consumeBloodMark(target, contactPoint) {
        const mark = this._bloodMarks.get(target);
        if (!mark || mark.remaining <= 0 || !this._isDirectContact(target)) return;
        this._bloodMarks.delete(target);
        mark.effect.isExpired = true;
        const position = contactPoint?.clone?.() ?? Vector2.add(this.owner.position, target.position).scale(0.5);
        const damageResult = this.dealVampireDamage(
            target,
            this.owner.stats.baseDamage * BLOOD_RUPTURE_DAMAGE_MULTIPLIER,
            "Blood Rupture"
        );
        this._recordRupture(mark.cycle, damageResult);
        this.simulation.entities.push(new BloodRuptureEffect(position));
        this.simulation.spawnParticleBurst(position, "#b5123f", {
            count: 12,
            speed: 190,
            radiusMin: 1,
            radiusMax: 4,
            gravity: 260
        });
    }

    _isDirectContact(target) {
        return (
            Vector2.subtract(target.position, this.owner.position).length() <= this.owner.radius + target.radius + 10
        );
    }

    _getCollisionDamage(owner, target, contactPoint) {
        const dist = Vector2.subtract(target.position, owner.position).length();
        if (dist > owner.radius + target.radius + 10) return 0;
        const relativeSpeed = Vector2.subtract(target.velocity, owner.velocity).length();
        const baseDamage = Math.round(
            owner.stats.baseDamage * 0.5 * Math.min(3, relativeSpeed / owner.stats.baseSpeed)
        );
        if (!contactPoint || baseDamage <= 0) return baseDamage;
        return applyRotationalContactDamage(baseDamage, owner, contactPoint);
    }

    getStatModifiers() {
        return { speed: 1, damage: 1, defense: 1, impact: 1.15 };
    }

    draw(ctx) {
        const owner = this.owner;
        const hpRatio = owner.hp / owner.maxHp;
        if (hpRatio >= LOW_HP_THRESHOLD) return;
        ctx.save();
        ctx.strokeStyle = "#ff4466";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3 + (1 - hpRatio / LOW_HP_THRESHOLD) * 0.4;
        ctx.beginPath();
        ctx.arc(owner.position.x, owner.position.y, owner.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.2, -0.06, 0.055);
        this._dotEye(ctx, ball, 0.2, -0.06, 0.055);
        this._arc(ctx, ball, 0, 0.22, 0.18, 0.2, Math.PI - 0.2);
        this._line(ctx, ball, [
            [-0.15, 0.18],
            [-0.08, 0.28]
        ]);
        this._line(ctx, ball, [
            [0.08, 0.28],
            [0.15, 0.18]
        ]);
        return true;
    }

    getUiState() {
        if (this.commandWindow) {
            return { label: "혈로", text: "선두 박쥐가 경로를 유도", progress: this.cooldownProgress };
        }
        return {
            label: "Bats",
            progress: this.cooldownProgress
        };
    }
}
