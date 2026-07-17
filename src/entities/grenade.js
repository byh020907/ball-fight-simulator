import { CombatEntity, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "../effects/effectVisibility.js";
import { applyBurningEffect } from "../effects/index.js";
import { steerProjectileVelocityToward } from "../physics/projectileSteering.js";

const PROXIMITY_FUSE_BASE_MULTIPLIER = 3;
const PROXIMITY_FUSE_MAX_MULTIPLIER = 6;
const EXPLOSION_RADIUS = 174;
const EXPLOSION_INNER_RADIUS = 72;
const STICKY_HOMING_DELAY = 0.5;
const STICKY_HOMING_TURN_RATE = 2;
const STICKY_HOMING_TRAIL_LENGTH = 8;

export class Grenade extends CombatEntity {
    constructor(owner, targetPosition, fuseTime = 1.08, options = {}) {
        const start = owner.position.clone();
        const safeFuse = Math.max(0.32, fuseTime);
        const targetOffset = Vector2.subtract(targetPosition, start);
        const fallbackSpeed = targetOffset.length() / safeFuse;
        const launchSpeed = options.launchSpeed ?? (owner.stats?.baseSpeed ?? fallbackSpeed) * 1.1;
        const drift =
            targetOffset.length() > 0 ? targetOffset.normalize().scale(launchSpeed) : Vector2.fromAngle(0, launchSpeed);
        super(start, drift, 12);
        this.owner = owner;
        this.ownerId = owner.id;
        this.timer = safeFuse;
        this.maxTimer = this.timer;
        this.launchSpeed = drift.length();
        this._proximityFuseMultiplier = 1;
        this.explosionRadius = EXPLOSION_RADIUS;
        this.innerRadius = EXPLOSION_INNER_RADIUS;
        this.stickyEnabled = options.sticky ?? false;
        this.burningEnabled = options.burning ?? false;
        this.stickyHomingEnabled = options.stickyHoming ?? false;
        this.stickyTarget = null;
        this.stickyLocalOffset = null;
        this.stickyLocalSurfaceOffset = null;
        this.stickyLocalAngle = null;
        this.bounces = 0;
        this.maxBounces = 4;
        this.launchElapsed = 0;
        this.homingTrail = [];
    }

    update(delta, simulation) {
        if (this.stickyTarget) {
            this._followStickyTarget();
            this.timer -= delta;
            if (this.timer <= 0) this._detonate(simulation);
            return;
        }
        const preHomingDelta = Math.min(delta, Math.max(0, STICKY_HOMING_DELAY - this.launchElapsed));
        if (preHomingDelta > 0 && this._updateFlying(preHomingDelta, simulation, false)) return;

        const homingDelta = delta - preHomingDelta;
        if (homingDelta > 0) this._updateFlying(homingDelta, simulation, true);
    }

    _updateFlying(delta, simulation, canHome) {
        const previousPosition = this.position.clone();
        const homingTarget = canHome ? this._getStickyHomingTarget(simulation) : null;
        if (homingTarget) {
            steerProjectileVelocityToward(this, homingTarget.position, delta, STICKY_HOMING_TURN_RATE);
        } else {
            this.homingTrail = [];
        }
        const travelSpeed = this.velocity.length();
        this.integrate(delta);
        this.launchElapsed += delta;
        if (homingTarget) this._recordHomingTrail();

        if (this.stickyEnabled && this._tryStick(previousPosition, simulation)) {
            this.timer -= delta;
            if (this.timer <= 0) this._detonate(simulation);
            return true;
        }

        if (this.bounces < this.maxBounces) {
            const bx = this.position.x,
                by = this.position.y;
            simulation.keepEntityInsideArena(this);
            if (this.position.x !== bx || this.position.y !== by) {
                this.bounces++;
                simulation.playSound("bounce", 0.5);
            }
        }

        // 이동 경로가 상대 폭발권을 스치면 탄속 비례로 퓨즈 소모 속도를 높인다.
        if (!this._proximityTriggered) {
            for (const target of simulation.getEnemiesOf(this.owner)) {
                if (this._crossedExplosionRange(previousPosition, target.position)) {
                    this._activateProximityFuse(travelSpeed);
                    break;
                }
            }
        }

        this.timer -= delta * this._proximityFuseMultiplier;
        if (this.timer > 0) {
            return false;
        }

        this._detonate(simulation);
        return true;
    }

    _getStickyHomingTarget(simulation) {
        if (!this.stickyHomingEnabled || this.stickyTarget) return null;
        return simulation
            .getEnemiesOf(this.owner)
            .filter((target) => this._isValidStickyHomingTarget(target))
            .sort(
                (a, b) =>
                    Vector2.subtract(a.position, this.position).length() -
                    Vector2.subtract(b.position, this.position).length()
            )[0];
    }

    _isValidStickyHomingTarget(target) {
        const marker = target?._stickyGrenade;
        return Boolean(
            !target?.flags?.defeated &&
            marker &&
            !marker.isExpired &&
            marker !== this &&
            marker.ownerId === this.ownerId &&
            marker.stickyTarget === target
        );
    }

    _recordHomingTrail() {
        this.homingTrail.push(this.position.clone());
        if (this.homingTrail.length > STICKY_HOMING_TRAIL_LENGTH) this.homingTrail.shift();
    }

    _crossedExplosionRange(startPosition, targetPosition) {
        const path = Vector2.subtract(this.position, startPosition);
        const targetOffset = Vector2.subtract(targetPosition, startPosition);
        const pathLengthSquared = path.x * path.x + path.y * path.y;
        const pathProgress =
            pathLengthSquared > 0
                ? Math.max(0, Math.min(1, (targetOffset.x * path.x + targetOffset.y * path.y) / pathLengthSquared))
                : 0;
        const closestPoint = Vector2.add(startPosition, path.scale(pathProgress));
        return Vector2.subtract(targetPosition, closestPoint).length() <= this.explosionRadius;
    }

    _activateProximityFuse(travelSpeed) {
        const speedRatio = travelSpeed / Math.max(1, this.launchSpeed);
        this._proximityFuseMultiplier = Math.max(
            PROXIMITY_FUSE_BASE_MULTIPLIER,
            Math.min(PROXIMITY_FUSE_MAX_MULTIPLIER, PROXIMITY_FUSE_BASE_MULTIPLIER * speedRatio)
        );
        this._proximityTriggered = true;
    }

    _tryStick(previousPosition, simulation) {
        const contacts = simulation
            .getEnemiesOf(this.owner)
            .map((target, order) => ({ ...this._getSweptContact(previousPosition, this.position, target), order }))
            .filter((contact) => contact.target)
            .sort((a, b) => a.time - b.time || a.order - b.order);
        const contact = contacts[0];
        if (!contact) return false;
        if (contact.target._stickyGrenade && !contact.target._stickyGrenade.isExpired) return false;
        this._attachToContact(contact);
        simulation.addSparkBurst(contact.surfacePoint.clone(), "#ff5f45");
        simulation.playSound("hit", 0.55);
        return true;
    }

    _getSweptContact(start, end, target) {
        const path = Vector2.subtract(end, start);
        const startOffset = Vector2.subtract(start, target.position);
        const expandedRadius = target.radius + this.radius;
        const pathLengthSquared = path.dot(path);
        const startsOverlapping = startOffset.dot(startOffset) <= expandedRadius * expandedRadius;
        let time = null;
        if (startsOverlapping) {
            time = 0;
        } else if (pathLengthSquared > 1e-9) {
            const projection = 2 * startOffset.dot(path);
            const distance = startOffset.dot(startOffset) - expandedRadius * expandedRadius;
            const discriminant = projection * projection - 4 * pathLengthSquared * distance;
            if (discriminant >= 0) {
                const entryTime = (-projection - Math.sqrt(discriminant)) / (2 * pathLengthSquared);
                if (entryTime >= 0 && entryTime <= 1) time = entryTime;
            }
        }
        if (time === null) return { target: null };

        const grenadeCenter = Vector2.add(start, path.clone().scale(time));
        const outward = Vector2.subtract(grenadeCenter, target.position);
        if (outward.length() <= 1e-9) {
            if (path.length() > 1e-9) outward.add(path.clone().normalize().scale(-1));
            else outward.x = 1;
        }
        outward.normalize();
        return {
            target,
            time,
            grenadeCenter,
            surfacePoint: Vector2.add(target.position, outward.clone().scale(target.radius)),
            worldCenterOffset: outward.clone().scale(expandedRadius),
            worldSurfaceOffset: outward.clone().scale(target.radius)
        };
    }

    _attachToContact(contact) {
        const targetAngle = contact.target.angle ?? 0;
        const cos = Math.cos(-targetAngle);
        const sin = Math.sin(-targetAngle);
        const toLocal = (offset) => new Vector2(offset.x * cos - offset.y * sin, offset.x * sin + offset.y * cos);
        this.stickyTarget = contact.target;
        this.stickyLocalOffset = toLocal(contact.worldCenterOffset);
        this.stickyLocalSurfaceOffset = toLocal(contact.worldSurfaceOffset);
        this.stickyLocalAngle = Math.atan2(this.stickyLocalSurfaceOffset.y, this.stickyLocalSurfaceOffset.x);
        contact.target._stickyGrenade = this;
        this.homingTrail = [];
        this._followStickyTarget();
    }

    _followStickyTarget() {
        if (!this.stickyTarget || this.stickyTarget.flags.defeated) {
            this._releaseStickyTarget();
            return;
        }
        const angle = this.stickyTarget.angle ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const offset = this.stickyLocalOffset;
        this.pos = Vector2.add(
            this.stickyTarget.position,
            new Vector2(offset.x * cos - offset.y * sin, offset.x * sin + offset.y * cos)
        );
    }

    _releaseStickyTarget() {
        if (this.stickyTarget?._stickyGrenade === this) this.stickyTarget._stickyGrenade = null;
        this.stickyTarget = null;
        this.stickyLocalOffset = null;
        this.stickyLocalSurfaceOffset = null;
        this.stickyLocalAngle = null;
        this.homingTrail = [];
    }

    _detonate(simulation) {
        for (const target of simulation.getEnemiesOf(this.owner)) {
            const distance = Vector2.subtract(this.position, target.position).length();
            if (distance <= this.explosionRadius) {
                const edgeProgress = Math.max(
                    0,
                    Math.min(1, (distance - this.innerRadius) / (this.explosionRadius - this.innerRadius))
                );
                const raw = Math.round(this.owner.stats.baseDamage * (2.5 - edgeProgress * 1.0));
                const final =
                    target.actionContext?.onProjectileDamage?.(raw, this, this.owner, "Grenade", simulation, target) ??
                    raw;
                const { actualDamage } = target.takeDamage(final, this.owner, "Grenade");
                if (actualDamage <= 0) continue;
                const kbDir = Vector2.subtract(target.position, this.position).normalize();
                target.applyKnockback(kbDir.scale(900), 1.3);
                if (this.burningEnabled && !target.flags.defeated) {
                    applyBurningEffect({
                        source: this.owner,
                        target,
                        simulation,
                        label: "Grenade Burn"
                    });
                }
            }
        }

        simulation.spawnExplosion(this.position.clone(), this.owner.color);
        simulation.playSound("explosion");
        simulation.addLog(`${this.owner.name}'s grenade explodes.`);
        this._releaseStickyTarget();
        this.isExpired = true;
    }

    draw(ctx) {
        const charge = 1 - Math.max(0, this.timer / this.maxTimer);
        ctx.save();

        if (!this.stickyTarget && this.homingTrail.length > 1) {
            ctx.strokeStyle = this.owner.color;
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
            ctx.globalAlpha = 0.58;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(this.homingTrail[0].x, this.homingTrail[0].y);
            this.homingTrail.slice(1).forEach((point, index) => {
                const previous = this.homingTrail[index];
                const midpoint = Vector2.add(previous, point).scale(0.5);
                ctx.quadraticCurveTo(previous.x, previous.y, midpoint.x, midpoint.y);
            });
            ctx.lineTo(this.position.x, this.position.y);
            ctx.stroke();
            ctx.lineCap = "butt";
            ctx.globalAlpha = 1;
        }

        if (this.stickyTarget) {
            const warning = Math.sin((this.maxTimer / Math.max(0.04, this.timer)) * Math.PI) > 0;
            ctx.fillStyle = warning ? "rgba(255, 42, 24, 0.52)" : "rgba(255, 160, 80, 0.24)";
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius + 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // 시계 링 — 남은 시간만큼 채워진 원호가 회전
        // 폭발 범위 외곽선
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.globalAlpha = 0.08 + charge * 0.7;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.explosionRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // 시계 링 — 남은 시간만큼 채워진 원호가 회전
        const ringR = this.radius + 8;
        const startAngle = -Math.PI / 2 + charge * Math.PI * 2;
        const remaining = Math.max(0.02, 1 - charge);
        const endAngle = startAngle + Math.PI * 2 * remaining;
        const hue = 30 + (1 - charge) * 120;
        ctx.strokeStyle = this._proximityTriggered
            ? `rgba(255, 68, 68, ${0.4 + charge * 0.6})`
            : `hsl(${hue}, 100%, ${50 + charge * 20}%)`;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, ringR, startAngle, endAngle);
        ctx.stroke();
        ctx.lineCap = "butt";

        // 수류탄 본체
        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}
