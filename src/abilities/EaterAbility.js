import { TimedEffect, Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

export class EaterAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this._baseCooldown = 7.2;
        this.timer = 2.4;
        this.feastDuration = 3.3;
        this.feastTimer = 0;
        this.feastElapsed = 0;
        this.radiusScale = 1;
        this.swallowedTarget = null;
        this.swallowTimer = 0;
        this.spitDirection = new Vector2(1, 0);
        this.hasEatenThisFeast = false;
    }

    isFeasting() {
        return this.feastTimer > 0 && !this.hasEatenThisFeast;
    }

    update(delta, target) {
        this.updateRadiusScale(delta);

        // Update swallowed target position (runs even during feast)
        if (this.swallowedTarget) {
            this.swallowTimer -= delta;
            this.swallowedTarget.position = this.owner.position.clone();
            if (this.swallowTimer <= 0 || this.swallowedTarget.isDefeated) {
                this.releaseSwallowed();
            }
        }

        // Feast mode: home toward target + passive defense
        if (this.isFeasting()) {
            this.feastTimer = Math.max(0, this.feastTimer - delta);
            this.feastElapsed = Math.min(this.feastDuration, this.feastElapsed + delta);

            if (target && !target.isDefeated && !this.swallowedTarget) {
                // Direct velocity override: go straight toward target
                const dir = Vector2.subtract(target.position, this.owner.position).normalize();
                this.owner.velocity = dir.scale(this.owner.velocity.length() || this.owner.baseSpeed);
                this.owner.forceHeading(dir, 0.2);
            }

            if (this.feastTimer > 0 && !this.swallowedTarget && Math.random() < delta * 8) {
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

        // Cooldown timer only counts down when not feasting
        this.timer -= delta;

        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this.feastTimer = this.feastDuration;
            this.feastElapsed = 0;
            this.hasEatenThisFeast = false;
            this.simulation.playSound("chomp", 0.8);
            this.simulation.spawnPulse(this.owner.position.clone(), this.owner.color);
            this.simulation.addLog(`${this.owner.name} enters feast mode.`);
        }
    }

    getStatModifiers() {
        const def = this.isFeasting() ? 3 : 1.5;
        return { speed: 0.95, damage: 1, defense: def, impact: 1 };
    }

    onCollision(target) {
        if (
            !this.isFeasting() ||
            this.hasEatenThisFeast ||
            this.swallowedTarget ||
            target.swallowedState ||
            target.isDefeated
        ) {
            return;
        }

        this.hasEatenThisFeast = true;
        this.feastTimer = Math.min(this.feastTimer, 0.28);
        this.swallowedTarget = target;
        this.swallowTimer = 0.72;
        this.spitDirection =
            this.owner.velocity.length() > 0
                ? this.owner.velocity.clone().normalize()
                : Vector2.subtract(target.position, this.owner.position).normalize();

        target.swallowedState = { owner: this.owner };
        target.clearDash();
        target.velocity = new Vector2();
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
        const target = this.swallowedTarget;
        if (!target) {
            return;
        }

        if (target.isDefeated) {
            target.swallowedState = null;
            this.swallowedTarget = null;
            return;
        }

        const direction = this.spitDirection.clone().normalize();
        target.swallowedState = null;
        target.position = Vector2.add(
            this.owner.position,
            direction.clone().scale(this.owner.radius + target.radius + 10)
        );
        target.startDash(direction, {
            multiplier: 2,
            speedOverride: target.baseSpeed * 2,
            color: target.color,
            collisionDamage: 0,
            collisionLabel: "Spit Dash",
            lockHeading: false,
            showSpeedRing: false,
            maxDuration: 2.45
        });
        target.wallSlamState = {
            effect: new TimedEffect(2.45),
            source: this.owner,
            damage: 8,
            cooldown: 0
        };
        this.simulation.keepInsideArena(target);
        this.simulation.playSound("spit", 1.2);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), this.owner.color);
        this.simulation.addSparkBurst(target.position.clone(), this.owner.color);
        this.simulation.addLog(`${this.owner.name} spits ${target.name} into the walls.`);
        this.swallowedTarget = null;
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
        const activeProgress = this.feastTimer > 0 ? Math.min(1, this.feastElapsed / this.feastDuration) : 0;
        const targetScale = this.feastTimer > 0 ? 1 + activeProgress : 1;
        const smoothing = 1 - Math.exp(-delta * (targetScale > this.radiusScale ? 4.8 : 7.2));
        this.radiusScale += (targetScale - this.radiusScale) * smoothing;
        if (Math.abs(this.radiusScale - 1) < 0.01 && targetScale === 1) {
            this.radiusScale = 1;
        }
    }

    getRadiusScale() {
        return Math.max(1, Math.min(2, this.radiusScale));
    }

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.22, -0.12, 0.06);
        this._dotEye(ctx, ball, 0.22, -0.12, 0.06);
        this._arc(ctx, ball, 0, 0.14, 0.24, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        if (this.swallowedTarget) {
            return { label: "Eating", progress: Math.max(0, Math.min(1, this.swallowTimer / 0.72)) };
        }
        if (this.feastTimer > 0) {
            return { label: "Feast", progress: Math.max(0, Math.min(1, this.feastTimer / this.feastDuration)) };
        }
        return { label: "Feast", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
    }
}
