import { Vector2 } from "../core.js";
import { DashEffect } from "../combatEffects.js";
import { Ability } from "./ability.js";

const PHANTOM_COOLDOWN = 2.5;
const PRIMED_DURATION = 2.5;
const RANDOM_MISS_COOLDOWN_FACTOR = 0.5;
const DASH_DURATION = 0.8;
const DASH_MULTIPLIER = 2.5;
const TELEPORT_BEHIND_DIST = 250;
const VANISH_DURATION = 0.15;
const APPEAR_DURATION = 0.4;

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
            pendingStrikeStage: null,
            activeDashStage: null,
            markedTargetId: null,
            naturalEchoStacks: 0,
            staticEchoStacks: 0,
            terminalDashStacks: 0,
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
                this._randomTeleport();
                this.setCooldownDuration(this.cooldown);
                this.setCooldownRemaining(this.cooldown * RANDOM_MISS_COOLDOWN_FACTOR);
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
            this._triggerShadowStrike(target, "base");
            return;
        }

        if (this.state.skipMarkedCollisionTargetId === target.id) {
            this.state.skipMarkedCollisionTargetId = null;
            return;
        }
        if (this.state.activeDashStage || !this._isMarkedTarget(target) || this.state.naturalEchoStacks <= 0) return;
        this._triggerEchoStrike(target, "naturalEchoStacks");
    }

    onFighterStaticCollision(fighter, context) {
        if (
            !this.getLevelUpgrade().echoOnStaticCollision ||
            !this._isMarkedTarget(fighter) ||
            this.state.staticEchoStacks <= 0 ||
            this.state.teleportPhase > 0 ||
            this.state.activeDashStage
        ) {
            return;
        }
        if (!context.wall && !context.terrain) return;
        this._triggerEchoStrike(fighter, "staticEchoStacks");
    }

    _triggerShadowStrike(target, stage) {
        const owner = this.owner;
        const sim = this.simulation;
        if (stage === "base") {
            this.resetCooldown(this.cooldown);
        }

        this.state.vanishPos = owner.position.clone();
        this.state.teleportTargetId = target.id;
        this.state.pendingStrikeStage = stage;

        const toTarget = Vector2.subtract(target.position, owner.position).normalize();
        const behindAngle = (Math.random() - 0.5) * Math.PI;
        const cos = Math.cos(behindAngle);
        const sin = Math.sin(behindAngle);
        const rotatedDir = new Vector2(toTarget.x * cos - toTarget.y * sin, toTarget.x * sin + toTarget.y * cos);
        let behindPos = Vector2.add(target.position, rotatedDir.scale(TELEPORT_BEHIND_DIST));

        const r = owner.radius;
        behindPos.x = Math.max(r, Math.min(sim.width - r, behindPos.x));
        behindPos.y = Math.max(r, Math.min(sim.height - r, behindPos.y));

        this.state.appearPos = behindPos;

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
        const stage = this.state.pendingStrikeStage ?? "base";

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
            collisionLabel: stage === "base" ? "Shadow Strike" : "Shadow Echo",
            showRing: false
        });
        this.state.activeDashStage = stage;
        this.state.pendingStrikeStage = null;

        sim.playSound("dash", 0.9);
        sim.addLog(`${owner.name} vanishes for a ${stage} shadow strike.`);
    }

    _randomTeleport() {
        const owner = this.owner;
        const sim = this.simulation;
        const target = sim.getOpponent(owner);

        const r = owner.radius;
        const margin = r + 30;
        const minDistFromTarget = target ? target.radius + r + 60 : 100;

        let pos;
        let attempts = 0;
        do {
            pos = new Vector2(
                margin + Math.random() * (sim.width - 2 * margin),
                margin + Math.random() * (sim.height - 2 * margin)
            );
            attempts++;
        } while (target && Vector2.subtract(pos, target.position).length() < minDistFromTarget && attempts < 30);

        const oldPos = owner.position.clone();
        owner.position.x = pos.x;
        owner.position.y = pos.y;

        const randomAngle = Math.random() * Math.PI * 2;
        const speed = owner.stats.baseSpeed * (0.7 + Math.random() * 0.6);
        owner.applyImpulse(Vector2.subtract(Vector2.fromAngle(randomAngle, speed), owner.velocity));
        owner.clearDash();

        sim.spawnParticleBurst(oldPos, "#55bbdd", { count: 15, speed: 200, radiusMin: 2, radiusMax: 5, gravity: 400 });
        sim.spawnPulse(oldPos, "#55bbdd");
        sim.spawnExplosion(pos, "#55bbdd");
        sim.spawnPulse(pos.clone(), "#aaddff");
        sim.playSound("dash", 0.6);
        sim.addLog(`${owner.name} phases through the shadows and repositions.`);
    }

    onDashHit(target, effect) {
        if (effect._phantomStrikeHandled) return;
        effect._phantomStrikeHandled = true;

        const stage = this.state.activeDashStage;
        this.state.activeDashStage = null;
        if (stage === "base" && this.getLevelUpgrade().echoOnNaturalCollision) {
            this._markTarget(target);
            this.state.skipMarkedCollisionTargetId = target.id;
            return;
        }
        if (stage === "echo" && this.getLevelUpgrade().terminalDash && this.state.terminalDashStacks > 0) {
            this.state.terminalDashStacks -= 1;
            this._showChainText(target, "종결 돌진", "#ff88cc");
            this._triggerShadowStrike(target, "terminal");
        }
    }

    _markTarget(target) {
        const upgrade = this.getLevelUpgrade();
        this.state.markedTargetId = target.id;
        this.state.naturalEchoStacks = upgrade.echoOnNaturalCollision ? 1 : 0;
        this.state.staticEchoStacks = upgrade.echoOnStaticCollision ? 1 : 0;
        this.state.terminalDashStacks = upgrade.terminalDash ? 1 : 0;
        this._showChainText(target, "그림자 돌진", "#8eeeff");
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

    _triggerEchoStrike(target, stackKey) {
        this.state[stackKey] -= 1;
        const label = stackKey === "naturalEchoStacks" ? "자연 메아리" : "벽 메아리";
        this._showChainText(target, label, "#8eeeff");
        this._triggerShadowStrike(target, "echo");
    }

    _showChainText(target, text, color) {
        const feedback = this.simulation.spawnActionText(target.position.clone(), text, color);
        if (feedback) feedback.visibilityToken = "combatText";
    }

    _getEchoStackUiState() {
        const stacks = [
            ["자연", this.state.naturalEchoStacks],
            ["벽", this.state.staticEchoStacks],
            ["종결", this.state.terminalDashStacks]
        ].filter(([, count]) => count > 0);
        if (!this.state.markedTargetId || stacks.length === 0) return null;
        const total = stacks.reduce((sum, [, count]) => sum + count, 0);
        const summary = stacks.map(([label, count]) => `${label} ${count}`).join(" · ");
        return {
            label: `Echo ${total}`,
            progress: this.cooldownProgress,
            status: "charging",
            text: `${summary} · ${this.cooldownRemaining.toFixed(1)}s`
        };
    }

    _clearMark() {
        this.state.markedTargetId = null;
        this.state.naturalEchoStacks = 0;
        this.state.staticEchoStacks = 0;
        this.state.terminalDashStacks = 0;
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
            return { label: "Strike", progress: 0, status: "active", text: "Active" };
        }
        if (this.state.primed) {
            return {
                label: `Primed ${Math.max(0, this.state.primedTimer).toFixed(1)}s`,
                progress: 1,
                status: "ready",
                text: "Ready"
            };
        }
        const echoStackState = this._getEchoStackUiState();
        if (echoStackState) return echoStackState;
        return {
            label: this.cooldownReady ? "Ready" : `${this.cooldownRemaining.toFixed(1)}s`,
            progress: this.cooldownProgress
        };
    }
}
