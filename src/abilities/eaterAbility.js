import { DashEffect, WallSlamEffect } from "../combatEffects.js";
import { steerBallToward, Vector2 } from "../core.js";
import { Ability } from "./ability.js";

const FEAST_DURATION = 4.0;
const SWALLOW_HOLD_DURATION = 0.72;
const DEFENSE_MULT_DURING_FEAST = 1.5;
const SPIT_DASH_MULTIPLIER = 2;
const SPIT_SPEED_MULTIPLIER = 2;
const SPIT_MAX_DURATION = 2.45;
const WALL_SLAM_DAMAGE = 25;
const FEAST_HOMING_TURN_RATE = 3.5;

export class EaterAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 6.0);
        this.state = {
            feastTimer: 0,
            feastElapsed: 0,
            radiusScale: 1,
            swallowedTarget: null,
            swallowTimer: 0,
            spitDirection: new Vector2(1, 0),
            hasEatenThisFeast: false
        };
        this.feastDuration = FEAST_DURATION;
    }

    isFeasting() {
        return this.state.feastTimer > 0 && !this.state.hasEatenThisFeast;
    }

    update(delta, target) {
        this.updateRadiusScale(delta);

        // Update swallowed target position (runs even during feast)
        if (this.state.swallowedTarget) {
            this.state.swallowTimer -= delta;
            this.state.swallowedTarget.position = this.owner.position.clone();
            if (this.state.swallowTimer <= 0 || this.state.swallowedTarget.flags.defeated) {
                this.releaseSwallowed();
            }
        }

        // Feast mode: home toward target + passive defense
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

        // Cooldown timer only counts down when not feasting and not swallowing
        if (!this.state.swallowedTarget) {
            this.timer -= delta;
        }

        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this.state.feastTimer = this.feastDuration;
            this.state.feastElapsed = 0;
            this.state.hasEatenThisFeast = false;
            this.simulation.playSound("chomp", 0.8);
            this.simulation.spawnPulse(this.owner.position.clone(), this.owner.color);
            this.simulation.addLog(`${this.owner.name} enters feast mode.`);
        }
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
        this.state.swallowTimer = SWALLOW_HOLD_DURATION;
        this.state.spitDirection =
            this.owner.velocity.length() > 0
                ? this.owner.velocity.clone().normalize()
                : Vector2.subtract(target.position, this.owner.position).normalize();

        target.state.swallowed = { owner: this.owner };
        target.clearDash();
        target.applyImpulse(target.velocity.clone().scale(-1));
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

    releaseSwallowed() {
        const target = this.state.swallowedTarget;
        if (!target) {
            return;
        }

        // Reset cooldown timer after spitting
        this.timer = this.cooldown;

        if (target.flags.defeated) {
            target.state.swallowed = null;
            this.state.swallowedTarget = null;
            return;
        }

        const direction = this.state.spitDirection.clone().normalize();
        target.state.swallowed = null;
        target.position = Vector2.add(
            this.owner.position,
            direction.clone().scale(this.owner.radius + target.radius + 10)
        );
        target.initiateDash(direction, {
            duration: 2.45,
            multiplier: 2,
            speedOverride: target.stats.baseSpeed * 2,
            collisionLabel: "Spit Dash",
            showRing: false,
            noHeading: true
        });
        target.state.wallSlam = new WallSlamEffect({
            source: this.owner,
            damage: WALL_SLAM_DAMAGE,
            duration: SPIT_MAX_DURATION
        });
        this.simulation.keepInsideArena(target);
        this.simulation.playSound("spit", 1.2);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), this.owner.color);
        this.simulation.addSparkBurst(target.position.clone(), this.owner.color);
        this.simulation.addLog(`${this.owner.name} spits ${target.name} into the walls.`);
        this.state.swallowedTarget = null;
    }

    draw(ctx) {
        if (!this.isFeasting()) {
            return;
        }

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

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.22, -0.12, 0.06);
        this._dotEye(ctx, ball, 0.22, -0.12, 0.06);
        this._arc(ctx, ball, 0, 0.14, 0.24, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        if (this.state.swallowedTarget) {
            return { label: "Eating", progress: Math.max(0, Math.min(1, this.state.swallowTimer / 0.72)) };
        }
        if (this.state.feastTimer > 0) {
            return { label: "Feast", progress: Math.max(0, Math.min(1, this.state.feastTimer / this.feastDuration)) };
        }
        return { label: "Feast", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
    }
}
