import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export class BloodTetherEffect extends CombatEntity {
    constructor(contactPoint, owner) {
        super(contactPoint.clone(), new Vector2(), 0);
        this.owner = owner;
        this.life = 0.18;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        if (this.owner.flags.destroyed || !this.tickLife(delta)) this.isExpired = true;
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#d81f4d";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.5 - progress);
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(this.owner.position.x, this.owner.position.y);
        ctx.stroke();
        for (const offset of [0.25, 0.5, 0.75]) {
            const travel = Math.min(1, offset + progress * 0.7);
            const x = this.position.x + (this.owner.position.x - this.position.x) * travel;
            const y = this.position.y + (this.owner.position.y - this.position.y) * travel;
            ctx.fillStyle = "#ff426d";
            ctx.beginPath();
            ctx.arc(x, y, 2.4 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

export class BloodMarkEffect extends CombatEntity {
    constructor(target, duration) {
        super(target.position.clone(), new Vector2(), target.radius + 7);
        this.target = target;
        this.life = duration;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        if (this.target.flags.destroyed || !this.tickLife(delta)) {
            this.isExpired = true;
            return;
        }
        this.position = this.target.position.clone();
    }

    draw(ctx) {
        const pulse = 1 + Math.sin(this.lifeProgress * Math.PI * 6) * 0.08;
        const radius = (this.target.radius + 7) * pulse;
        ctx.save();
        ctx.translate(this.target.position.x, this.target.position.y);
        ctx.strokeStyle = `rgba(210, 24, 67, ${0.45 + (1 - this.lifeProgress) * 0.4})`;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.4);
        ctx.beginPath();
        ctx.arc(0, 0, radius, -1.05, 1.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(radius * 0.55, -radius * 0.72);
        ctx.lineTo(radius * 0.2, -radius * 0.18);
        ctx.lineTo(radius * 0.48, radius * 0.08);
        ctx.lineTo(radius * 0.12, radius * 0.65);
        ctx.stroke();
        ctx.restore();
    }
}

export class BloodRuptureEffect extends CombatEntity {
    constructor(position) {
        super(position.clone(), new Vector2(), 18);
        this.life = 0.32;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const radius = progress < 0.35 ? 24 * (1 - progress / 0.35) : 10 + (progress - 0.35) * 44;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ff315f";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 3);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        for (const angle of [-1.2, -0.45, 0.2, 0.9, 1.65, 2.4]) {
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
            ctx.lineTo(Math.cos(angle) * radius * 1.35, Math.sin(angle) * radius * 1.35);
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class BloodBiteEffect extends CombatEntity {
    constructor(position, normal) {
        super(position.clone(), new Vector2(), 12);
        this.normal = normal.clone();
        this.angle = Math.atan2(normal.y, normal.x);
        this.life = 0.28;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const alpha = Math.max(0, 1 - this.lifeProgress);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ed2856";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2.6);
        ctx.beginPath();
        ctx.arc(0, 0, 8, -0.95, 0.95);
        ctx.stroke();
        ctx.fillStyle = "#a90f36";
        for (const [x, y, radius] of [
            [7, -5, 2],
            [11, 1, 1.5],
            [6, 6, 1.2]
        ]) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

export class BloodBatBurstEffect extends CombatEntity {
    constructor(position, radius) {
        super(position.clone(), new Vector2(), radius);
        this.life = 0.42;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#8d1235";
        for (const angle of [-1.15, -0.3, 0.55, 1.4, 2.25]) {
            const distance = 8 + progress * 42;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(-2, -2);
            ctx.lineTo(-8, -6);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-8, 6);
            ctx.lineTo(-2, 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.strokeStyle = "#d51f4c";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2);
        ctx.beginPath();
        ctx.arc(0, 0, 10 + progress * 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
