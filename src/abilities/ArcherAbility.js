import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

const WINDUP = 0.6;
const SPREAD_ANGLE = 0.22;
const EVADE_RANGE = 320;
const EVADE_STRENGTH = 0.7;

export class ArcherAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldown = 3.9;
        this.timer = 1.2;
        this.windUp = 0;
        this.missStreak = 0;
        this.lastAimDir = new Vector2(1, 0);
    }

    update(delta, target) {
        // Passive evade — steers perpendicular to opponent
        if (target && !target.isDefeated && !this.owner.swallowedState && !this.owner.wallSlamState) {
            const toTarget = Vector2.subtract(target.position, this.owner.position);
            const dist = toTarget.length();
            const towardOpponent = toTarget.normalize();
            const myDir = this.owner.velocity.length() > 5 ? this.owner.velocity.clone().normalize() : null;
            const movingToward = myDir ? myDir.x * towardOpponent.x + myDir.y * towardOpponent.y > 0 : true;

            if (dist < EVADE_RANGE && dist > 5 && movingToward) {
                const oppDir =
                    target.velocity.length() > 5
                        ? target.velocity.clone().normalize()
                        : towardOpponent.clone().scale(-1);
                const side =
                    oppDir.x * (this.owner.position.y - target.position.y) -
                    oppDir.y * (this.owner.position.x - target.position.x);
                const perp = new Vector2(-towardOpponent.y, towardOpponent.x);
                const dodgeDir = side > 0 ? perp : perp.scale(-1);

                const intensity = (1 - dist / EVADE_RANGE) * EVADE_STRENGTH;
                const current = myDir ?? dodgeDir;
                const blended = current.add(dodgeDir.scale(intensity)).normalize();

                if (this.owner.forcedHeading) {
                    this.owner.forcedHeading.direction = blended;
                    this.owner.forcedHeading.effect.elapsed = 0;
                } else {
                    this.owner.forceHeading(blended, 0.35);
                }
            }
        }

        // Wind-up phase — tracking target
        if (this.windUp > 0) {
            if (target) {
                this.lastAimDir = Vector2.subtract(target.position, this.owner.position).normalize();
            }
            this.windUp -= delta;
            if (this.windUp <= 0) {
                this.windUp = 0;
                this.release();
            }
            return;
        }

        this.timer -= delta;
        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this.lastAimDir = Vector2.subtract(target.position, this.owner.position).normalize();
            this.windUp = WINDUP;
        }
    }

    /** Fire the arrow(s) after wind-up completes. */
    release() {
        const dir = this.lastAimDir;
        const base = Vector2.add(this.owner.position, dir.clone().scale(this.owner.radius + 24));

        if (this.missStreak >= 2) {
            // Triple shot
            this.missStreak = 0;
            const angles = [-SPREAD_ANGLE, 0, SPREAD_ANGLE];
            for (const offset of angles) {
                const a = Math.atan2(dir.y, dir.x) + offset;
                const d = new Vector2(Math.cos(a), Math.sin(a));
                const start = Vector2.add(this.owner.position, d.clone().scale(this.owner.radius + 24));
                this.fireOne(start, d);
            }
            this.simulation.addLog(`${this.owner.name} fires a triple shot!`);
        } else {
            this.fireOne(base, dir);
        }

        this.simulation.playSound("shoot");
    }

    /** Spawn a single arrow with hit/miss callback. */
    fireOne(start, dir) {
        const arrow = this.simulation.spawnArrow(this.owner, start, dir.clone().scale(this.owner.baseSpeed * 2));
        arrow._abilityRef = this;
        this.simulation.spawnSlash(this.owner.position.clone(), start.clone(), this.owner.color);
    }

    /** Called by arrow when it hits or expires. */
    onArrowResult(hit) {
        if (hit) {
            this.missStreak = 0;
        } else {
            this.missStreak = Math.min(5, this.missStreak + 1);
        }
    }

    getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        if (this.windUp <= 0) return;

        const progress = 1 - this.windUp / WINDUP; // 0→1 during wind-up
        const dir = this.lastAimDir;
        const pos = this.owner.position;
        const r = this.owner.radius;

        // Pull distance increases with progress
        const pull = 10 + progress * 30;
        const perp = new Vector2(-dir.y, dir.x);

        // Bow center (in front of the ball)
        const bowCenter = Vector2.add(pos, dir.clone().scale(r + 20));

        // Bow ends (top and bottom of the bow arc)
        const bowLen = 36;
        const bowTop = Vector2.add(bowCenter, perp.clone().scale(-bowLen));
        const bowBot = Vector2.add(bowCenter, perp.clone().scale(bowLen));

        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 4;

        // Bow arc — bends backward as string is pulled
        ctx.beginPath();
        ctx.moveTo(bowTop.x, bowTop.y);
        ctx.quadraticCurveTo(bowCenter.x + dir.x * pull, bowCenter.y + dir.y * pull, bowBot.x, bowBot.y);
        ctx.stroke();

        // Bow string — pulled back toward archer
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bowTop.x, bowTop.y);
        ctx.lineTo(bowCenter.x - dir.x * pull, bowCenter.y - dir.y * pull);
        ctx.lineTo(bowBot.x, bowBot.y);
        ctx.stroke();

        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._line(ctx, ball, [
            [-0.34, -0.2],
            [-0.12, -0.12]
        ]);
        this._line(ctx, ball, [
            [0.34, -0.2],
            [0.12, -0.12]
        ]);
        this._sharpEye(ctx, ball, -0.23, -0.02, 1, 0.095);
        this._sharpEye(ctx, ball, 0.23, -0.02, -1, 0.095);
        this._line(ctx, ball, [
            [-0.18, 0.28],
            [0.2, 0.2]
        ]);
        return true;
    }

    getUiState() {
        if (this.windUp > 0) {
            return { label: "Draw", progress: 1 - this.windUp / WINDUP };
        }
        const label = this.missStreak >= 2 ? `Triple x${this.missStreak}` : "Arrow";
        return {
            label,
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
