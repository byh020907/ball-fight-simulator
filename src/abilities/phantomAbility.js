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
            skipMarkedCollisionTargetId: null
        };
        this.resetCooldown(this.cooldown);
    }

    update(delta, target) {
        const owner = this.owner;
        this._clearExpiredChain();
        if (this.state.activeDashStage && !owner.state.movement) {
            this.state.activeDashStage = null;
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

    _triggerShadowDash(target, stage) {
        const owner = this.owner;
        const sim = this.simulation;
        if (stage === "base") {
            this.resetCooldown(this.cooldown);
        }

        this.state.vanishPos = owner.position.clone();
        this.state.teleportTargetId = target.id;
        this.state.pendingShadowStage = stage;

        const toTarget = Vector2.subtract(target.position, owner.position).normalize();
        const behindAngle = (Math.random() - 0.5) * Math.PI;
        const cos = Math.cos(behindAngle);
        const sin = Math.sin(behindAngle);
        const rotatedDir = new Vector2(toTarget.x * cos - toTarget.y * sin, toTarget.x * sin + toTarget.y * cos);
        this.state.appearPos = this._findSafeTeleportPosition(target, rotatedDir);

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

    _findSafeTeleportPosition(target, preferredDirection) {
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
            if (clearance >= TELEPORT_CLEARANCE) return candidate;
            if (clearance > bestClearance) {
                bestCandidate = candidate;
                bestClearance = clearance;
            }
        }

        if (bestCandidate) return bestCandidate;
        const fallback = Vector2.add(target.position, preferredDirection.scale(TELEPORT_BEHIND_DIST));
        fallback.x = Math.max(owner.radius, Math.min(sim.width - owner.radius, fallback.x));
        fallback.y = Math.max(owner.radius, Math.min(sim.height - owner.radius, fallback.y));
        return fallback;
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
        const owner = this.owner;
        const sim = this.simulation;
        const target = sim.fighters.find((f) => f.id === this.state.teleportTargetId);
        if (!target) return;
        const stage = this.state.pendingShadowStage ?? "base";

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
            collisionLabel: stage === "base" ? "그림자 돌진" : "그림자 연계",
            showRing: false
        });
        this.state.activeDashStage = stage;
        this.state.pendingShadowStage = null;

        sim.playSound("dash", 0.9);
        const stageLabel = { base: "그림자 돌진", chain: "그림자 연계", finish: "그림자 종결" }[stage];
        sim.addLog(`${owner.name}의 ${stageLabel ?? "그림자 돌진"} 발동.`);
    }

    onDashHit(target, effect) {
        if (effect._phantomShadowDashHandled) return;
        effect._phantomShadowDashHandled = true;

        const stage = this.state.activeDashStage;
        this.state.activeDashStage = null;
        if (stage === "base" && this.getLevelUpgrade().shadowPursuitOnNaturalCollision) {
            this._markTarget(target);
            this.state.skipMarkedCollisionTargetId = target.id;
            return;
        }
        if (stage === "chain" && this.getLevelUpgrade().shadowFinish && this.state.shadowFinishStacks > 0) {
            this.state.shadowFinishStacks -= 1;
            this._showChainText(target, "그림자 종결", "#ff88cc");
            this._triggerShadowDash(target, "finish");
        }
    }

    _markTarget(target) {
        const upgrade = this.getLevelUpgrade();
        this.state.markedTargetId = target.id;
        this.state.shadowPursuitStacks = upgrade.shadowPursuitOnNaturalCollision ? 1 : 0;
        this.state.shadowReboundStacks = upgrade.shadowReboundOnStaticCollision ? 1 : 0;
        this.state.shadowFinishStacks = upgrade.shadowFinish ? 1 : 0;
        this._showChainText(target, "그림자 각인", "#8eeeff");
    }

    _clearExpiredChain() {
        if (!this.state.markedTargetId) return;
        if (this.cooldownReady) {
            this._clearMark();
        }
    }

    _isMarkedTarget(target) {
        return target?.id === this.state.markedTargetId && !this.cooldownReady;
    }

    _triggerShadowChain(target, stackKey) {
        this.state[stackKey] -= 1;
        const label = stackKey === "shadowPursuitStacks" ? "그림자 추격" : "그림자 반향";
        this._showChainText(target, label, "#8eeeff");
        this._triggerShadowDash(target, "chain");
    }

    _showChainText(target, text, color) {
        const feedback = this.simulation.spawnActionText(target.position.clone(), text, color);
        if (feedback) feedback.visibilityToken = "combatText";
    }

    _getShadowChainUiState() {
        const stacks = [
            ["추격", this.state.shadowPursuitStacks],
            ["반향", this.state.shadowReboundStacks],
            ["종결", this.state.shadowFinishStacks]
        ].filter(([, count]) => count > 0);
        if (!this.state.markedTargetId || stacks.length === 0) return null;
        const total = stacks.reduce((sum, [, count]) => sum + count, 0);
        const summary = stacks.map(([label, count]) => `${label} ${count}`).join(" · ");
        return {
            label: `그림자 연계 ${total}`,
            progress: this.cooldownProgress,
            status: "charging",
            text: `${summary} · ${this.cooldownRemaining.toFixed(1)}초`
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
            return { label: "그림자 돌진", progress: 0, status: "active", text: "발동 중" };
        }
        if (this.state.primed) {
            return {
                label: `그림자 대기 ${Math.max(0, this.state.primedTimer).toFixed(1)}초`,
                progress: 1,
                status: "ready",
                text: "충돌 대기"
            };
        }
        const shadowChainState = this._getShadowChainUiState();
        if (shadowChainState) return shadowChainState;
        return {
            label: this.cooldownReady ? "그림자 준비" : `${this.cooldownRemaining.toFixed(1)}초`,
            progress: this.cooldownProgress
        };
    }
}
