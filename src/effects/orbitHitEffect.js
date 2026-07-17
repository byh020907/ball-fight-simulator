import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export class OrbitHitEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(shardPosition, targetPosition, color, options = {}) {
        super(targetPosition, new Vector2(), 0);
        this.shardPosition = shardPosition;
        this.targetPosition = targetPosition;
        this.color = color;
        this.life = 0.24;
        this.maxLife = this.life;
        this.impactRadius = options.impactRadius ?? 66;
        this.drawConnection = options.drawConnection !== false;
        this.trackedProjectiles = options.trackedProjectiles ?? [];
        this.tracks = this.trackedProjectiles.map((projectile) => ({
            projectile,
            points: [projectile.position.clone()]
        }));
    }

    update(delta) {
        for (const track of this.tracks) {
            if (track.projectile.isExpired) continue;
            track.points.push(track.projectile.position.clone());
            if (track.points.length > 10) track.points.shift();
        }
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 7);
        ctx.lineCap = "round";
        if (this.drawConnection) {
            ctx.beginPath();
            ctx.moveTo(this.shardPosition.x, this.shardPosition.y);
            ctx.lineTo(this.targetPosition.x, this.targetPosition.y);
            ctx.stroke();
        }

        for (const track of this.tracks) {
            if (track.points.length < 2) continue;
            ctx.globalAlpha = 0.9 - progress * 0.35;
            ctx.beginPath();
            track.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.lineTo(this.targetPosition.x, this.targetPosition.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.beginPath();
        ctx.arc(this.targetPosition.x, this.targetPosition.y, 18 + progress * (this.impactRadius - 18), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = this.color;
        for (let index = 0; index < 6; index += 1) {
            const angle = (Math.PI * 2 * index) / 6;
            const distance = 22 + progress * 36;
            ctx.save();
            ctx.translate(
                this.targetPosition.x + Math.cos(angle) * distance,
                this.targetPosition.y + Math.sin(angle) * distance
            );
            ctx.rotate(angle);
            ctx.fillRect(-7, -3, 14, 6);
            ctx.restore();
        }
        ctx.restore();
    }
}

export class OrbitCatchEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(owner, slotIndex, contactPosition, color) {
        super(contactPosition.clone(), new Vector2(), 0);
        this.owner = owner;
        this.slotIndex = slotIndex;
        this.contactPosition = contactPosition.clone();
        this.color = color;
        this.life = 0.32;
        this.maxLife = this.life;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const slotPosition = this.owner.ability?.getOrbitPosition?.(this.slotIndex) ?? this.owner.position;
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const control = Vector2.add(this.contactPosition, slotPosition).scale(0.5);
        control.y -= 38;

        ctx.save();
        ctx.globalAlpha = 1 - progress * 0.45;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        ctx.beginPath();
        ctx.moveTo(this.contactPosition.x, this.contactPosition.y);
        ctx.quadraticCurveTo(control.x, control.y, slotPosition.x, slotPosition.y);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.beginPath();
        ctx.arc(slotPosition.x, slotPosition.y, 10 + progress * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
