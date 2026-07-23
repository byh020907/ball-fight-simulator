import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export const HUNTING_TAP_ACCELERATION_VISUAL_CONFIG = Object.freeze({
    durationSeconds: 0.28,
    ignitionRatio: 0.48,
    trailPointLifetimeSeconds: 0.26,
    trailSampleIntervalSeconds: 0.025,
    minimumSampleDistanceRadiusRatio: 0.18,
    maximumTrailPointCount: 14,
    trailAnchorRadiusRatio: 0.78,
    seedLengthRadiusRatio: 0.72,
    minimumTrailWidthRadiusRatio: 0.16,
    maximumTrailWidthRadiusRatio: 0.44,
    trailWidthTaperExponent: 0.72,
    outlineWidthScale: 1.45,
    outlineAlpha: 0.18,
    minimumTrailAlpha: 0.34,
    maximumTrailAlpha: 0.68,
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
    return fighter.velocity.length() > 0
        ? fighter.velocity.clone().normalize()
        : Vector2.fromAngle(fighter.angle ?? 0, 1);
}

function getTrailAnchor(fighter, config) {
    return fighter.position
        .clone()
        .subtract(getTravelDirection(fighter).scale(fighter.radius * config.trailAnchorRadiusRatio));
}

function getTrailNormal(points, index) {
    const previous = points[Math.max(0, index - 1)].position;
    const next = points[Math.min(points.length - 1, index + 1)].position;
    const tangent = Vector2.subtract(next, previous).normalize();
    return new Vector2(-tangent.y, tangent.x);
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
        this.samples = [];
        this.sampleElapsed = 0;
        this.refresh(intensity);
        this._seedTrail();
    }

    refresh(intensity) {
        this.intensity = clampProgress(intensity);
        this.life = this.config.durationSeconds;
        this.ignitionLife = this.config.durationSeconds * this.config.ignitionRatio;
        this.isExpired = false;
    }

    _seedTrail() {
        const direction = getTravelDirection(this.fighter);
        const anchor = getTrailAnchor(this.fighter, this.config);
        this.samples.push({
            position: anchor.clone().subtract(direction.scale(this.fighter.radius * this.config.seedLengthRadiusRatio)),
            age: this.config.trailPointLifetimeSeconds * 0.45
        });
        this.samples.push({ position: anchor, age: 0 });
    }

    _recordTrailSample(delta) {
        this.sampleElapsed += delta;
        const anchor = getTrailAnchor(this.fighter, this.config);
        const latest = this.samples.at(-1);
        const minimumDistance = this.fighter.radius * this.config.minimumSampleDistanceRadiusRatio;
        const movedEnough = !latest || Vector2.subtract(anchor, latest.position).length() >= minimumDistance;
        if (!movedEnough && this.sampleElapsed < this.config.trailSampleIntervalSeconds) return;

        this.samples.push({ position: anchor, age: 0 });
        this.samples = this.samples.slice(-this.config.maximumTrailPointCount);
        this.sampleElapsed = 0;
    }

    update(delta) {
        if (!this.syncAttachedPosition() || this.fighter.flags.defeated || this.fighter.flags.destroyed) {
            this.isExpired = true;
            return;
        }
        this.life = Math.max(0, this.life - delta);
        this.ignitionLife = Math.max(0, this.ignitionLife - delta);
        this.samples.forEach((sample) => {
            sample.age += delta;
        });
        this.samples = this.samples.filter((sample) => sample.age < this.config.trailPointLifetimeSeconds);
        if (this.life > 0) this._recordTrailSample(delta);
        if (this.life === 0 && this.samples.length < 2) this.isExpired = true;
    }

    _drawTrailRibbon(ctx, points, widthScale, color, alpha) {
        const maximumWidth =
            this.fighter.radius *
            interpolate(
                this.config.minimumTrailWidthRadiusRatio,
                this.config.maximumTrailWidthRadiusRatio,
                this.intensity
            );
        const edges = points.map((sample, index) => {
            const pathProgress = index / Math.max(1, points.length - 1);
            const lifeProgress = 1 - sample.age / this.config.trailPointLifetimeSeconds;
            const width =
                maximumWidth *
                Math.pow(pathProgress, this.config.trailWidthTaperExponent) *
                Math.max(0, lifeProgress) *
                widthScale;
            const normal = getTrailNormal(points, index).scale(width);
            const local = Vector2.subtract(sample.position, this.position);
            return {
                left: Vector2.add(local, normal),
                right: Vector2.subtract(local, normal)
            };
        });

        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(edges[0].left.x, edges[0].left.y);
        edges.slice(1).forEach((edge) => ctx.lineTo(edge.left.x, edge.left.y));
        edges
            .slice()
            .reverse()
            .forEach((edge) => ctx.lineTo(edge.right.x, edge.right.y));
        ctx.closePath();
        ctx.fill();
    }

    draw(ctx) {
        const points = this.samples.filter((sample) => sample.age < this.config.trailPointLifetimeSeconds);

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        if (points.length >= 2) {
            this._drawTrailRibbon(ctx, points, this.config.outlineWidthScale, "#ffffff", this.config.outlineAlpha);
            this._drawTrailRibbon(
                ctx,
                points,
                1,
                this.fighter.color,
                interpolate(this.config.minimumTrailAlpha, this.config.maximumTrailAlpha, this.intensity)
            );
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
