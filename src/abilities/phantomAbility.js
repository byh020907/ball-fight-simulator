import { Vector2 } from "../core.js";
import { DashEffect } from "../combatEffects.js";
import { Ability } from "./ability.js";

const PHANTOM_COOLDOWN = 2.5;
const PRIMED_DURATION = 2.5;
const DASH_DURATION = 0.8;
const DASH_MULTIPLIER = 2.5;
const TELEPORT_BEHIND_DIST = 250;
const TELEPORT_CLEARANCE = 12;
const VANISH_DURATION = 0.15;
const APPEAR_DURATION = 0.4;
const SHADOW_DASH_LABEL = "그림자 돌진";
const SHADOW_ACTIVE_LABEL = "그림자 활성화";
const SHADOW_WAIT_LABEL = "그림자 대기";
const TELEPORT_DIRECTION_OFFSETS = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8].map(
    (step) => (step * Math.PI) / 8
);

export class PhantomAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, PHANTOM_COOLDOWN);
        this.state = {
            primed: false,
            primedTimer: 0,
            teleportPhase: 0,
            teleportTimer: 0,
            vanishPos: null,
            appearPos: null,
            teleportTargetId: null,
            pendingShadowStage: null,
            activeDashStage: null,
            markedTargetId: null,
            shadowPursuitStacks: 0,
            shadowReboundStacks: 0,
            shadowFinishStacks: 0,
            skipMarkedCollisionTargetId: null,
            preparedCommand: null,
            commandCycle: null,
            commandCollisionSequences: new Set()
        };
        this.resetCooldown(this.cooldown);
    }

    update(delta, target) {
        const owner = this.owner;
        this._clearExpiredChain();
        if (this.state.activeDashStage && !owner.state.movement) {
            const endedDashStage = this.state.activeDashStage;
            this.state.activeDashStage = null;
            this._resolveCommandDashMiss(endedDashStage);
        }

        // animation phases
        if (this.state.teleportPhase > 0) {
            this._tickTeleport(delta, owner);
            return;
        }

        // primed: waiting for collision or timeout
        if (this.state.primed) {
            this.state.primedTimer -= delta;
            if (this.state.primedTimer <= 0) {
                this.state.primed = false;
                this.state.primedTimer = 0;
                this.setCooldownDuration(this.cooldown);
                this.setCooldownRemaining(this.cooldown);
            }
            return;
        }

        if (this.state.preparedCommand) return;

        // normal cooldown countdown
        this.tickCooldown(delta);
        if (this.cooldownReady) {
            this._clearMark();
            this.state.primed = true;
            this.state.primedTimer = PRIMED_DURATION;
        }
    }

    _tickTeleport(delta, owner) {
        this.state.teleportTimer += delta;

        if (this.state.teleportPhase === 1) {
            const t = Math.min(this.state.teleportTimer / VANISH_DURATION, 1);
            owner.display.scale = 1 - t * t;
            if (this.state.teleportTimer >= VANISH_DURATION) {
                owner.display.scale = 0;
                this._doTeleport();
                this.state.teleportPhase = 2;
                this.state.teleportTimer = 0;
            }
            return;
        }

        if (this.state.teleportPhase === 2) {
            const t = Math.min(this.state.teleportTimer / APPEAR_DURATION, 1);
            owner.display.scale = 1 - Math.exp(-5.5 * t) * Math.cos(11 * t);
            owner.position.x = this.state.appearPos.x;
            owner.position.y = this.state.appearPos.y;

            if (this.state.teleportTimer >= APPEAR_DURATION) {
                owner.display.scale = 1;
                this._startDashAfterTeleport();
                this.state.teleportPhase = 0;
                this.state.teleportTimer = 0;
                this.state.vanishPos = null;
                this.state.appearPos = null;
                this.state.teleportTargetId = null;
            }
            return;
        }
    }

    onCollision(target) {
        if (this.state.teleportPhase > 0) return;
        if (this.owner.state.swallowed || target.state.swallowed) return;

        if (this.state.primed) {
            this.state.primed = false;
            this._triggerShadowDash(target, "base");
            return;
        }

        if (this.state.skipMarkedCollisionTargetId === target.id) {
            this.state.skipMarkedCollisionTargetId = null;
            return;
        }
        if (this.state.activeDashStage || !this._isMarkedTarget(target) || this.state.shadowPursuitStacks <= 0) return;
        this._triggerShadowChain(target, "shadowPursuitStacks");
    }

    getCommandState() {
        if (
            !this.simulation.abilityCommandEnabled ||
            this.simulation.playerBall !== this.owner ||
            this.simulation.dragCombat?.automated
        ) {
            return { available: false, reserveResource: false };
        }
        return { available: this.state.primed, reserveResource: !this.state.primed };
    }

    prepareCommand(intent) {
        if (!this.getCommandState().available || !intent?.direction) return intent;
        this.state.primed = false;
        this.state.primedTimer = 0;
        this.state.preparedCommand = {
            ...intent,
            direction: { ...intent.direction },
            pathSegments: intent.pathSegments?.map((point) => ({ ...point })) ?? [],
            bouncePoints: intent.bouncePoints?.map((point) => ({ ...point })) ?? [],
            predictedTerminal: intent.predictedTerminal ? { ...intent.predictedTerminal } : null
        };
        return this.state.preparedCommand;
    }

    resolveCommandCollision(event) {
        const intent = this.state.preparedCommand;
        if (
            !intent ||
            intent.sequence !== event.commandSequence ||
            this.state.commandCollisionSequences.has(event.commandSequence) ||
            !event.target ||
            !this.simulation.isHostile(this.owner, event.target)
        ) {
            return { handled: false, runDefaultOnCollision: true };
        }

        this.state.commandCollisionSequences.add(event.commandSequence);
        this.state.preparedCommand = null;
        this._beginCommandCycle(event.commandSequence, intent.direction, event.target.id);
        this._triggerShadowDash(event.target, "base", new Vector2(intent.direction.x, intent.direction.y).normalize());
        return { handled: true, runDefaultOnCollision: false };
    }

    onCommandEnd(event) {
        const cycle = this.state.commandCycle;
        if (cycle?.commandSequence === event.commandSequence) return;
        if (this.state.preparedCommand?.sequence !== event.commandSequence) return;
        this.state.preparedCommand = null;
        this.state.commandCollisionSequences.delete(event.commandSequence);
        this._restartCooldownAfterCommandAbort();
    }

    onBattleEnded() {
        if (this.state.commandCycle) this._finalizeCommandCycle();
        this.state.preparedCommand = null;
        this.state.commandCollisionSequences.clear();
    }

    shouldSkipFighterCollision() {
        return this.state.teleportPhase > 0;
    }

    onFighterStaticCollision(fighter, context) {
        if (
            !this.getLevelUpgrade().shadowReboundOnStaticCollision ||
            !this._isMarkedTarget(fighter) ||
            this.state.shadowReboundStacks <= 0 ||
            this.state.teleportPhase > 0 ||
            this.state.activeDashStage
        ) {
            return;
        }
        if (!context.wall && !context.terrain) return;
        this._triggerShadowChain(fighter, "shadowReboundStacks");
    }

    _triggerShadowDash(target, stage, preferredDirection = null) {
        const owner = this.owner;
        const sim = this.simulation;
        if (stage === "base") {
            this.resetCooldown(this.cooldown);
        }

        this.state.vanishPos = owner.position.clone();
        this.state.teleportTargetId = target.id;
        this.state.pendingShadowStage = stage;

        const direction = preferredDirection ?? this._getRandomTeleportDirection(target);
        const teleport = this._findTeleportPosition(target, direction);
        this.state.appearPos = teleport.position;
        if (stage === "base" && this.state.commandCycle) this.state.commandCycle.safeAppear = teleport.safeAppear;

        sim.spawnParticleBurst(this.state.vanishPos, "#55bbdd", {
            count: 20,
            speed: 280,
            radiusMin: 3,
            radiusMax: 6,
            gravity: 600
        });
        sim.spawnPulse(this.state.vanishPos, "#55bbdd");

        this.state.teleportPhase = 1;
        this.state.teleportTimer = 0;
    }

    _getRandomTeleportDirection(target) {
        const toTarget = Vector2.subtract(target.position, this.owner.position).normalize();
        const behindAngle = (Math.random() - 0.5) * Math.PI;
        const cos = Math.cos(behindAngle);
        const sin = Math.sin(behindAngle);
        return new Vector2(toTarget.x * cos - toTarget.y * sin, toTarget.x * sin + toTarget.y * cos);
    }

    _findSafeTeleportPosition(target, preferredDirection) {
        return this._findTeleportPosition(target, preferredDirection).position;
    }

    _findTeleportPosition(target, preferredDirection) {
        const owner = this.owner;
        const sim = this.simulation;
        let bestCandidate = null;
        let bestClearance = -Infinity;

        for (const offset of TELEPORT_DIRECTION_OFFSETS) {
            const cos = Math.cos(offset);
            const sin = Math.sin(offset);
            const direction = new Vector2(
                preferredDirection.x * cos - preferredDirection.y * sin,
                preferredDirection.x * sin + preferredDirection.y * cos
            );
            const candidate = Vector2.add(target.position, direction.scale(TELEPORT_BEHIND_DIST));
            if (
                candidate.x < owner.radius ||
                candidate.x > sim.width - owner.radius ||
                candidate.y < owner.radius ||
                candidate.y > sim.height - owner.radius
            ) {
                continue;
            }

            const clearance = sim.fighters
                .filter((fighter) => fighter !== owner && !fighter.flags.defeated)
                .reduce(
                    (minimum, fighter) =>
                        Math.min(
                            minimum,
                            Vector2.subtract(candidate, fighter.position).length() - owner.radius - fighter.radius
                        ),
                    Infinity
                );
            if (clearance >= TELEPORT_CLEARANCE) return { position: candidate, safeAppear: true };
            if (clearance > bestClearance) {
                bestCandidate = candidate;
                bestClearance = clearance;
            }
        }

        if (bestCandidate) return { position: bestCandidate, safeAppear: false };
        const fallback = Vector2.add(target.position, preferredDirection.scale(TELEPORT_BEHIND_DIST));
        fallback.x = Math.max(owner.radius, Math.min(sim.width - owner.radius, fallback.x));
        fallback.y = Math.max(owner.radius, Math.min(sim.height - owner.radius, fallback.y));
        return { position: fallback, safeAppear: this._getTeleportClearance(fallback) >= TELEPORT_CLEARANCE };
    }

    _getTeleportClearance(position) {
        return this.simulation.fighters
            .filter((fighter) => fighter !== this.owner && !fighter.flags.defeated)
            .reduce(
                (minimum, fighter) =>
                    Math.min(
                        minimum,
                        Vector2.subtract(position, fighter.position).length() - this.owner.radius - fighter.radius
                    ),
                Infinity
            );
    }

    _doTeleport() {
        const owner = this.owner;
        const sim = this.simulation;

        owner.position.x = this.state.appearPos.x;
        owner.position.y = this.state.appearPos.y;

        sim.spawnExplosion(this.state.appearPos, "#55bbdd");
        sim.spawnPulse(this.state.appearPos.clone(), "#aaddff");
    }

    _startDashAfterTeleport() {
        const target = this.simulation.fighters.find((fighter) => fighter.id === this.state.teleportTargetId);
        if (!target) return;
        const stage = this.state.pendingShadowStage ?? "base";
        this._startShadowDash(target, stage);
    }

    _startShadowDash(target, stage) {
        const owner = this.owner;
        const sim = this.simulation;

        const dashDir = Vector2.subtract(target.position, owner.position).normalize();
        const trailEnd = Vector2.add(owner.position, dashDir.clone().scale(TELEPORT_BEHIND_DIST * 0.6));
        sim.spawnSlash(owner.position.clone(), trailEnd, "#55bbdd");
        sim.spawnPulse(target.position.clone(), "#ff88cc");

        owner.initiateDash(dashDir, {
            duration: DASH_DURATION,
            multiplier: DASH_MULTIPLIER,
            collisionDamage:
                stage === "base"
                    ? this.owner.stats.baseDamage * (this.getLevelUpgrade().bonusDamageMultiplier ?? 1.5)
                    : 0,
            collisionLabel: SHADOW_DASH_LABEL,
            showRing: false
        });
        this.state.activeDashStage = stage;
        this.state.pendingShadowStage = null;

        sim.playSound("dash", 0.9);
        sim.addLog(`${owner.name}의 ${SHADOW_DASH_LABEL} 발동.`);
    }

    onDashHit(target, effect) {
        if (effect._phantomShadowDashHandled) return;
        effect._phantomShadowDashHandled = true;

        const stage = this.state.activeDashStage;
        this.state.activeDashStage = null;
        this._recordCommandDashHit(stage, target);
        if (stage === "base" && this.getLevelUpgrade().shadowPursuitOnNaturalCollision) {
            this._markTarget(target);
            this.state.skipMarkedCollisionTargetId = target.id;
            return;
        }
        if (stage === "chain" && this.getLevelUpgrade().shadowFinish && this.state.shadowFinishStacks > 0) {
            this.state.shadowFinishStacks -= 1;
            this._showChainText(target, SHADOW_DASH_LABEL, "#ff88cc");
            const direction = this.state.commandCycle
                ? new Vector2(this.state.commandCycle.direction.x, this.state.commandCycle.direction.y).normalize()
                : null;
            this._triggerShadowDash(target, "finish", direction);
            return;
        }
        this._finalizeCommandCycleIfComplete();
    }

    _markTarget(target) {
        const upgrade = this.getLevelUpgrade();
        this.state.markedTargetId = target.id;
        this.state.shadowPursuitStacks = upgrade.shadowPursuitOnNaturalCollision ? 1 : 0;
        this.state.shadowReboundStacks = upgrade.shadowReboundOnStaticCollision ? 1 : 0;
        this.state.shadowFinishStacks = upgrade.shadowFinish ? 1 : 0;
        this._showChainText(target, SHADOW_DASH_LABEL, "#8eeeff");
    }

    _clearExpiredChain() {
        if (!this.state.markedTargetId) return;
        if (this.cooldownReady) {
            this._finalizeCommandCycleIfComplete(true);
            this._clearMark();
        }
    }

    _isMarkedTarget(target) {
        return target?.id === this.state.markedTargetId && !this.cooldownReady;
    }

    _triggerShadowChain(target, stackKey) {
        this.state[stackKey] -= 1;
        this._showChainText(target, SHADOW_DASH_LABEL, "#8eeeff");
        if (stackKey === "shadowReboundStacks") {
            this._startShadowDash(target, "chain");
            return;
        }
        const cycle = this.state.commandCycle;
        const direction =
            cycle && this._isMarkedTarget(target)
                ? new Vector2(cycle.direction.x, cycle.direction.y).normalize()
                : null;
        this._triggerShadowDash(target, "chain", direction);
    }

    _beginCommandCycle(commandSequence, direction, targetId) {
        this.state.commandCycle = {
            commandSequence,
            direction: { ...direction },
            targetId,
            safeAppear: false,
            baseHit: false,
            chainDepth: 0,
            finishHit: false,
            finalized: false
        };
    }

    _recordCommandDashHit(stage, target) {
        const cycle = this.state.commandCycle;
        if (!cycle || !stage || !this._isMarkedOrCommandTarget(target, cycle)) return;
        if (stage === "base") cycle.baseHit = true;
        if (stage === "chain") cycle.chainDepth += 1;
        if (stage === "finish") cycle.finishHit = true;
    }

    _isMarkedOrCommandTarget(target, cycle) {
        return Boolean(target && target.id === cycle.targetId);
    }

    _resolveCommandDashMiss(endedDashStage) {
        const cycle = this.state.commandCycle;
        if (!cycle || !endedDashStage) return;
        this._finalizeCommandCycleIfComplete(endedDashStage === "base");
    }

    _finalizeCommandCycleIfComplete(force = false) {
        const cycle = this.state.commandCycle;
        if (!cycle || cycle.finalized) return;
        const hasPendingChain =
            this.state.teleportPhase > 0 ||
            this.state.activeDashStage ||
            this.state.shadowPursuitStacks > 0 ||
            this.state.shadowReboundStacks > 0 ||
            this.state.shadowFinishStacks > 0;
        if (!force && hasPendingChain) return;
        this._finalizeCommandCycle();
    }

    _finalizeCommandCycle() {
        const cycle = this.state.commandCycle;
        if (!cycle || cycle.finalized) return;
        cycle.finalized = true;
        this.recordAbilityResult({
            commandSequence: cycle.commandSequence,
            resultType: "phantom-command-chain",
            success: cycle.safeAppear && cycle.baseHit,
            value: {
                safeAppear: cycle.safeAppear,
                baseHit: cycle.baseHit,
                chainDepth: cycle.chainDepth,
                finishHit: cycle.finishHit
            }
        });
        this.state.commandCollisionSequences.delete(cycle.commandSequence);
        this.state.commandCycle = null;
    }

    _restartCooldownAfterCommandAbort() {
        this.setCooldownDuration(this.cooldown);
        this.setCooldownRemaining(this.cooldown);
    }

    _showChainText(target, text, color) {
        const feedback = this.simulation.spawnActionText(target.position.clone(), text, color);
        if (feedback) feedback.visibilityToken = "combatText";
    }

    _getShadowChainUiState() {
        const total = this.state.shadowPursuitStacks + this.state.shadowReboundStacks + this.state.shadowFinishStacks;
        if (!this.state.markedTargetId || total === 0) return null;
        return {
            label: SHADOW_ACTIVE_LABEL,
            progress: this.cooldownProgress,
            status: "charging",
            text: `${total}회 · ${this.cooldownRemaining.toFixed(1)}초`
        };
    }

    _clearMark() {
        this.state.markedTargetId = null;
        this.state.shadowPursuitStacks = 0;
        this.state.shadowReboundStacks = 0;
        this.state.shadowFinishStacks = 0;
        this.state.skipMarkedCollisionTargetId = null;
    }

    getStatModifiers() {
        const upgrade = this.getLevelUpgrade();
        return {
            speed: upgrade.speedMultiplier ?? 1.1,
            damage: upgrade.damageMultiplier ?? 1,
            defense: upgrade.defenseMultiplier ?? 1.5,
            impact: upgrade.impactMultiplier ?? 1.1
        };
    }

    draw(ctx) {
        const owner = this.owner;
        const time = performance.now() / 1000;
        const shimmer = Math.sin(time * 6) * 0.12 + 0.88;

        ctx.save();

        // appear ring effect during teleport
        if (this.state.teleportPhase === 2) {
            const t = Math.min(this.state.teleportTimer / APPEAR_DURATION, 1);
            const ringR = owner.radius * 1.5 + (1 - t) * 30;
            ctx.beginPath();
            ctx.arc(owner.position.x, owner.position.y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = "#55bbdd";
            ctx.lineWidth = 3 * (1 - t) + 1;
            ctx.globalAlpha = 0.5 * (1 - t);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // primed pulsing ring
        if (this.state.primed) {
            const pulse = Math.sin(time * 8) * 0.25 + 0.75;
            ctx.strokeStyle = "#55bbdd";
            ctx.lineWidth = 3;
            ctx.globalAlpha = pulse * 0.7;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(owner.position.x, owner.position.y, owner.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // idle shimmer ring
        ctx.globalAlpha = shimmer;
        ctx.strokeStyle = "#55bbdd";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(owner.position.x, owner.position.y, owner.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        const { r, blink } = this._faceContext(ball);
        const eyeBlink = blink < 0.5 ? 0.04 * r * blink : 0.04 * r;

        const lx = -0.2 * r;
        const ly = -0.02 * r * blink;
        ctx.beginPath();
        ctx.moveTo(lx - eyeBlink, ly);
        ctx.lineTo(lx + eyeBlink, ly);
        ctx.moveTo(lx, ly - eyeBlink);
        ctx.lineTo(lx, ly + eyeBlink);
        ctx.stroke();

        const rx = 0.2 * r;
        const ry = -0.02 * r * blink;
        ctx.beginPath();
        ctx.moveTo(rx - eyeBlink, ry);
        ctx.lineTo(rx + eyeBlink, ry);
        ctx.moveTo(rx, ry - eyeBlink);
        ctx.lineTo(rx, ry + eyeBlink);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-0.08 * r, 0.22 * r);
        ctx.lineTo(0.08 * r, 0.22 * r);
        ctx.stroke();
        return true;
    }

    getUiState() {
        if (this.state.teleportPhase > 0) {
            return { label: SHADOW_DASH_LABEL, progress: 0, status: "active", text: "발동 중" };
        }
        if (this.state.primed) {
            return {
                label: SHADOW_ACTIVE_LABEL,
                progress: 1,
                status: "ready",
                text: `${Math.max(0, this.state.primedTimer).toFixed(1)}초`
            };
        }
        const shadowChainState = this._getShadowChainUiState();
        if (shadowChainState) return shadowChainState;
        return {
            label: this.cooldownReady ? SHADOW_ACTIVE_LABEL : SHADOW_WAIT_LABEL,
            progress: this.cooldownProgress,
            status: this.cooldownReady ? "ready" : "charging",
            text: this.cooldownReady ? "충돌 대기" : `${this.cooldownRemaining.toFixed(1)}초`
        };
    }
}
