import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function drawTriangle(ctx, tip, left, right) {
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fill();
}

export class EaterDigestEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(owner, target) {
        super(owner.position.clone(), new Vector2(), owner.radius);
        this.owner = owner;
        this.attachToEntity(owner);
        this.target = target;
        this.life = 0.72;
        this.maxLife = 0.72;
        this.tickPulse = 0;
        this.tickCount = 0;
    }

    registerTick() {
        this.tickCount += 1;
        this.tickPulse = 0.1;
    }

    finish() {
        this.isExpired = true;
    }

    update(delta) {
        this.syncAttachedPosition();
        this.tickLife(delta);
        this.tickPulse = Math.max(0, this.tickPulse - delta);
        if (this.life <= 0 || this.target.flags.defeated || this.target.state.swallowed?.owner !== this.owner) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        const center = this.owner.position;
        const pulse = this.tickPulse > 0 ? this.tickPulse / 0.1 : 0;
        const compression = 0.78 - pulse * 0.24;
        const proxyRadius = Math.min(this.target.radius, this.owner.radius * 0.72);
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.scale(compression, 0.72 + pulse * 0.08);
        ctx.fillStyle = this.target.color;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(0, 0, proxyRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 4);
        ctx.stroke();
        ctx.restore();

        const jawRadius = this.owner.radius * (0.76 - pulse * 0.13);
        const toothLength = this.owner.radius * (0.22 + pulse * 0.2);
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        ctx.globalAlpha = 0.9;
        for (const side of [-1, 1]) {
            const y = center.y + side * jawRadius * 0.42;
            ctx.beginPath();
            ctx.arc(center.x, y, jawRadius, side > 0 ? Math.PI : 0, side > 0 ? Math.PI * 2 : Math.PI);
            ctx.stroke();
            for (const offset of [-0.45, 0, 0.45]) {
                const x = center.x + offset * jawRadius;
                const baseY = center.y + side * jawRadius * 0.42;
                drawTriangle(
                    ctx,
                    new Vector2(x, baseY - side * toothLength),
                    new Vector2(x - jawRadius * 0.13, baseY),
                    new Vector2(x + jawRadius * 0.13, baseY)
                );
            }
        }
        ctx.restore();
    }
}

export class EaterSpitEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(owner, target, direction) {
        super(owner.position.clone(), new Vector2(), owner.radius);
        this.owner = owner;
        this.target = target;
        this.direction = direction.clone().normalize();
        this.origin = owner.position.clone();
        this.color = owner.color;
        this.life = 0.32;
        this.maxLife = 0.32;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = 1 - progress;
        const perpendicular = new Vector2(-this.direction.y, this.direction.x);
        const mouth = Vector2.add(this.origin, this.direction.clone().scale(this.owner.radius * 0.86));
        const targetPoint = this.target.position;
        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 10 - progress * 4);
        ctx.beginPath();
        ctx.moveTo(mouth.x, mouth.y);
        ctx.lineTo(targetPoint.x, targetPoint.y);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 4);
        ctx.beginPath();
        ctx.moveTo(mouth.x, mouth.y);
        ctx.lineTo(targetPoint.x, targetPoint.y);
        ctx.stroke();

        const flashLength = this.owner.radius * (0.9 + progress * 0.5);
        ctx.fillStyle = "#ffffff";
        drawTriangle(
            ctx,
            Vector2.add(mouth, this.direction.clone().scale(flashLength)),
            Vector2.add(mouth, perpendicular.clone().scale(flashLength * 0.45)),
            Vector2.add(mouth, perpendicular.clone().scale(-flashLength * 0.45))
        );

        const dustCenter = Vector2.subtract(this.origin, this.direction.clone().scale(this.owner.radius * 0.72));
        const directionAngle = Math.atan2(this.direction.y, this.direction.x);
        ctx.strokeStyle = "#b99a71";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 7);
        ctx.beginPath();
        ctx.arc(
            dustCenter.x,
            dustCenter.y,
            this.owner.radius * (0.55 + progress),
            directionAngle + 0.55,
            directionAngle - 0.55,
            true
        );
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.beginPath();
        ctx.ellipse(
            this.origin.x,
            this.origin.y,
            this.owner.radius * (0.72 + progress * 0.28),
            this.owner.radius * (1.08 - progress * 0.08),
            directionAngle,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
    }
}

export class EaterWallRuptureEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(contactPoint, inwardDirection, color, radius = 150) {
        super(contactPoint.clone(), new Vector2(), 0);
        this.inwardDirection = inwardDirection.clone().normalize();
        this.color = color;
        this.maxRadius = radius;
        this.life = 0.4;
        this.maxLife = 0.4;
        this.shockDuration = 0.28;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const elapsed = this.maxLife - this.life;
        const shockProgress = clamp01(elapsed / this.shockDuration);
        const alpha = 1 - clamp01((elapsed - 0.24) / 0.16);
        const radius = this.maxRadius * (1 - (1 - shockProgress) ** 3);
        const angle = Math.atan2(this.inwardDirection.y, this.inwardDirection.x);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 8);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, angle - Math.PI / 2, angle + Math.PI / 2);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 4);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * 0.88, angle - Math.PI / 2, angle + Math.PI / 2);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 9 * (1 - shockProgress * 0.45), 0, Math.PI * 2);
        ctx.fill();

        const tangent = new Vector2(-this.inwardDirection.y, this.inwardDirection.x);
        for (const index of Array.from({ length: 18 }, (_, value) => value)) {
            const lateral = ((index / 17) * 2 - 1) * radius * 0.78;
            const depth = radius * (0.22 + (index % 4) * 0.12);
            const debris = Vector2.add(
                this.position,
                this.inwardDirection.clone().scale(depth).add(tangent.clone().scale(lateral))
            );
            ctx.save();
            ctx.translate(debris.x, debris.y);
            ctx.rotate(angle + index * 0.7);
            ctx.fillStyle = index % 3 === 0 ? "#ffffff" : this.color;
            ctx.fillRect(-4, -2, 8, 4);
            ctx.restore();
        }
        ctx.restore();
    }
}
