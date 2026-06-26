import { Vector2 } from "../core.js";
import { DashEffect } from "../combatEffects.js";
import { Ability } from "./ability.js";

const PHANTOM_COOLDOWN = 2.0;
const DASH_DURATION = 0.8;
const DASH_MULTIPLIER = 2.5;
const TELEPORT_BEHIND_DIST = 250;
const BONUS_DAMAGE = 12;
const COLLISION_DAMAGE_WHEN_READY = 5;

export class PhantomAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, PHANTOM_COOLDOWN);
        this.timer = this.cooldown;
        this._isTeleporting = false;
    }

    update(delta, target) {
        this.timer -= delta;
    }

    onCollision(target) {
        if (this.owner.swallowedState || target.swallowedState) return;
        if (this.timer <= 0) {
            this._triggerShadowStrike(target);
            return;
        }
    }

    _triggerShadowStrike(target) {
        const owner = this.owner;
        const sim = this.simulation;
        this.timer = this.cooldown;

        const oldPos = owner.position.clone();

        const toTarget = Vector2.subtract(target.position, owner.position).normalize();
        const behindAngle = (Math.random() - 0.5) * Math.PI;
        const cos = Math.cos(behindAngle);
        const sin = Math.sin(behindAngle);
        const rotatedDir = new Vector2(toTarget.x * cos - toTarget.y * sin, toTarget.x * sin + toTarget.y * cos);
        let behindPos = Vector2.add(target.position, rotatedDir.scale(TELEPORT_BEHIND_DIST));

        const r = owner.radius;
        behindPos.x = Math.max(r, Math.min(sim.width - r, behindPos.x));
        behindPos.y = Math.max(r, Math.min(sim.height - r, behindPos.y));

        sim.spawnParticleBurst(oldPos, "#55bbdd", { count: 20, speed: 280, radiusMin: 3, radiusMax: 6, gravity: 600 });
        sim.spawnPulse(oldPos, "#55bbdd");

        owner.position.x = behindPos.x;
        owner.position.y = behindPos.y;

        sim.spawnExplosion(behindPos, "#55bbdd");
        sim.spawnPulse(behindPos.clone(), "#aaddff");

        const dashDir = Vector2.subtract(target.position, owner.position).normalize();
        const trailEnd = Vector2.add(owner.position, dashDir.clone().scale(TELEPORT_BEHIND_DIST * 0.6));
        sim.spawnSlash(owner.position.clone(), trailEnd, "#55bbdd");

        sim.spawnPulse(target.position.clone(), "#ff88cc");

        const dashSpeed = owner.baseSpeed * DASH_MULTIPLIER;

        owner.setMovementEffect(
            new DashEffect({
                duration: DASH_DURATION,
                multiplier: DASH_MULTIPLIER,
                color: owner.color,
                showRing: false,
                collisionDamage: BONUS_DAMAGE,
                collisionLabel: "Shadow Strike",
                untilImpact: true
            })
        );
        owner.forceHeading(dashDir, DASH_DURATION);
        owner.applyImpulse(dashDir.clone().scale(dashSpeed).subtract(owner.velocity));

        sim.playSound("dash", 0.9);
        sim.addLog(`${owner.name} vanishes and strikes from the shadows!`);
    }

    getStatModifiers() {
        return { speed: 1.1, damage: 1, defense: 1.3, impact: 1.1 };
    }

    draw(ctx) {
        const owner = this.owner;
        const time = performance.now() / 1000;
        const shimmer = Math.sin(time * 6) * 0.12 + 0.88;

        ctx.save();
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
        return {
            label: this.timer <= 0 ? "Ready" : `${Math.max(0, this.timer).toFixed(1)}s`,
            progress: this.timer <= 0 ? 1 : Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
