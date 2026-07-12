import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";

const BASE_COOLDOWN = 2.7;
const PULSE_TORQUE = 50000;
const MAX_SPIN_VELOCITY = 3.0;
const OVERSPIN_THRESHOLD = 2.7;
const BASE_COLLISION_RETENTION = 0.64;
const SPIRAL_KNOCKBACK_THRESHOLD = 0.5;
const RING_SEGMENT_COUNT = 12;

export class SpinAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, BASE_COOLDOWN);
        this._spinDirection = owner.angularVelocity < 0 ? -1 : 1;
        this.state = { overspinRemaining: 0, pulseFlash: 0, overspinFlash: 0 };
        this.timer = this.getPulseCooldown();
    }

    update(delta) {
        this.state.overspinRemaining = Math.max(0, this.state.overspinRemaining - delta);
        this.state.pulseFlash = Math.max(0, this.state.pulseFlash - delta);
        this.state.overspinFlash = Math.max(0, this.state.overspinFlash - delta);

        this.timer -= delta;
        if (this.timer > 0) return;

        this.timer += this.getPulseCooldown();
        this._accelerateSpin();
    }

    getPulseCooldown() {
        return this.cooldown * (this.getLevelUpgrade().pulseCooldownMultiplier ?? 1);
    }

    getSpinVelocity() {
        return Math.max(0, this.owner.angularVelocity * this._spinDirection);
    }

    getRotationProgress() {
        return Math.max(0, Math.min(1, this.getSpinVelocity() / MAX_SPIN_VELOCITY));
    }

    getCollisionRetention() {
        return this.getLevelUpgrade().collisionRetentionRatio ?? BASE_COLLISION_RETENTION;
    }

    getSpiralKnockback() {
        return this.getLevelUpgrade().spiralKnockback ?? 0;
    }

    _accelerateSpin() {
        if (this._canTriggerOverspin()) {
            this._triggerOverspin();
            return;
        }

        if (this.getSpinVelocity() >= MAX_SPIN_VELOCITY) return;

        this.owner.applyTorque(this._spinDirection * PULSE_TORQUE);
        this.state.pulseFlash = 0.35;
        this.simulation.playSound("charge", 0.72);
        this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
            count: 10,
            speed: 150,
            radiusMin: 2,
            radiusMax: 4,
            upBias: 30,
            life: 0.55
        });
    }

    _canTriggerOverspin() {
        return (
            this.state.overspinRemaining <= 0 &&
            this.getSpinVelocity() >= OVERSPIN_THRESHOLD &&
            this.getLevelUpgrade().overspinDamageMultiplier != null
        );
    }

    _triggerOverspin() {
        const upgrade = this.getLevelUpgrade();
        this._setSpinVelocity(this.getSpinVelocity() * upgrade.overspinRetentionRatio);
        this.state.overspinRemaining = upgrade.overspinDuration;
        this.state.overspinFlash = upgrade.overspinDuration;
        this.simulation.spawnPulse(this.owner.position.clone(), "#ffe36d");
        this.simulation.spawnActionText(this.owner.position.clone(), "오버스핀!", "#ffe36d");
        this.simulation.playSound("rage", 0.95);
        this.simulation.addLog(`${this.owner.name} consumes spin for an overspin.`);
    }

    _setSpinVelocity(nextSpinVelocity) {
        this.owner._computeMomentOfInertia();
        const inverseMoment = this.owner._inverseMomentOfInertia;
        if (!Number.isFinite(inverseMoment) || inverseMoment <= 0) return;

        const targetAngularVelocity = this._spinDirection * Math.max(0, nextSpinVelocity);
        const angularImpulse = (targetAngularVelocity - this.owner.angularVelocity) / inverseMoment;
        this.owner.applyAngularImpulse(angularImpulse);
    }

    modifyOutgoingFighterCollisionDamage(amount) {
        if (amount <= 0 || this.state.overspinRemaining <= 0) return amount;

        this.state.overspinRemaining = 0;
        this.state.overspinFlash = 0.32;
        this.simulation.playSound("hit", 1.1);
        return Math.round(amount * this.getLevelUpgrade().overspinDamageMultiplier);
    }

    onCollision(target) {
        const rotationProgress = this.getRotationProgress();
        if (rotationProgress >= SPIRAL_KNOCKBACK_THRESHOLD && this.getSpiralKnockback() > 0) {
            this._applySpiralKnockback(target, rotationProgress);
        }
        this._setSpinVelocity(this.getSpinVelocity() * this.getCollisionRetention());
    }

    _applySpiralKnockback(target, rotationProgress) {
        const radial = Vector2.subtract(target.position, this.owner.position).normalize();
        const tangent = new Vector2(-radial.y * this._spinDirection, radial.x * this._spinDirection);
        const strength = this.getSpiralKnockback() * rotationProgress;
        target.applyKnockback(tangent.scale(strength), 0.22);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), "#ffe36d");
    }

    draw(ctx) {
        const progress = this.getRotationProgress();
        if (progress <= 0.02) return;

        const activeSegments = Math.max(1, Math.ceil(progress * RING_SEGMENT_COUNT));
        const { position, radius } = this.owner;
        const startAngle = this.owner.angle * this._spinDirection - Math.PI / 2;

        ctx.save();
        ctx.lineCap = "round";
        for (let index = 0; index < activeSegments; index += 1) {
            const segmentAngle = startAngle + (index / RING_SEGMENT_COUNT) * Math.PI * 2;
            ctx.strokeStyle = this.state.overspinRemaining > 0 ? "#ffe36d" : "#f6a23a";
            ctx.lineWidth = 3 + progress * 2;
            ctx.beginPath();
            ctx.arc(
                position.x,
                position.y,
                radius + 11 + progress * 8,
                segmentAngle,
                segmentAngle + (Math.PI * 2 * 0.62) / RING_SEGMENT_COUNT
            );
            ctx.stroke();
        }

        if (this.state.pulseFlash > 0 || this.state.overspinFlash > 0) {
            const flash = Math.max(this.state.pulseFlash / 0.35, this.state.overspinFlash / 0.32);
            ctx.globalAlpha = Math.min(1, flash);
            ctx.strokeStyle = this.state.overspinFlash > 0 ? "#fff4ae" : "#ffd07b";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(position.x, position.y, radius + 24 + progress * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        const gaze = this.getRotationProgress() * 0.08;
        this._arc(ctx, ball, -0.2, -0.05, 0.1, Math.PI * 0.1, Math.PI * 1.8);
        this._arc(ctx, ball, 0.2, -0.05, 0.1, Math.PI * 0.1, Math.PI * 1.8);
        this._dotEye(ctx, ball, -0.2 + gaze, -0.03, 0.052);
        this._dotEye(ctx, ball, 0.2 + gaze, -0.03, 0.052);
        this._arc(ctx, ball, 0, 0.25, 0.16, Math.PI + 0.2, Math.PI * 2 - 0.2);
        return true;
    }

    getUiState() {
        if (this.state.overspinRemaining > 0) {
            return { label: "오버스핀", progress: 1 };
        }
        return { label: "회전력", progress: Math.max(0.04, this.getRotationProgress()) };
    }
}
