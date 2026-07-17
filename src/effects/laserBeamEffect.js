import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

const RAY_EPSILON = 0.01;
const PHASE_EPSILON = 1e-9;
const LASER_DAMAGE_TICK = 0.05;

function distanceToSegment(point, start, end) {
    const segment = Vector2.subtract(end, start);
    const offset = Vector2.subtract(point, start);
    const lengthSquared = segment.dot(segment);
    const progress = lengthSquared > 0 ? Math.max(0, Math.min(1, offset.dot(segment) / lengthSquared)) : 0;
    const closest = Vector2.add(start, segment.scale(progress));
    return Vector2.subtract(point, closest).length();
}

export function circleIntersectsLaserSegment(target, segment) {
    return distanceToSegment(target.position, segment.start, segment.end) <= target.radius;
}

export function getArenaWallRay(origin, angle, width, height) {
    const direction = Vector2.fromAngle(angle, 1).normalize();
    const candidates = [];
    if (direction.x > 0) {
        candidates.push({ time: (width - origin.x) / direction.x, normal: new Vector2(-1, 0), axis: "x" });
    } else if (direction.x < 0) {
        candidates.push({ time: -origin.x / direction.x, normal: new Vector2(1, 0), axis: "x" });
    }
    if (direction.y > 0) {
        candidates.push({ time: (height - origin.y) / direction.y, normal: new Vector2(0, -1), axis: "y" });
    } else if (direction.y < 0) {
        candidates.push({ time: -origin.y / direction.y, normal: new Vector2(0, 1), axis: "y" });
    }
    const valid = candidates.filter((candidate) => candidate.time >= -RAY_EPSILON);
    valid.sort((a, b) => a.time - b.time || (a.axis === "x" ? -1 : 1));
    const hit = valid[0] ?? { time: 0, normal: new Vector2(-direction.x, -direction.y) };
    const end = Vector2.add(origin, direction.clone().scale(Math.max(0, hit.time)));
    return { start: origin.clone(), end, direction, normal: hit.normal, length: Math.max(0, hit.time) };
}

export function traceArenaLaserSegments(origin, angle, width, height, maxWallBounces = 0) {
    const segments = [];
    let start = origin.clone();
    let direction = Vector2.fromAngle(angle, 1).normalize();
    for (let bounce = 0; bounce <= maxWallBounces; bounce += 1) {
        const ray = getArenaWallRay(start, Math.atan2(direction.y, direction.x), width, height);
        segments.push({ ...ray, bounceIndex: bounce });
        if (bounce >= maxWallBounces) break;
        const dot = direction.dot(ray.normal);
        direction = direction
            .clone()
            .subtract(ray.normal.clone().scale(2 * dot))
            .normalize();
        start = Vector2.add(ray.end, direction.clone().scale(RAY_EPSILON));
    }
    return segments;
}

export function drawLaserSegments(ctx, segments, { alpha = 1, color = "#ff5656" } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    segments.forEach((segment) => {
        const reflected = segment.bounceIndex > 0;
        ctx.strokeStyle = reflected ? "#fff1ed" : color;
        ctx.lineWidth = getVisibleLineWidth(ctx, reflected ? "emphasis" : "standard", reflected ? 9 : 7);
        ctx.beginPath();
        ctx.moveTo(segment.start.x, segment.start.y);
        ctx.lineTo(segment.end.x, segment.end.y);
        ctx.stroke();
        if (reflected) {
            const tailDirection = segment.direction.clone();
            const tailNormal = new Vector2(-tailDirection.y, tailDirection.x);
            ctx.strokeStyle = "#ff8b2f";
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 4);
            ctx.beginPath();
            ctx.moveTo(segment.start.x, segment.start.y);
            for (const index of [1, 2, 3, 4]) {
                const point = Vector2.add(
                    segment.start,
                    tailDirection
                        .clone()
                        .scale(index * 12)
                        .add(tailNormal.clone().scale(index % 2 === 0 ? -5 : 5))
                );
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(segment.start.x, segment.start.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.restore();
}

export class LaserBeamEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(source, target, { chargeDuration = 0.35, fireDuration = 0.3, maxWallBounces = 0 } = {}) {
        super(source.position.clone(), new Vector2(), 0);
        this.source = source;
        this.target = target;
        this.chargeDuration = chargeDuration;
        this.fireDuration = fireDuration;
        this.chargeRemaining = chargeDuration;
        this.fireRemaining = fireDuration;
        this.maxWallBounces = maxWallBounces;
        this.life = chargeDuration + fireDuration;
        this.phase = "charge";
        this.angle = 0;
        this.segments = [];
        this.damageTickInterval = fireDuration / Math.max(1, Math.ceil(fireDuration / LASER_DAMAGE_TICK));
        this.damageTickAccumulator = 0;
        this.hitSegmentsByTarget = new Map();
    }

    update(delta, simulation) {
        if (this.source.flags.defeated) {
            this.isExpired = true;
            return;
        }
        this.pos = this.source.position.clone();
        let remainingDelta = Math.max(0, delta);
        while (remainingDelta > PHASE_EPSILON && !this.isExpired) {
            if (this.phase === "charge") {
                this._trackChargeTarget();
                const chargeSlice = Math.min(remainingDelta, this.chargeRemaining);
                this.chargeRemaining = Math.max(0, this.chargeRemaining - chargeSlice);
                remainingDelta -= chargeSlice;
                this._syncLife();
                if (this.chargeRemaining <= PHASE_EPSILON) this._lockBeam(simulation);
                continue;
            }

            const fireSlice = Math.min(remainingDelta, this.fireRemaining);
            this._advanceFire(fireSlice, simulation);
            this.fireRemaining = Math.max(0, this.fireRemaining - fireSlice);
            remainingDelta -= fireSlice;
            this._syncLife();
            if (this.fireRemaining <= PHASE_EPSILON) this._finish(simulation);
        }
    }

    _trackChargeTarget() {
        if (!this.target?.flags?.defeated) {
            const direction = Vector2.subtract(this.target.position, this.source.position);
            if (direction.length() > 0) this.angle = Math.atan2(direction.y, direction.x);
        }
    }

    _syncLife() {
        this.life = this.chargeRemaining + this.fireRemaining;
    }

    _advanceFire(delta, simulation) {
        this.damageTickAccumulator += delta;
        while (this.damageTickAccumulator + PHASE_EPSILON >= this.damageTickInterval) {
            this.damageTickAccumulator -= this.damageTickInterval;
            this._dealBeamTick(this.damageTickInterval, simulation);
        }
    }

    _dealBeamTick(activeDuration, simulation) {
        for (const target of simulation.getEnemiesOf(this.source)) {
            this.segments.forEach((segment, index) => {
                if (!circleIntersectsLaserSegment(target, segment)) return;
                const rawDamage = this.source.stats.baseDamage * 0.6 * (activeDuration / this.fireDuration);
                const { actualDamage } = target.takeDamage(rawDamage, this.source, "Dash Laser");
                if (actualDamage <= 0) return;
                const hitSegments = this.hitSegmentsByTarget.get(target) ?? new Set();
                hitSegments.add(index);
                this.hitSegmentsByTarget.set(target, hitSegments);
            });
        }
    }

    _lockBeam(simulation) {
        this.phase = "fire";
        this.chargeRemaining = 0;
        this._syncLife();
        this.segments = traceArenaLaserSegments(
            this.source.position,
            this.angle,
            simulation.width,
            simulation.height,
            this.maxWallBounces
        );
        for (const segment of this.segments.slice(1)) {
            simulation.addSparkBurst(segment.start.clone(), "#fff1ed");
        }
        simulation.playSound("laser", 0.9);
    }

    _finish(simulation) {
        if (this.maxWallBounces > 0 && this.source.progression?.abilityTier >= 3) {
            for (const [target, segments] of this.hitSegmentsByTarget) {
                if (segments.size < 2 || target.flags.defeated) continue;
                this._triggerOverload(target, simulation);
            }
        }
        this.isExpired = true;
    }

    _triggerOverload(target, simulation) {
        const center = target.position.clone();
        for (const enemy of simulation.getEnemiesOf(this.source)) {
            if (Vector2.subtract(enemy.position, center).length() > 100) continue;
            enemy.takeDamage(this.source.stats.baseDamage, this.source, "Cross Overload");
        }
        simulation.spawnExplosion(center, "#ff8b2f");
        simulation.spawnPulse(center, "#ffffff");
        simulation.entities.push(new CrossOverloadEffect(center, 100));
    }

    draw(ctx) {
        if (this.phase === "charge") {
            const end = this.target?.flags?.defeated
                ? Vector2.add(this.position, Vector2.fromAngle(this.angle, 120))
                : this.target.position;
            ctx.save();
            ctx.strokeStyle = "rgba(255, 82, 82, 0.72)";
            ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 2);
            ctx.setLineDash([8, 7]);
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.restore();
            return;
        }
        drawLaserSegments(ctx, this.segments, { color: "#ff4d4d" });
        for (const [target, segments] of this.hitSegmentsByTarget) {
            if (segments.size < 2 || target.flags.defeated) continue;
            ctx.save();
            ctx.strokeStyle = "#ff9b35";
            ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
            const r = target.radius + 8;
            ctx.beginPath();
            ctx.moveTo(target.position.x - r, target.position.y);
            ctx.lineTo(target.position.x + r, target.position.y);
            ctx.moveTo(target.position.x, target.position.y - r);
            ctx.lineTo(target.position.x, target.position.y + r);
            ctx.stroke();
            ctx.restore();
        }
    }
}

export class CrossOverloadEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(center, radius) {
        super(center.clone(), new Vector2(), 0);
        this.maxRadius = radius;
        this.life = 0.32;
        this.maxLife = this.life;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - this.life / this.maxLife;
        const radius = this.maxRadius * (0.25 + progress * 0.75);
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = "#ff8b2f";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 6);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.moveTo(this.position.x - radius * 0.7, this.position.y - radius * 0.7);
        ctx.lineTo(this.position.x + radius * 0.7, this.position.y + radius * 0.7);
        ctx.moveTo(this.position.x + radius * 0.7, this.position.y - radius * 0.7);
        ctx.lineTo(this.position.x - radius * 0.7, this.position.y + radius * 0.7);
        ctx.stroke();
        ctx.restore();
    }
}
