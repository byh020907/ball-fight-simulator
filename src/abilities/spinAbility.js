import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";

const BASE_CHARGE_TIME = 4.5;
const MAX_SPIN_REVOLUTIONS_PER_SECOND = 10;
const MAX_SPIN_VELOCITY = MAX_SPIN_REVOLUTIONS_PER_SECOND * Math.PI * 2;
const SPIN_RESPONSE_RATE = 15;
const BASE_COLLISION_RETENTION = 0;
const SPIRAL_KNOCKBACK_THRESHOLD = 0.5;
const DISCHARGE_NOTICE_THRESHOLD = 0.55;
const FULL_CHARGE_THRESHOLD = 0.98;
const CHARGE_THRESHOLD_PARTICLES = 0.2;
const RING_SEGMENT_COUNT = 12;

export class SpinAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, BASE_CHARGE_TIME);
        this._spinDirection = owner.angularVelocity < 0 ? -1 : 1;
        this.state = {
            timeWithoutCollision: 0,
            particleTimer: 0,
            readyFlash: 0,
            dischargeFlash: 0,
            overspinFlash: 0,
            overspinHit: false
        };
    }

    update(delta) {
        this._tickVisualEffects(delta);
        this._advanceCharge(delta);
        this._applyChargeTorque();
        this._emitChargeParticles(delta);
    }

    getMaxChargeTime() {
        return this.cooldown;
    }

    getChargeProgress() {
        const maxChargeTime = this.getMaxChargeTime();
        if (maxChargeTime <= 0) return 0;
        return Math.max(0, Math.min(1, this.state.timeWithoutCollision / maxChargeTime));
    }

    getSpinVelocity() {
        return Math.max(0, this.owner.angularVelocity * this._spinDirection);
    }

    getTargetSpinVelocity() {
        return this.getChargeProgress() * MAX_SPIN_VELOCITY;
    }

    getRotationProgress() {
        return this.getChargeProgress();
    }

    getCollisionRetention() {
        return this.getLevelUpgrade().chargeRetentionRatio ?? BASE_COLLISION_RETENTION;
    }

    getSpiralKnockback() {
        return this.getLevelUpgrade().spiralKnockback ?? 0;
    }

    isFullyCharged() {
        return this.getChargeProgress() >= FULL_CHARGE_THRESHOLD;
    }

    modifyOutgoingFighterCollisionDamage(amount) {
        const overspinDamageMultiplier = this.getLevelUpgrade().overspinDamageMultiplier;
        if (amount <= 0 || !overspinDamageMultiplier || !this.isFullyCharged()) return amount;

        this.state.overspinHit = true;
        return Math.round(amount * overspinDamageMultiplier);
    }

    onCollision(target) {
        const charge = this.getChargeProgress();
        const wasOverspinHit = this.state.overspinHit;
        if (charge >= SPIRAL_KNOCKBACK_THRESHOLD && this.getSpiralKnockback() > 0) {
            this._applySpiralKnockback(target, charge);
        }
        this._consumeCharge(charge, wasOverspinHit);
    }

    _tickVisualEffects(delta) {
        this.state.readyFlash = Math.max(0, this.state.readyFlash - delta);
        this.state.dischargeFlash = Math.max(0, this.state.dischargeFlash - delta);
        this.state.overspinFlash = Math.max(0, this.state.overspinFlash - delta);
    }

    _advanceCharge(delta) {
        const wasFullyCharged = this.isFullyCharged();
        this.state.timeWithoutCollision = Math.min(this.getMaxChargeTime(), this.state.timeWithoutCollision + delta);
        if (!wasFullyCharged && this.isFullyCharged()) {
            this.state.readyFlash = 0.45;
            this.simulation.spawnPulse(this.owner.position.clone(), "#f6a23a");
            this.simulation.playSound("charge", 0.82);
        }
    }

    _applyChargeTorque() {
        const spinDifference = this.getTargetSpinVelocity() - this.getSpinVelocity();
        if (Math.abs(spinDifference) <= 0.01) return;

        this.owner._computeMomentOfInertia();
        const inverseMoment = this.owner._inverseMomentOfInertia;
        if (!Number.isFinite(inverseMoment) || inverseMoment <= 0) return;

        const torque = (spinDifference * SPIN_RESPONSE_RATE) / inverseMoment;
        this.owner.applyTorque(this._spinDirection * torque);
    }

    _emitChargeParticles(delta) {
        const charge = this.getChargeProgress();
        if (charge <= CHARGE_THRESHOLD_PARTICLES) return;

        this.state.particleTimer -= delta;
        if (this.state.particleTimer > 0) return;

        this.state.particleTimer = 0.2 - charge * 0.1;
        this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
            count: 1 + Math.floor(charge * 3),
            speed: 90 + charge * 100,
            radiusMin: 2,
            radiusMax: 4,
            upBias: 30,
            life: 0.55
        });
    }

    _consumeCharge(charge, wasOverspinHit) {
        const nextCharge = charge * this.getCollisionRetention();
        this.state.timeWithoutCollision = this.getMaxChargeTime() * nextCharge;
        this.state.dischargeFlash = 0.34;
        this.state.overspinHit = false;
        this._applySpinVelocity(this.getTargetSpinVelocity());
        this._showChargeDischarge(charge, wasOverspinHit);
    }

    _applySpinVelocity(nextSpinVelocity) {
        this.owner._computeMomentOfInertia();
        const inverseMoment = this.owner._inverseMomentOfInertia;
        if (!Number.isFinite(inverseMoment) || inverseMoment <= 0) return;

        const targetAngularVelocity = this._spinDirection * Math.max(0, nextSpinVelocity);
        const angularImpulse = (targetAngularVelocity - this.owner.angularVelocity) / inverseMoment;
        this.owner.applyAngularImpulse(angularImpulse);
    }

    _showChargeDischarge(charge, wasOverspinHit) {
        const color = wasOverspinHit ? "#ffe36d" : "#f6a23a";
        this.simulation.spawnPulse(this.owner.position.clone(), color);
        this.simulation.spawnParticleBurst(this.owner.position.clone(), color, {
            count: 6 + Math.floor(charge * 10),
            speed: 100 + charge * 140,
            radiusMin: 2,
            radiusMax: 5,
            upBias: 20,
            life: 0.45
        });

        if (wasOverspinHit) {
            this.state.overspinFlash = 0.45;
            this.simulation.spawnActionText(this.owner.position.clone(), "오버스핀!", "#ffe36d");
            this.simulation.playSound("rage", 0.95);
            return;
        }

        if (charge >= DISCHARGE_NOTICE_THRESHOLD) {
            this.simulation.spawnActionText(this.owner.position.clone(), "회전력 방출!", "#ffd07b");
            this.simulation.playSound("hit", 0.85);
        }
    }

    _applySpiralKnockback(target, charge) {
        const radial = Vector2.subtract(target.position, this.owner.position).normalize();
        const tangent = new Vector2(-radial.y * this._spinDirection, radial.x * this._spinDirection);
        const strength = this.getSpiralKnockback() * charge;
        target.applyKnockback(tangent.scale(strength), 0.22);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), "#ffe36d");
    }

    _isOverspinReady() {
        return this.getLevelUpgrade().overspinDamageMultiplier != null && this.isFullyCharged();
    }

    draw(ctx) {
        const progress = this.getRotationProgress();
        if (progress <= 0.02) return;

        const activeSegments = Math.max(1, Math.ceil(progress * RING_SEGMENT_COUNT));
        const { position, radius } = this.owner;
        const startAngle = this.owner.angle * this._spinDirection - Math.PI / 2;
        const overspinReady = this._isOverspinReady();

        ctx.save();
        ctx.lineCap = "round";
        for (let index = 0; index < activeSegments; index += 1) {
            const segmentAngle = startAngle + (index / RING_SEGMENT_COUNT) * Math.PI * 2;
            ctx.strokeStyle = overspinReady ? "#ffe36d" : "#f6a23a";
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

        const flash = Math.max(
            this.state.readyFlash / 0.45,
            this.state.dischargeFlash / 0.34,
            this.state.overspinFlash / 0.45
        );
        if (flash > 0) {
            ctx.globalAlpha = Math.min(1, flash);
            ctx.strokeStyle = this.state.overspinFlash > 0 || overspinReady ? "#fff4ae" : "#ffd07b";
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
        if (this._isOverspinReady()) {
            return { label: "오버스핀", progress: 1 };
        }
        return { label: "회전력", progress: Math.max(0.04, this.getRotationProgress()) };
    }
}
