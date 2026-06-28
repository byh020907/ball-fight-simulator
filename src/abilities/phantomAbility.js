import { Vector2 } from "../core.js";
import { DashEffect } from "../combatEffects.js";
import { Ability } from "./ability.js";

const PHANTOM_COOLDOWN = 3.0;
const PRIMED_DURATION = 2.5;
const RANDOM_MISS_COOLDOWN_FACTOR = 0.5;
const DASH_DURATION = 0.8;
const DASH_MULTIPLIER = 2.5;
const TELEPORT_BEHIND_DIST = 250;
const BONUS_DAMAGE = 12;
const COLLISION_DAMAGE_WHEN_READY = 5;
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
            teleportTargetId: null
        };
        this.timer = this.cooldown;
    }

    update(delta, target) {
        const owner = this.owner;

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
                this.timer = this.cooldown * RANDOM_MISS_COOLDOWN_FACTOR;
            }
            return;
        }

        // normal cooldown countdown
        this.timer -= delta;
        if (this.timer <= 0) {
            this.timer = 0;
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
            this._triggerShadowStrike(target);
        }
    }

    _triggerShadowStrike(target) {
        const owner = this.owner;
        const sim = this.simulation;
        this.timer = this.cooldown;

        this.state.vanishPos = owner.position.clone();
        this.state.teleportTargetId = target.id;

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

        const dashDir = Vector2.subtract(target.position, owner.position).normalize();
        const trailEnd = Vector2.add(owner.position, dashDir.clone().scale(TELEPORT_BEHIND_DIST * 0.6));
        sim.spawnSlash(owner.position.clone(), trailEnd, "#55bbdd");
        sim.spawnPulse(target.position.clone(), "#ff88cc");

        const dashSpeed = owner.stats.baseSpeed * DASH_MULTIPLIER;

        owner.initiateDash(dashDir, {
            duration: DASH_DURATION,
            multiplier: DASH_MULTIPLIER,
            collisionDamage: BONUS_DAMAGE,
            collisionLabel: "Shadow Strike",
            showRing: false
        });

        sim.playSound("dash", 0.9);
        sim.addLog(`${owner.name} vanishes and strikes from the shadows!`);
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
        owner.velocity = Vector2.fromAngle(randomAngle, speed);
        owner.clearDash();

        sim.spawnParticleBurst(oldPos, "#55bbdd", { count: 15, speed: 200, radiusMin: 2, radiusMax: 5, gravity: 400 });
        sim.spawnPulse(oldPos, "#55bbdd");
        sim.spawnExplosion(pos, "#55bbdd");
        sim.spawnPulse(pos.clone(), "#aaddff");
        sim.playSound("dash", 0.6);
        sim.addLog(`${owner.name} phases through the shadows and repositions.`);
    }

    onDashHit(target, effect) {
        this.timer = 0;
        this.state.primed = true;
        this.state.primedTimer = PRIMED_DURATION;
    }

    getStatModifiers() {
        return { speed: 1.1, damage: 1, defense: 1.5, impact: 1.1 };
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
            return { label: "Strike", progress: 1 };
        }
        if (this.state.primed) {
            return {
                label: `Primed ${Math.max(0, this.state.primedTimer).toFixed(1)}s`,
                progress: Math.max(0, Math.min(1, this.state.primedTimer / PRIMED_DURATION))
            };
        }
        return {
            label: this.timer <= 0 ? "Ready" : `${Math.max(0, this.timer).toFixed(1)}s`,
            progress: this.timer <= 0 ? 1 : Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
