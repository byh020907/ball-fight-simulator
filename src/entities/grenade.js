import { CombatEntity, dealProjectileDamage, Vector2 } from "../core.js";

const PROXIMITY_FUSE_BASE_MULTIPLIER = 3;
const PROXIMITY_FUSE_MAX_MULTIPLIER = 6;
const EXPLOSION_RADIUS = 174;
const EXPLOSION_INNER_RADIUS = 72;

export class Grenade extends CombatEntity {
    constructor(owner, targetPosition, fuseTime = 1.08) {
        const start = owner.position.clone();
        const safeFuse = Math.max(0.32, fuseTime);
        const drift = Vector2.subtract(targetPosition, start).scale(1 / safeFuse);
        super(start, drift, 12);
        this.owner = owner;
        this.ownerId = owner.id;
        this.timer = safeFuse;
        this.maxTimer = this.timer;
        this.launchSpeed = drift.length();
        this._proximityFuseMultiplier = 1;
        this.explosionRadius = EXPLOSION_RADIUS;
        this.innerRadius = EXPLOSION_INNER_RADIUS;
        this.bounces = 0;
        this.maxBounces = 4;
    }

    update(delta, simulation) {
        const previousPosition = this.position.clone();
        const travelSpeed = this.velocity.length();
        this.integrate(delta);

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
            const target = simulation.getOpponent(this.owner);
            if (target && !target.flags.defeated && this._crossedExplosionRange(previousPosition, target.position)) {
                this._activateProximityFuse(travelSpeed);
            }
        }

        this.timer -= delta * this._proximityFuseMultiplier;
        if (this.timer > 0) {
            return;
        }

        this._detonate(simulation);
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

    _detonate(simulation) {
        const target = simulation.getOpponent(this.owner);
        if (target && !target.flags.defeated) {
            const distance = Vector2.subtract(this.position, target.position).length();
            if (distance <= this.explosionRadius) {
                const edgeProgress = Math.max(
                    0,
                    Math.min(1, (distance - this.innerRadius) / (this.explosionRadius - this.innerRadius))
                );
                const raw = Math.round(this.owner.stats.baseDamage * (2.5 - edgeProgress * 1.0));
                dealProjectileDamage(target, raw, this.owner, "Grenade", simulation);
                const kbDir = Vector2.subtract(target.position, this.position).normalize();
                target.applyKnockback(kbDir.scale(900), 1.3);
            }
        }

        simulation.spawnExplosion(this.position.clone(), this.owner.color);
        simulation.playSound("explosion");
        simulation.addLog(`${this.owner.name}'s grenade explodes.`);
        this.isExpired = true;
    }

    draw(ctx) {
        const charge = 1 - Math.max(0, this.timer / this.maxTimer);
        ctx.save();

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
