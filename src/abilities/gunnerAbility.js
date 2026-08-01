import { Vector2 } from "../core.js";
import { BURST_RESULTS, BurstSequencer } from "../game-kit/physics/index.js";
import { Ability } from "./ability.js";
import { BulletProjectile, GunnerTurret } from "../entities/index.js";
import { enforceActiveEntityLimit } from "../entities/activeEntityLimit.js";
import { findGunnerTurretPlacement } from "./gunnerTurretPlacement.js";

const GUNNER_COOLDOWN = 4;
const BULLET_INTERVAL = 0.05;
const BULLET_SPEED_MULT = 2.0;
const MIN_BULLETS = 6;
const MAX_BULLETS = 12;
const MAX_FIELD_BULLETS = 20;
const KNOCKBACK_STRENGTH = 0.25;
const KNOCKBACK_DURATION = 0.15;
const FINISHER_CHARGE_DURATION = 0.16;
const TURRET_STACK_REQUIREMENT = 20;
const COMMAND_WINDOW_DURATION = 0.8;

export class GunnerAbility extends BurstSequencer(Ability) {
    constructor(owner, simulation) {
        super(owner, simulation, GUNNER_COOLDOWN);
        this.state = {
            burstBulletCount: 0,
            burstIndex: 0,
            gunHand: 0,
            spinAngle: 0,
            activeBullets: [],
            collectionStacks: 0,
            turret: null
        };
        this.turretMovementMode = "fixed";
        this.finisherCharge = null;
        this.commandWindow = null;
        this.preparedCommand = null;
        this.commandCycles = new Map();
        this.activeCommandCycle = null;
    }

    update(delta, target) {
        const time = performance.now() / 1000;
        this.state.spinAngle = Math.sin(time * 4) * 0.5;

        if (this.isBursting) {
            this.state.spinAngle = time * 12;
            this.tickBurst(delta, () => this._fireBurstBullet());
            this._finalizeCommandCycles();
            return;
        }

        this.tickCooldown(delta);
        this._finalizeCommandCycles();
        if (this.commandWindow) {
            const aiming = this.simulation.dragCombat?.input?.state === "aiming";
            if (aiming) this.commandWindow.wasAiming = true;
            const fallbackTarget = this._getFallbackTarget(target);
            if (!this._canAcceptPlayerCommand() || !fallbackTarget || (!aiming && this.commandWindow.wasAiming)) {
                this.commandWindow = null;
                if (fallbackTarget) {
                    this.resetCooldown(this.cooldown);
                    this._startBurst();
                }
                return;
            }
            if (!aiming) this.commandWindow.remaining = Math.max(0, this.commandWindow.remaining - delta);
            if (aiming || this.commandWindow.remaining > 0) return;
            this.commandWindow = null;
            this.resetCooldown(this.cooldown);
            this._startBurst();
            return;
        }
        if (this.cooldownReady && target) {
            if (this._canAcceptPlayerCommand()) {
                this.commandWindow = { target, remaining: COMMAND_WINDOW_DURATION, wasAiming: false };
                return;
            }
            this.resetCooldown(this.cooldown);
            this._startBurst();
        }
    }

    _startBurst() {
        this.state.burstBulletCount = MIN_BULLETS + Math.floor(Math.random() * (MAX_BULLETS - MIN_BULLETS + 1));
        this.state.burstIndex = 0;
        this.state.gunHand = 0;
        this.startBurst(this.state.burstBulletCount, BULLET_INTERVAL);
        this.simulation.spawnPulse(this.owner.position.clone(), "#ffee88");
        this.simulation.addLog(
            `${this.owner.name} fires ${this.state.burstBulletCount} bullet${this.state.burstBulletCount > 1 ? "s" : ""}!`
        );
        this.simulation.playSound("shoot", 0.9);
    }

    _fireBurstBullet() {
        if (!this.isBursting) return BURST_RESULTS.CANCELLED;

        const owner = this.owner;
        const bulletCount = this.state.burstBulletCount;
        const dmgMult = 0.2 + (bulletCount / MAX_BULLETS) * 0.8;
        const isLast = this.state.burstIndex === bulletCount - 1;
        const finisherMinimum = this.getLevelUpgrade().everyBurstFinisher ? MIN_BULLETS : MAX_BULLETS;
        const isFinisher = isLast && bulletCount >= finisherMinimum;
        const finalMult = isFinisher ? dmgMult * 2 : dmgMult;
        if (isFinisher && !this.finisherCharge) {
            this._beginFinisherCharge();
            return BURST_RESULTS.PAUSED;
        }

        const hand = isFinisher ? this.finisherCharge.hand : this.state.gunHand;
        const muzzle = this._getGunPosition(hand);
        const cycle = this.activeCommandCycle;
        const guided = Boolean(cycle && (this.state.burstIndex === 0 || isFinisher));
        const direction = guided
            ? cycle.direction.clone()
            : isFinisher
              ? this.finisherCharge.direction
              : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        if (isFinisher) this.finisherCharge = null;

        const speed = owner.stats.baseSpeed * BULLET_SPEED_MULT;
        const cdReduction = GUNNER_COOLDOWN / 2 / MAX_BULLETS;
        const bullet = new BulletProjectile(
            owner,
            muzzle,
            direction.clone().scale(speed),
            finalMult,
            isFinisher,
            cdReduction,
            this,
            {
                commandGuided: guided,
                commandCycle: cycle,
                commandShotIndex: this.state.burstIndex,
                commandTerminalTargetId: cycle?.targetId ?? null,
                onSettled: cycle ? (outcome) => this._recordBulletOutcome(cycle, outcome) : null
            }
        );
        this.state.activeBullets = this.state.activeBullets.filter((b) => !b.isExpired);
        this.state.activeBullets.push(bullet);
        this.state.activeBullets = enforceActiveEntityLimit(this.state.activeBullets, MAX_FIELD_BULLETS);
        this.simulation.entities.push(bullet);
        if (guided) {
            if (isFinisher) cycle.finisherEligible = true;
            cycle.guidedLaunched += 1;
        }

        this.simulation.spawnSlash(
            muzzle.clone(),
            Vector2.add(muzzle, direction.clone().scale(isFinisher ? 55 : 35)),
            isFinisher ? "#ff4488" : "#ffee88"
        );
        this.simulation.spawnParticleBurst(muzzle, isFinisher ? "#ff4488" : "#ffdd44", {
            count: isFinisher ? 10 : 4,
            speed: isFinisher ? 200 : 120,
            radiusMin: 1,
            radiusMax: isFinisher ? 4 : 2,
            gravity: 0,
            life: isFinisher ? 0.3 : 0.15
        });

        this.state.burstIndex++;
        this.state.gunHand = 1 - this.state.gunHand;

        if (isFinisher) {
            this.simulation.addLog(`${owner.name} lands a full burst!`);
        }
        if (this.state.burstIndex >= bulletCount && cycle) {
            cycle.launchComplete = true;
            if (this.activeCommandCycle === cycle) this.activeCommandCycle = null;
        }
        return BURST_RESULTS.FIRED;
    }

    _getGunPosition(hand) {
        const gunAngle = this.state.spinAngle + (hand === 0 ? 0 : Math.PI);
        return new Vector2(
            this.owner.position.x + Math.cos(gunAngle) * (this.owner.radius + 10),
            this.owner.position.y + Math.sin(gunAngle) * (this.owner.radius + 10)
        );
    }

    _beginFinisherCharge() {
        const hand = this.state.gunHand;
        const cycle = this.activeCommandCycle;
        const direction = cycle?.direction?.clone() ?? Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const muzzle = this._getGunPosition(hand);
        this.finisherCharge = { hand, direction };
        this._burstTimer = FINISHER_CHARGE_DURATION;
        this.simulation.spawnPulse(muzzle, "#ff4488");
        this.simulation.spawnParticleBurst(muzzle, "#ff4488", {
            count: 8,
            speed: 80,
            radiusMin: 1,
            radiusMax: 3,
            gravity: 0,
            life: FINISHER_CHARGE_DURATION
        });
    }

    onBulletCollected(bullet, simulation) {
        if (!bullet.canStack || bullet.isRefire) return;
        const upgrade = this.getLevelUpgrade();
        if (upgrade.refireOnCollect) this._spawnRefire(bullet, simulation);
        if (!upgrade.collectionTurret) return;
        this.state.collectionStacks += 1;
        if (this.state.collectionStacks < TURRET_STACK_REQUIREMENT) return;
        this.state.collectionStacks = 0;
        this._deployTurret(simulation, bullet.commandCycle);
    }

    _spawnRefire(sourceBullet, simulation) {
        const cycle = sourceBullet.commandCycle;
        const target = cycle
            ? this._getCommandRefireTarget(sourceBullet, simulation, cycle)
            : simulation.getNearestEnemy(this.owner);
        if (!target) return;
        const anchor = cycle?.bouncePoints?.[0];
        const direction = Vector2.subtract(anchor ?? target.position, this.owner.position);
        if (direction.length() <= 0.001) return;
        direction.normalize();
        const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + 10));
        const bullet = new BulletProjectile(
            this.owner,
            start,
            direction.clone().scale(sourceBullet.velocity.length()),
            sourceBullet.damageMult,
            false,
            0,
            this,
            {
                canBounce: true,
                canCollect: false,
                canRefire: false,
                canStack: false,
                isRefire: true,
                retargetAfterBounce: Boolean(this.getLevelUpgrade().ricochetReload),
                commandGuided: Boolean(cycle),
                commandCycle: cycle,
                commandTerminalTargetId: cycle?.targetId ?? null,
                onSettled: cycle ? (outcome) => this._recordBulletOutcome(cycle, outcome) : null
            }
        );
        if (cycle) cycle.refiresLaunched += 1;
        this.state.activeBullets.push(bullet);
        simulation.entities.push(bullet);
        simulation.spawnPulse(this.owner.position.clone(), "#66f2e2");
        simulation.playSound("shoot", 0.65);
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
            pathSegments: intent.pathSegments ?? [],
            bouncePoints: intent.bouncePoints ?? [],
            target: this.commandWindow.target
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
            direction: new Vector2(command.direction.x, command.direction.y),
            targetId: command.target.id,
            bouncePoints: command.bouncePoints.map((point) => ({ ...point })),
            totalBullets: 0,
            guidedPlanned: 0,
            guidedLaunched: 0,
            settledProjectiles: 0,
            firstShotHit: false,
            finisherEligible: false,
            finisherHit: false,
            refiresLaunched: 0,
            refireHits: 0,
            terminalTargetHits: 0,
            collections: 0,
            turretsDeployed: 0,
            actualDamage: 0,
            plannedSegments: command.pathSegments.length,
            plannedBounces: command.bouncePoints.length,
            createdAt: command.createdAt ?? this.simulation.elapsed,
            reason: "pending",
            launchComplete: false,
            finalized: false
        };
        this.commandCycles.set(command.sequence, cycle);
        this.activeCommandCycle = cycle;
        this.resetCooldown(this.cooldown);
        this._startBurst();
        cycle.totalBullets = this.state.burstBulletCount;
        const finisherMinimum = this.getLevelUpgrade().everyBurstFinisher ? MIN_BULLETS : MAX_BULLETS;
        cycle.guidedPlanned = 1 + (cycle.totalBullets >= finisherMinimum ? 1 : 0);
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
        this.finisherCharge = null;
    }
    _getFallbackTarget(target) {
        return this.commandWindow?.target && !this.commandWindow.target.flags.defeated
            ? this.commandWindow.target
            : target && !target.flags.defeated
              ? target
              : this.simulation.getNearestEnemy(this.owner);
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
    _getCommandRefireTarget(sourceBullet, simulation, cycle) {
        const terminal = simulation
            .getEnemiesOf(this.owner)
            .find((target) => target.id === cycle.targetId && !target.flags.defeated);
        return terminal ?? simulation.getNearestEnemy(this.owner);
    }
    _recordBulletOutcome(cycle, outcome) {
        if (!cycle || cycle.finalized) return;
        cycle.settledProjectiles += 1;
        cycle.actualDamage += outcome.actualDamage;
        cycle.firstShotHit ||= outcome.commandShotIndex === 0 && outcome.hit;
        cycle.finisherHit ||= outcome.isFinisher && outcome.hit;
        cycle.refireHits += outcome.isRefire && outcome.hit ? 1 : 0;
        cycle.terminalTargetHits += outcome.targetId === cycle.targetId && outcome.hit ? 1 : 0;
        cycle.collections += outcome.collected ? 1 : 0;
    }
    _finalizeCommandCycles() {
        for (const [sequence, cycle] of this.commandCycles)
            if (cycle.launchComplete && cycle.settledProjectiles >= cycle.totalBullets + cycle.refiresLaunched) {
                cycle.reason =
                    cycle.firstShotHit || cycle.finisherHit || cycle.refireHits ? "completed" : "no-guided-hit";
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
            resultType: "gunner-command-tracer-line",
            success: cycle.reason === "completed",
            value: {
                totalBullets: cycle.totalBullets,
                guidedPlanned: cycle.guidedPlanned,
                guidedLaunched: cycle.guidedLaunched,
                settledProjectiles: cycle.settledProjectiles,
                firstShotHit: cycle.firstShotHit,
                finisherEligible: cycle.finisherEligible,
                finisherHit: cycle.finisherHit,
                refiresLaunched: cycle.refiresLaunched,
                refireHits: cycle.refireHits,
                terminalTargetHits: cycle.terminalTargetHits,
                collections: cycle.collections,
                turretsDeployed: cycle.turretsDeployed,
                actualDamage: cycle.actualDamage,
                plannedSegments: cycle.plannedSegments,
                plannedBounces: cycle.plannedBounces,
                elapsed: Math.max(0, this.simulation.elapsed - cycle.createdAt),
                reason: cycle.reason
            }
        });
        this.commandCycles.delete(sequence);
    }

    _deployTurret(simulation, cycle = null) {
        if (this.state.turret && !this.state.turret.isExpired) {
            this.state.turret.dismiss(simulation);
        }
        const target = simulation.getNearestEnemy(this.owner);
        const direction = target
            ? Vector2.subtract(target.position, this.owner.position).normalize()
            : Vector2.fromAngle(this.owner.angle ?? 0, 1);
        const position = this._findTurretPlacement(direction, simulation);
        const turret = new GunnerTurret(this.owner, position, {
            movementMode: this.turretMovementMode,
            onDismiss: (dismissedTurret) => {
                if (this.state.turret === dismissedTurret) this.state.turret = null;
            }
        });
        this.state.turret = turret;
        simulation.entities.push(turret);
        simulation.spawnPulse(position, "#66f2e2");
        if (cycle && !cycle.finalized && this.commandCycles.get(cycle.commandSequence) === cycle) {
            cycle.turretsDeployed += 1;
        }
    }

    _findTurretPlacement(direction, simulation) {
        return findGunnerTurretPlacement({
            ownerPosition: this.owner.position,
            owner: this.owner,
            direction,
            arena: simulation,
            entities: simulation.entities,
            terrain: simulation.terrain
        });
    }

    getStatModifiers() {
        return { speed: 0.98, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        const owner = this.owner;
        const time = performance.now() / 1000;

        ctx.save();
        if (this.isBursting) {
            const flash = Math.sin(time * 40) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 238, 136, ${flash * 0.15})`;
            ctx.beginPath();
            ctx.arc(owner.position.x, owner.position.y, owner.radius + 20, 0, Math.PI * 2);
            ctx.fill();
        }

        const r = owner.radius;
        for (const handOffset of [0, Math.PI]) {
            const gunAngle = this.state.spinAngle + handOffset;
            const gx = owner.position.x + Math.cos(gunAngle) * (r + 8);
            const gy = owner.position.y + Math.sin(gunAngle) * (r + 8);
            ctx.strokeStyle = this._burstRemaining > 0 ? "#666666" : "#444444";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + Math.cos(gunAngle) * 14, gy + Math.sin(gunAngle) * 14);
            ctx.stroke();
            ctx.fillStyle = this._burstRemaining > 0 ? "#888888" : "#666666";
            ctx.beginPath();
            ctx.arc(gx + Math.cos(gunAngle) * 14, gy + Math.sin(gunAngle) * 14, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        this._drawFinisherCharge(ctx);

        if (this.getLevelUpgrade().collectionTurret) this._drawCollectionStacks(ctx);
    }

    _drawFinisherCharge(ctx) {
        if (!this.finisherCharge) return;
        const muzzle = this._getGunPosition(this.finisherCharge.hand);
        const progress = 1 - Math.max(0, this._burstTimer) / FINISHER_CHARGE_DURATION;
        ctx.save();
        ctx.fillStyle = "rgba(255, 68, 136, 0.36)";
        ctx.strokeStyle = "#ff4488";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 7 + progress * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    _drawCollectionStacks(ctx) {
        const stacks = this.state.collectionStacks;
        const radius = this.owner.radius + 16;
        ctx.save();
        ctx.strokeStyle = "#66f2e2";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
            this.owner.position.x,
            this.owner.position.y,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + (Math.PI * 2 * stacks) / TURRET_STACK_REQUIREMENT
        );
        ctx.stroke();
        ctx.fillStyle = "#163d40";
        ctx.font = "800 11px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
            `${stacks}/${TURRET_STACK_REQUIREMENT}`,
            this.owner.position.x,
            this.owner.position.y - radius - 5
        );
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._sharpEye(ctx, ball, -0.22, -0.04, 0.5, 0.07);
        this._dotEye(ctx, ball, 0.2, -0.06, 0.04);
        this._arc(ctx, ball, 0.02, 0.26, 0.14, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        if (this.isBursting) {
            return {
                label: `${this.state.burstBulletCount}B x${this.state.burstBulletCount - this.state.burstIndex}`,
                progress: 1 - (this.state.burstIndex % this.state.burstBulletCount) / this.state.burstBulletCount
            };
        }
        return {
            label: this.getLevelUpgrade().collectionTurret ? `${this.state.collectionStacks}/20` : "RNG",
            progress: this.cooldownProgress
        };
    }
}
