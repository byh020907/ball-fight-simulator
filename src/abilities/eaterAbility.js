import { DashEffect, WallSlamEffect } from "../combatEffects.js";
import { steerBallToward, Vector2 } from "../core.js";
import { EaterDigestEffect, EaterSpitEffect, EaterWallRuptureEffect } from "../effects/index.js";
import { Ability } from "./ability.js";

const FEAST_DURATION = 4.0;
const SWALLOW_HOLD_DURATION = 0.72;
const DEFENSE_MULT_DURING_FEAST = 1.5;
const SPIT_DASH_MULTIPLIER = 2;
const SPIT_SPEED_MULTIPLIER = 2;
const SPIT_MAX_DURATION = 2.45;
const FEAST_HOMING_TURN_RATE = 3.5;

const DIGEST_TICK_COUNT = 6;
const DIGEST_TICK_INTERVAL = 0.12;
const DIGEST_DAMAGE_PER_TICK = 0.12;
const SPIT_LEVEL6_DAMAGE_MULT = 1.0;
const SPIT_LEVEL6_SPEED_MULT = 3.0;
const SPIT_LEVEL6_RECOIL = 420;

const WALL_RUPTURE_RADIUS = 150;
const WALL_RUPTURE_TARGET_MULT = 1.5;
const WALL_RUPTURE_OTHER_MULT = 0.75;

export class EaterAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 4.5);
        this.state = {
            feastTimer: 0,
            feastElapsed: 0,
            radiusScale: 1,
            swallowedTarget: null,
            swallowTimer: 0,
            spitDirection: new Vector2(1, 0),
            hasEatenThisFeast: false,
            digestionTimer: 0,
            digestionTick: 0,
            digestionEffect: null,
            lv9WallRuptureUsed: false,
            commandAiming: false,
            preparedCommand: null,
            commandCycles: new Map()
        };
        this.feastDuration = FEAST_DURATION;
    }

    isFeasting() {
        return this.state.feastTimer > 0 && !this.state.hasEatenThisFeast;
    }

    update(delta, target) {
        this.updateRadiusScale(delta);

        if (this.state.swallowedTarget) {
            const aiming = this.simulation.dragCombat?.input?.state === "aiming";
            if (aiming && this._canAcceptPlayerCommand()) this.state.commandAiming = true;
            if (this.state.commandAiming && !aiming) {
                this.state.commandAiming = false;
                this.releaseSwallowed();
                return;
            }
            if (!this.state.commandAiming) this.state.swallowTimer -= delta;
            this.state.swallowedTarget.position = this.owner.position.clone();
            this._tickDigestion(delta);
            if (this.state.swallowTimer <= 0 || this.state.swallowedTarget.flags.defeated) {
                this.releaseSwallowed();
            }
        }

        this._finalizeCommandCycles();

        if (this.isFeasting()) {
            this.state.feastTimer = Math.max(0, this.state.feastTimer - delta);
            this.state.feastElapsed = Math.min(this.feastDuration, this.state.feastElapsed + delta);

            if (target && !target.flags.defeated && !this.state.swallowedTarget) {
                steerBallToward(this.owner, target, delta, {
                    turnRate: FEAST_HOMING_TURN_RATE,
                    persist: true
                });
            }

            if (this.state.feastTimer > 0 && !this.state.swallowedTarget && Math.random() < delta * 8) {
                this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
                    count: 1,
                    speed: 80,
                    radiusMin: 3,
                    radiusMax: 5,
                    upBias: 70,
                    gravity: 720,
                    life: 0.8
                });
            }
            return;
        }

        if (!this.state.swallowedTarget) {
            this.tickCooldown(delta);
        }

        if (this.cooldownReady && target) {
            this.resetCooldown(this.cooldown);
            this.state.feastTimer = this.feastDuration;
            this.state.feastElapsed = 0;
            this.state.hasEatenThisFeast = false;
            this.state.lv9WallRuptureUsed = false;
            this.simulation.playSound("chomp", 0.8);
            this.simulation.spawnPulse(this.owner.position.clone(), this.owner.color);
            this.simulation.addLog(`${this.owner.name} enters feast mode.`);
        }
    }

    _tickDigestion(delta) {
        if (this.abilityTier < 1) return;
        this.state.digestionTimer += delta;
        while (this.state.digestionTimer >= DIGEST_TICK_INTERVAL && this.state.digestionTick < DIGEST_TICK_COUNT) {
            this.state.digestionTimer -= DIGEST_TICK_INTERVAL;
            const target = this.state.swallowedTarget;
            if (target && !target.flags.defeated) {
                const dmg = Math.round(this.owner.stats.baseDamage * DIGEST_DAMAGE_PER_TICK);
                const { actualDamage } = target.takeDamage(dmg, this.owner, "Digestion");
                this.owner.heal(actualDamage);
                this._emitDigestionFeedback(target);
            }
            this.state.digestionTick++;
        }
    }

    _emitDigestionFeedback(target) {
        this.state.digestionEffect?.registerTick();
    }

    getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: this.isFeasting() ? DEFENSE_MULT_DURING_FEAST : 1, impact: 1 };
    }

    onCollision(target) {
        if (
            !this.isFeasting() ||
            this.state.hasEatenThisFeast ||
            this.state.swallowedTarget ||
            target.state.swallowed ||
            target.flags.defeated
        ) {
            return;
        }

        this.state.hasEatenThisFeast = true;
        this.state.feastTimer = 0;
        this.state.swallowedTarget = target;
        this.state.swallowTimer = this._getSwallowHoldDuration();
        this.state.spitDirection =
            this.owner.velocity.length() > 0
                ? this.owner.velocity.clone().normalize()
                : Vector2.subtract(target.position, this.owner.position).normalize();
        this.state.digestionTimer = 0;
        this.state.digestionTick = 0;

        target.state.swallowed = { owner: this.owner };
        target.clearDash();
        target.applyImpulse(target.velocity.clone().scale(-1));
        this.state.digestionEffect = new EaterDigestEffect(this.owner, target);
        this.simulation.entities.push(this.state.digestionEffect);
        this.simulation.playSound("chomp", 1.25);
        this.simulation.spawnParticleBurst(target.position.clone(), this.owner.color, {
            count: 30,
            speed: 230,
            radiusMin: 3,
            radiusMax: 6,
            upBias: 30,
            gravity: 940,
            life: 1.35
        });
        this.simulation.addLog(`${this.owner.name} swallows ${target.name}.`);
    }

    getCommandState() {
        if (!this._canAcceptPlayerCommand() || !this._isValidTarget(this.state.swallowedTarget)) {
            return { available: false, reserveResource: false };
        }
        return { available: true, reserveResource: false };
    }

    prepareCommand(intent) {
        const target = this.state.swallowedTarget;
        if (!this._canLaunchCommand(target)) return intent;
        this.state.preparedCommand = {
            ...intent,
            direction: { ...intent.direction },
            pathSegments: intent.pathSegments?.map((point) => ({ ...point })) ?? [],
            bouncePoints: intent.bouncePoints?.map((point) => ({ ...point })) ?? [],
            target
        };
        this.state.commandAiming = false;
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
            tier: this.abilityTier,
            target: command.target,
            digestionTicksAtLaunch: this.state.digestionTick,
            holdRemaining: Math.max(0, this.state.swallowTimer),
            plannedSegments: command.pathSegments.length,
            plannedBounces: command.bouncePoints.length,
            wallHit: false,
            wallSlamDamage: 0,
            spitImpactDamage: 0,
            ruptureTriggered: false,
            ruptureTargetDamage: 0,
            ruptureSplashHits: 0,
            ruptureSplashDamage: 0,
            createdAt: command.createdAt ?? this.simulation.elapsed,
            finalized: false
        };
        this.state.commandCycles.set(command.sequence, cycle);
        this.state.preparedCommand = null;
        this.releaseSwallowed({ direction, commandSequence: command.sequence, cycle });
        return { mode: "replace-shot" };
    }

    releaseSwallowed({ direction = null, commandSequence = null, cycle = null } = {}) {
        const target = this.state.swallowedTarget;
        this._clearSwallowedCommandState();
        if (!target) return;

        this.resetCooldown(this.cooldown);

        if (target.flags.defeated) {
            this._detachSwallowedTarget();
            return;
        }

        const spitDirection = direction?.clone?.().normalize?.() ?? this.state.spitDirection.clone().normalize();
        if (spitDirection.length() <= 0.001) spitDirection.x = 1;
        this.state.spitDirection = spitDirection.clone();
        const { direction: releasedDirection } = this._detachSwallowedTarget({ reposition: true });

        let spitSpeedMult = SPIT_SPEED_MULTIPLIER;
        if (this.abilityTier >= 2) {
            spitSpeedMult = SPIT_LEVEL6_SPEED_MULT;
            const spitDmg = Math.round(this.owner.stats.baseDamage * SPIT_LEVEL6_DAMAGE_MULT);
            const { actualDamage: spitImpactDamage = 0 } = target.takeDamage(spitDmg, this.owner, "Spit Impact") ?? {};
            const recoilDir = releasedDirection.clone().scale(-1);
            this.owner.applyImpulse(recoilDir.scale(SPIT_LEVEL6_RECOIL));
            this.simulation.entities.push(new EaterSpitEffect(this.owner, target, releasedDirection));
            if (cycle) cycle.spitImpactDamage = spitImpactDamage;
        }

        target.initiateDash(releasedDirection, {
            duration: SPIT_MAX_DURATION,
            multiplier: SPIT_DASH_MULTIPLIER,
            speedOverride: target.stats.baseSpeed * spitSpeedMult,
            collisionLabel: "Spit Dash",
            showRing: false,
            noHeading: true,
            commandSequence
        });
        target.state.wallSlam = new WallSlamEffect({
            source: this.owner,
            duration: SPIT_MAX_DURATION,
            onRupture:
                this.abilityTier >= 3 ? (collisionCtx) => this._onWallRupture(target, collisionCtx, cycle) : null,
            onImpact: (collisionCtx) => this._onWallSlamImpact(collisionCtx, cycle)
        });
        this.simulation.keepInsideArena(target);
        this.simulation.playSound("spit", 1.2);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), this.owner.color);
        this.simulation.addSparkBurst(target.position.clone(), this.owner.color);
        this.simulation.addLog(`${this.owner.name} spits ${target.name} into the walls.`);
    }

    onOwnerDefeated() {
        this._finalizeAllCommandCycles();
        const released = this._detachSwallowedTarget({ reposition: true });
        if (released?.target && !released.target.flags.defeated) {
            this.simulation.addLog(`${this.owner.name} drops ${released.target.name}.`);
        }
        return false;
    }

    onBattleEnded() {
        this._detachSwallowedTarget();
        this._finalizeAllCommandCycles();
    }

    _detachSwallowedTarget({ reposition = false } = {}) {
        const target = this.state.swallowedTarget;
        this._clearSwallowedCommandState();
        if (!target) return null;

        const direction = this.state.spitDirection.clone().normalize();
        if (direction.length() === 0) direction.x = 1;
        target.state.swallowed = null;
        this.state.digestionEffect?.finish();
        this.state.digestionEffect = null;
        this.state.swallowedTarget = null;
        this.state.swallowTimer = 0;

        if (reposition && !target.flags.defeated) {
            target.position = Vector2.add(
                this.owner.position,
                direction.clone().scale(this.owner.radius + target.radius + 10)
            );
            this.simulation.keepInsideArena(target);
        }

        return { target, direction };
    }

    _onWallSlamImpact(collisionCtx, cycle) {
        if (!cycle || cycle.finalized || collisionCtx.actualDamage <= 0) return;
        cycle.wallHit = true;
        cycle.wallSlamDamage += collisionCtx.actualDamage;
        this._finalizeCommandCycle(cycle.commandSequence);
    }

    _onWallRupture(target, collisionCtx, cycle = null) {
        if (this.state.lv9WallRuptureUsed) return;
        this.state.lv9WallRuptureUsed = true;

        const contactPoint = collisionCtx?.contactPoint ?? target.position.clone();
        const normal = collisionCtx?.normal ?? null;
        const targetDmg = Math.round(this.owner.stats.baseDamage * WALL_RUPTURE_TARGET_MULT);
        const { actualDamage: targetActualDamage = 0 } = target.takeDamage(targetDmg, this.owner, "Wall Rupture") ?? {};
        if (cycle) {
            cycle.ruptureTriggered = true;
            cycle.ruptureTargetDamage += targetActualDamage;
        }

        const otherDmg = Math.round(this.owner.stats.baseDamage * WALL_RUPTURE_OTHER_MULT);
        const enemies = this.simulation.getEnemiesOf(this.owner);
        for (const enemy of enemies) {
            if (enemy === target) continue;
            const dist = Vector2.subtract(enemy.position, contactPoint).length();
            if (dist <= WALL_RUPTURE_RADIUS) {
                const { actualDamage = 0 } = enemy.takeDamage(otherDmg, this.owner, "Wall Rupture") ?? {};
                if (cycle && actualDamage > 0) {
                    cycle.ruptureSplashHits += 1;
                    cycle.ruptureSplashDamage += actualDamage;
                }
            }
        }

        this.simulation.shakeScreen(0.3, 20);
        this.simulation.playSound("wall", 1.35);
        this.simulation.playSound("explosion", 0.75);

        if (normal) {
            this.simulation.entities.push(
                new EaterWallRuptureEffect(
                    new Vector2(contactPoint.x, contactPoint.y),
                    new Vector2(normal.x, normal.y),
                    this.owner.color,
                    WALL_RUPTURE_RADIUS
                )
            );
        }

        this.simulation.addLog(`${this.owner.name} triggers wall rupture!`);
    }

    _getSwallowHoldDuration() {
        return SWALLOW_HOLD_DURATION;
    }

    updateRadiusScale(delta) {
        const targetScale = this.state.swallowedTarget ? 1.5 : 1;
        const smoothing = 1 - Math.exp(-delta * (targetScale > this.state.radiusScale ? 4.8 : 7.2));
        this.state.radiusScale += (targetScale - this.state.radiusScale) * smoothing;
        if (Math.abs(this.state.radiusScale - 1) < 0.01 && targetScale === 1) {
            this.state.radiusScale = 1;
        }
    }

    getRadiusScale() {
        return Math.max(1, Math.min(1.5, this.state.radiusScale));
    }

    draw(ctx) {
        if (!this.isFeasting()) return;

        const pos = this.owner.position;
        const r = this.owner.radius;
        const target = this.getMouthTarget();
        const mouthAngle = target
            ? Math.atan2(target.position.y - pos.y, target.position.x - pos.x)
            : Math.atan2(this.owner.velocity.y, this.owner.velocity.x);
        const mouthOpen = 0.5 + Math.sin(performance.now() / 95) * 0.12;

        ctx.save();
        ctx.fillStyle = "#fafafa";
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.arc(pos.x, pos.y, r + 3, mouthAngle - mouthOpen, mouthAngle + mouthOpen);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(
            pos.x + Math.cos(mouthAngle - mouthOpen) * (r + 8),
            pos.y + Math.sin(mouthAngle - mouthOpen) * (r + 8)
        );
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(
            pos.x + Math.cos(mouthAngle + mouthOpen) * (r + 8),
            pos.y + Math.sin(mouthAngle + mouthOpen) * (r + 8)
        );
        ctx.stroke();
        ctx.restore();
    }

    getMouthTarget() {
        return this.simulation.getOpponent(this.owner);
    }

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.22, -0.12, 0.06);
        this._dotEye(ctx, ball, 0.22, -0.12, 0.06);
        this._arc(ctx, ball, 0, 0.14, 0.24, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        if (this.state.swallowedTarget) {
            return {
                label: this.getCommandState().available ? "Aim Spit" : "Eating",
                progress: Math.max(0, Math.min(1, this.state.swallowTimer / this._getSwallowHoldDuration()))
            };
        }
        if (this.state.feastTimer > 0) {
            return { label: "Feast", progress: Math.max(0, Math.min(1, this.state.feastTimer / this.feastDuration)) };
        }
        return { label: "Feast", progress: this.cooldownProgress };
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
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            this.simulation.dragCombat &&
            !this.simulation.dragCombat.automated &&
            this._isValidTarget(target) &&
            target === this.state.swallowedTarget
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
        const direction = new Vector2(command.direction?.x ?? 0, command.direction?.y ?? 0);
        if (direction.length() > 0.001) return direction.normalize();
        return this.state.spitDirection.clone().normalize();
    }

    _finalizeCommandCycles() {
        for (const [sequence, cycle] of this.state.commandCycles) {
            if (!this._isValidTarget(cycle.target) || cycle.target.state.wallSlam?.source !== this.owner) {
                this._finalizeCommandCycle(sequence);
            }
        }
    }

    _finalizeAllCommandCycles() {
        for (const sequence of [...this.state.commandCycles.keys()]) this._finalizeCommandCycle(sequence);
    }

    _finalizeCommandCycle(sequence) {
        const cycle = this.state.commandCycles.get(sequence);
        if (!cycle || cycle.finalized) return;
        cycle.finalized = true;
        this.recordAbilityResult({
            commandSequence: sequence,
            resultType: "eater-command-spit-route",
            success: cycle.wallHit,
            value: {
                tier: cycle.tier,
                digestionTicksAtLaunch: cycle.digestionTicksAtLaunch,
                holdRemaining: cycle.holdRemaining,
                plannedSegments: cycle.plannedSegments,
                plannedBounces: cycle.plannedBounces,
                wallHit: cycle.wallHit,
                wallSlamDamage: cycle.wallSlamDamage,
                spitImpactDamage: cycle.spitImpactDamage,
                ruptureTriggered: cycle.ruptureTriggered,
                ruptureTargetDamage: cycle.ruptureTargetDamage,
                ruptureSplashHits: cycle.ruptureSplashHits,
                ruptureSplashDamage: cycle.ruptureSplashDamage,
                elapsed: Math.max(0, this.simulation.elapsed - cycle.createdAt)
            }
        });
        this.state.commandCycles.delete(sequence);
    }

    _clearSwallowedCommandState() {
        this.state.commandAiming = false;
        this.state.preparedCommand = null;
    }
}
