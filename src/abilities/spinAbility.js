import { Vector2 } from "../core.js";
import { SpinCutEffect, SpinVortexEffect } from "../effects/spinEffects.js";
import { Ability } from "./ability.js";
import { SPIN_VORTEX_CONFIG } from "./spinConfig.js";

const BASE_CHARGE_TIME = 4.5;
const MAX_SPIN_REVOLUTIONS_PER_SECOND = 10;
const MAX_SPIN_VELOCITY = MAX_SPIN_REVOLUTIONS_PER_SECOND * Math.PI * 2;
const SPIN_RESPONSE_RATE = 15;
const BASE_COLLISION_RETENTION = 0;
const DISCHARGE_NOTICE_THRESHOLD = 0.55;
const FULL_CHARGE_THRESHOLD = 0.98;
const CHARGE_THRESHOLD_PARTICLES = 0.2;
const RING_SEGMENT_COUNT = 12;
const CUT_DURATION = 0.6;
const CUT_INTERVAL = 0.05;
const CUT_TICKS = 12;

function smoothstep(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
}

function toLocalAnchor(body, point) {
    const relative = Vector2.subtract(point, body.position);
    const angle = -(body.angle ?? 0);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return new Vector2(relative.x * cosine - relative.y * sine, relative.x * sine + relative.y * cosine);
}

function toWorldAnchor(body, localPoint) {
    const angle = body.angle ?? 0;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return Vector2.add(
        body.position,
        new Vector2(localPoint.x * cosine - localPoint.y * sine, localPoint.x * sine + localPoint.y * cosine)
    );
}

export class SpinAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, BASE_CHARGE_TIME);
        this._spinDirection = owner.angularVelocity < 0 ? -1 : 1;
        this.state = {
            timeWithoutCollision: 0,
            particleTimer: 0,
            readyFlash: 0,
            dischargeFlash: 0,
            cutFlash: 0,
            cut: null,
            vortexEffect: null
        };
    }

    update(delta) {
        this._tickVisualEffects(delta);
        if (this.state.cut) {
            this._updateCut(delta);
            return;
        }

        this._advanceCharge(delta);
        this._applyChargeTorque();
        this._emitChargeParticles(delta);
        this._applyVortex(delta);
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

    isFullyCharged() {
        return this.getChargeProgress() >= FULL_CHARGE_THRESHOLD;
    }

    beforeFighterCollision(target, context) {
        if (
            !this.getLevelUpgrade().surfaceCut ||
            !this.isFullyCharged() ||
            this.state.cut ||
            context.collisionReplaced
        ) {
            return null;
        }
        return {
            skipPhysicsOnly: true,
            deferredSpinCut: {
                start: (collisionContext) => this._startCut(target, collisionContext)
            }
        };
    }

    shouldSkipFighterCollision(target) {
        return this.state.cut?.target === target;
    }

    onCollision() {
        if (this.state.cut) return;
        this._consumeCharge(this.getChargeProgress());
    }

    _startCut(target, context) {
        const contactPoint =
            context.contactPoint?.clone?.() ?? Vector2.add(this.owner.position, target.position).scale(0.5);
        const direction = context.a === this.owner ? context.normal.clone() : context.normal.clone().scale(-1);
        const cut = {
            target,
            elapsed: 0,
            tickTimer: 0,
            tickCount: 0,
            direction,
            ownerAnchor: toLocalAnchor(this.owner, contactPoint),
            targetAnchor: toLocalAnchor(target, contactPoint),
            contactPoint,
            deferredRigidBodyResponse: context.deferredRigidBodyResponse ?? null
        };
        cut.visualEffect = new SpinCutEffect(this, cut);
        this.state.cut = cut;
        this.simulation.entities.push(cut.visualEffect);
        if (this.state.vortexEffect) {
            this.state.vortexEffect.isExpired = true;
            this.state.vortexEffect = null;
        }
        this.state.timeWithoutCollision = 0;
        this.state.dischargeFlash = 0.34;
        this.simulation.playSound("rage", 0.88);
    }

    _updateCut(delta) {
        const cut = this.state.cut;
        if (!cut) return;
        if (cut.target.flags.defeated) {
            this._finishCut(cut);
            return;
        }

        const activeDelta = Math.min(delta, Math.max(0, CUT_DURATION - cut.elapsed));
        cut.elapsed += activeDelta;
        cut.tickTimer += activeDelta;
        const reachesCutEnd = cut.elapsed + 1e-9 >= CUT_DURATION;
        if (!reachesCutEnd) this._applyCutConstraint(cut);
        this._updateCutContact(cut);

        while (cut.tickTimer + 1e-9 >= CUT_INTERVAL && cut.tickCount < CUT_TICKS) {
            cut.tickTimer -= CUT_INTERVAL;
            this._applyCutTick(cut);
            if (cut.target.flags.defeated) break;
        }

        if (cut.tickCount >= CUT_TICKS || cut.elapsed + 1e-9 >= CUT_DURATION || cut.target.flags.defeated) {
            this._finishCut(cut);
        }
    }

    _applyCutConstraint(cut) {
        const ownerPoint = toWorldAnchor(this.owner, cut.ownerAnchor);
        const targetPoint = toWorldAnchor(cut.target, cut.targetAnchor);
        const gap = Vector2.subtract(targetPoint, ownerPoint);
        const relativeVelocity = Vector2.subtract(cut.target.velocity, this.owner.velocity);
        const correction = gap.clone().scale(-18).subtract(relativeVelocity.scale(0.65));
        cut.target.applyImpulse(correction.clone().scale(0.5));
        this.owner.applyImpulse(correction.scale(-0.5));
    }

    _updateCutContact(cut) {
        const ownerPoint = toWorldAnchor(this.owner, cut.ownerAnchor);
        const targetPoint = toWorldAnchor(cut.target, cut.targetAnchor);
        cut.contactPoint = Vector2.add(ownerPoint, targetPoint).scale(0.5);
    }

    _applyCutTick(cut) {
        const tickIndex = cut.tickCount;
        const multiplier = this.getLevelUpgrade().acceleratingCut ? 0.1 + (0.2 * tickIndex) / (CUT_TICKS - 1) : 0.15;
        const result = cut.target.takeDamage(this.owner.getTotalAttackDamage() * multiplier, this.owner, "Spin Cut", {
            ignoreDefense: Boolean(this.getLevelUpgrade().piercingVortex),
            suppressDamageNumber: true
        });
        cut.tickCount += 1;
        this.state.cutFlash = 0.08;
        cut.visualEffect?.registerTick(cut.tickCount);
        this._spawnCutDamageNumber(cut, result, tickIndex);
    }

    _spawnCutDamageNumber(cut, result, tickIndex) {
        if (result.actualDamage <= 0) return;

        const tangent = new Vector2(-cut.direction.y, cut.direction.x);
        const textLane = tickIndex % 4;
        const tangentOffset = [-2.1, -0.7, 0.7, 2.1][textLane] * cut.target.radius;
        const normalOffset = [0.42, 0.58, 0.42, 0.58][textLane] * cut.target.radius;
        const textPosition = cut.contactPoint
            .clone()
            .add(tangent.clone().scale(tangentOffset))
            .add(cut.direction.clone().scale(normalOffset));
        const textVelocity = tangent
            .scale(cut.target.radius * (0.34 + textLane * 0.06))
            .add(cut.direction.clone().scale(-cut.target.radius * 0.16));
        const text = this.simulation.spawnDamageNumber(
            textPosition,
            result.actualDamage,
            result.isCritical ? "#ffdd00" : "#ffb347"
        );
        if (!text) return;

        text.fontSize = 11 + (tickIndex % 2);
        text.life = 0.22;
        text.maxLife = text.life;
        text.velocity = textVelocity;
        text.visibilityToken = "combatText";
    }

    _finishCut(cut) {
        if (this.state.cut !== cut) return;
        this.simulation.applyDeferredFighterRigidBodyCollision(cut.deferredRigidBodyResponse);
        this.simulation.spawnPulse(
            cut.contactPoint.clone(),
            this.getLevelUpgrade().piercingVortex ? "#fff4ae" : "#ffd07b"
        );
        this.simulation.playSound("hit", 1.05);
        cut.visualEffect?.finish();
        this.state.cut = null;
    }

    _tickVisualEffects(delta) {
        this.state.readyFlash = Math.max(0, this.state.readyFlash - delta);
        this.state.dischargeFlash = Math.max(0, this.state.dischargeFlash - delta);
        this.state.cutFlash = Math.max(0, this.state.cutFlash - delta);
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

    _consumeCharge(charge) {
        const nextCharge = charge * this.getCollisionRetention();
        this.state.timeWithoutCollision = this.getMaxChargeTime() * nextCharge;
        this.state.dischargeFlash = 0.34;
        this._applySpinVelocity(this.getTargetSpinVelocity());
        this._showChargeDischarge(charge);
    }

    _applySpinVelocity(nextSpinVelocity) {
        this.owner._computeMomentOfInertia();
        const inverseMoment = this.owner._inverseMomentOfInertia;
        if (!Number.isFinite(inverseMoment) || inverseMoment <= 0) return;

        const targetAngularVelocity = this._spinDirection * Math.max(0, nextSpinVelocity);
        const angularImpulse = (targetAngularVelocity - this.owner.angularVelocity) / inverseMoment;
        this.owner.applyAngularImpulse(angularImpulse);
    }

    _showChargeDischarge(charge) {
        this.simulation.spawnPulse(this.owner.position.clone(), "#f6a23a");
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#f6a23a", {
            count: 6 + Math.floor(charge * 10),
            speed: 100 + charge * 140,
            radiusMin: 2,
            radiusMax: 5,
            upBias: 20,
            life: 0.45
        });

        if (charge >= DISCHARGE_NOTICE_THRESHOLD) {
            this.simulation.spawnActionText(this.owner.position.clone(), "회전력 방출!", "#ffd07b");
            this.simulation.playSound("hit", 0.85);
        }
    }

    _applyVortex(delta) {
        const active = this.getLevelUpgrade().piercingVortex && this.isFullyCharged();
        if (!active) {
            this.state.vortexEffect = null;
            return;
        }

        for (const target of this.simulation.getEnemiesOf(this.owner)) {
            const acceleration = this.getVortexAccelerationAt(target.position);
            target.applyImpulse(acceleration.scale(delta));
        }
        if (!this.state.vortexEffect || this.state.vortexEffect.isExpired) {
            this.state.vortexEffect = new SpinVortexEffect(this);
            this.simulation.entities.push(this.state.vortexEffect);
        }
    }

    getVortexAccelerationAt(position) {
        const inward = Vector2.subtract(this.owner.position, position);
        const distance = inward.length();
        if (distance > SPIN_VORTEX_CONFIG.radius) return new Vector2();
        if (distance <= 1e-9) inward.add(new Vector2(1, 0));
        inward.normalize();
        const tangent = new Vector2(-inward.y * this._spinDirection, inward.x * this._spinDirection);
        const direction = tangent
            .scale(SPIN_VORTEX_CONFIG.tangentWeight)
            .add(inward.scale(SPIN_VORTEX_CONFIG.inwardWeight))
            .normalize();
        const ratio = Math.max(0, 1 - distance / SPIN_VORTEX_CONFIG.radius);
        return direction.scale(SPIN_VORTEX_CONFIG.maxAcceleration * smoothstep(ratio));
    }

    draw(ctx) {
        this._drawChargeRing(ctx);
    }

    _drawChargeRing(ctx) {
        const progress = this.getRotationProgress();
        if (progress <= 0.02) return;

        const activeSegments = Math.max(1, Math.ceil(progress * RING_SEGMENT_COUNT));
        const { position, radius } = this.owner;
        const startAngle = this.owner.angle * this._spinDirection - Math.PI / 2;

        ctx.save();
        ctx.lineCap = "round";
        for (const index of Array.from({ length: activeSegments }, (_, value) => value)) {
            const segmentAngle = startAngle + (index / RING_SEGMENT_COUNT) * Math.PI * 2;
            ctx.strokeStyle = this._isCutReady() ? "#ffe36d" : "#f6a23a";
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

        const flash = Math.max(this.state.readyFlash / 0.45, this.state.dischargeFlash / 0.34);
        if (flash > 0) {
            ctx.globalAlpha = Math.min(1, flash);
            ctx.strokeStyle = this._isCutReady() ? "#fff4ae" : "#ffd07b";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(position.x, position.y, radius + 24 + progress * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    _isCutReady() {
        return this.getLevelUpgrade().surfaceCut && this.isFullyCharged();
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
        if (this.state.cut) {
            return {
                label: `절단 ${this.state.cut.tickCount}/${CUT_TICKS}`,
                progress: this.state.cut.tickCount / CUT_TICKS
            };
        }
        if (this._isCutReady()) {
            return { label: "회전 절단", progress: 1 };
        }
        return { label: "회전력", progress: Math.max(0.04, this.getRotationProgress()) };
    }
}
