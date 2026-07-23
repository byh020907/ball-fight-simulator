import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export const HUNTING_TAP_ACCELERATION_VISUAL_CONFIG = Object.freeze({
    durationSeconds: 0.34,
    ignitionRatio: 0.48,
    minimumStreakCount: 4,
    maximumStreakCount: 9,
    minimumLengthRadiusRatio: 1.5,
    maximumLengthRadiusRatio: 3.8,
    lateralSpreadRadiusRatio: 1.25,
    minimumParticleCount: 5,
    maximumParticleCount: 12,
    minimumParticleSpeed: 120,
    maximumParticleSpeed: 240,
    particleLifeSeconds: 0.34,
    particleSpreadRadians: Math.PI * 0.38
});

function clampProgress(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function interpolate(minimum, maximum, progress) {
    return minimum + (maximum - minimum) * clampProgress(progress);
}

function getTravelDirection(fighter) {
    return fighter.velocity.length() > 0 ? fighter.velocity.clone().normalize() : Vector2.fromAngle(fighter.angle ?? 0);
}

export class HuntingTapAccelerationEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(fighter, intensity, config = HUNTING_TAP_ACCELERATION_VISUAL_CONFIG) {
        super(fighter.position.clone(), new Vector2(), 0);
        this.fighter = fighter;
        this.config = config;
        this.attachToEntity(fighter);
        this.intensity = 0;
        this.life = 0;
        this.ignitionLife = 0;
        this.refresh(intensity);
    }

    refresh(intensity) {
        this.intensity = clampProgress(intensity);
        this.life = this.config.durationSeconds;
        this.ignitionLife = this.config.durationSeconds * this.config.ignitionRatio;
        this.isExpired = false;
    }

    update(delta) {
        if (!this.syncAttachedPosition() || this.fighter.flags.defeated || this.fighter.flags.destroyed) {
            this.isExpired = true;
            return;
        }
        this.life = Math.max(0, this.life - delta);
        this.ignitionLife = Math.max(0, this.ignitionLife - delta);
        if (this.life === 0) this.isExpired = true;
    }

    draw(ctx) {
        const direction = getTravelDirection(this.fighter);
        const fade = Math.min(1, this.life / (this.config.durationSeconds * 0.45));
        const streakCount = Math.round(
            interpolate(this.config.minimumStreakCount, this.config.maximumStreakCount, this.intensity)
        );
        const streakLength =
            this.fighter.radius *
            interpolate(this.config.minimumLengthRadiusRatio, this.config.maximumLengthRadiusRatio, this.intensity);
        const spread = this.fighter.radius * this.config.lateralSpreadRadiusRatio;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(Math.atan2(direction.y, direction.x));
        ctx.lineCap = "round";
        for (let index = 0; index < streakCount; index += 1) {
            const lane = streakCount === 1 ? 0 : index / (streakCount - 1) - 0.5;
            const laneEnvelope = 1 - Math.abs(lane) * 0.34;
            const startX = -this.fighter.radius * (0.76 + (index % 2) * 0.12);
            const endX = startX - streakLength * laneEnvelope;
            const y = lane * spread * 2;

            ctx.globalAlpha = fade * (0.32 + this.intensity * 0.24);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 4.2);
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();

            ctx.globalAlpha = fade * (0.68 + this.intensity * 0.28);
            ctx.strokeStyle = this.fighter.color;
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.3);
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }

        if (this.ignitionLife > 0) {
            const ignitionDuration = this.config.durationSeconds * this.config.ignitionRatio;
            const ignitionProgress = 1 - this.ignitionLife / ignitionDuration;
            ctx.globalAlpha = (1 - ignitionProgress) * (0.64 + this.intensity * 0.3);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4.5);
            ctx.beginPath();
            ctx.arc(0, 0, this.fighter.radius * (1.05 + ignitionProgress * 0.72), 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

export function spawnHuntingTapAccelerationFeedback(
    simulation,
    fighter,
    intensity,
    config = HUNTING_TAP_ACCELERATION_VISUAL_CONFIG
) {
    const normalizedIntensity = clampProgress(intensity);
    let effect = simulation.entities.find(
        (entity) => entity instanceof HuntingTapAccelerationEffect && entity.fighter === fighter && !entity.isExpired
    );
    if (effect) {
        effect.refresh(normalizedIntensity);
    } else {
        effect = new HuntingTapAccelerationEffect(fighter, normalizedIntensity, config);
        simulation.entities.push(effect);
    }

    const direction = getTravelDirection(fighter);
    const origin = fighter.position.clone().subtract(direction.clone().scale(fighter.radius * 0.9));
    const particleCount = Math.round(
        interpolate(config.minimumParticleCount, config.maximumParticleCount, normalizedIntensity)
    );
    const particleSpeed = interpolate(config.minimumParticleSpeed, config.maximumParticleSpeed, normalizedIntensity);
    const particleOptions = {
        count: particleCount,
        speed: particleSpeed,
        radiusMin: 1.5,
        radiusMax: 3.2,
        life: config.particleLifeSeconds,
        gravity: 0,
        upBias: 0,
        direction: direction.scale(-1),
        spread: config.particleSpreadRadians
    };
    simulation.spawnParticleBurst(origin, fighter.color, particleOptions);
    simulation.spawnParticleBurst(origin, "#ffffff", {
        ...particleOptions,
        count: Math.max(2, Math.round(particleCount * 0.35)),
        radiusMin: 1,
        radiusMax: 2
    });
    return effect;
}
