import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export class VineSnareVisualEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(target, periodicEffect) {
        super(target.position.clone(), new Vector2(), target.radius);
        this.target = target;
        this.attachToEntity(target);
        this.periodicEffect = periodicEffect;
        this.life = periodicEffect.duration;
        this.maxLife = periodicEffect.duration;
    }

    update() {
        this.syncAttachedPosition();
        this.life = Math.max(0, this.periodicEffect.duration - this.periodicEffect.elapsed);
        if (this.target.flags.defeated || this.periodicEffect.finished) this.isExpired = true;
    }

    draw(ctx) {
        const effect = this.periodicEffect;
        const progress = Math.min(1, effect.elapsed / effect.duration);
        const tighten = effect.pulse > 0 ? effect.pulse / 0.08 : 0;
        const radius = this.target.radius + 9 - tighten * 5;
        ctx.save();
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, tighten > 0 ? "emphasis" : "standard", 4 + tighten * 3);
        ctx.globalAlpha = 0.9 * (1 - progress * 0.25);
        ctx.lineCap = "round";
        for (const offset of [-0.34, 0, 0.34]) {
            ctx.beginPath();
            ctx.arc(
                this.target.position.x,
                this.target.position.y,
                radius + Math.abs(offset) * 5,
                Math.PI * (0.12 + offset + progress * 0.32),
                Math.PI * (1.34 + offset + progress * 0.32)
            );
            ctx.stroke();
        }
        ctx.fillStyle = "#b9ff83";
        for (const side of [-1, 1]) {
            const angle = progress * Math.PI * 2 + side * 1.1;
            ctx.save();
            ctx.translate(
                this.target.position.x + Math.cos(angle) * radius,
                this.target.position.y + Math.sin(angle) * radius
            );
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, 6 + tighten * 3, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
}

export class TricksterSeedMarkEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(target, color, duration) {
        super(target.position.clone(), new Vector2(), target.radius);
        this.target = target;
        this.attachToEntity(target);
        this.color = color;
        this.duration = duration;
        this.life = duration;
        this.maxLife = duration;
    }

    refresh() {
        this.life = this.duration;
    }

    update(delta) {
        this.syncAttachedPosition();
        this.tickLife(delta);
        if (this.target.flags.defeated) this.isExpired = true;
    }

    draw(ctx) {
        const pulse = 1 + Math.sin(this.lifeProgress * Math.PI * 8) * 0.12;
        const center = Vector2.add(this.target.position, new Vector2(0, -this.target.radius - 14));
        const size = (11 + this.target.radius * 0.1) * pulse;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.globalAlpha = 0.68 + (1 - this.lifeProgress) * 0.28;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = "#214d1f";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.beginPath();
        ctx.ellipse(0, 2, size * 0.62, size, -0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.65);
        ctx.quadraticCurveTo(size * 0.35, -size * 1.28, size * 0.82, -size * 1.05);
        ctx.quadraticCurveTo(size * 0.42, -size * 0.62, 0, -size * 0.65);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

export class TricksterSeedBurstEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position, color) {
        super(position.clone(), new Vector2(), 0);
        this.color = color;
        this.life = 0.3;
        this.maxLife = 0.3;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#efffc5";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 12 * (1 - progress * 0.55), 0, Math.PI * 2);
        ctx.fill();
        for (const index of Array.from({ length: 12 }, (_, value) => value)) {
            const angle = (Math.PI * 2 * index) / 12;
            const distance = 12 + progress * (34 + (index % 3) * 10);
            ctx.save();
            ctx.translate(this.position.x + Math.cos(angle) * distance, this.position.y + Math.sin(angle) * distance);
            ctx.rotate(angle);
            ctx.fillStyle = index % 2 === 0 ? this.color : "#eaffb3";
            ctx.beginPath();
            ctx.moveTo(9, 0);
            ctx.lineTo(-5, -4);
            ctx.lineTo(-2, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
}

export class SeedActivationEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(seed) {
        super(seed.position.clone(), new Vector2(), seed.radius);
        this.seed = seed;
        this.attachToEntity(seed);
        this.life = 0.24;
        this.maxLife = 0.24;
    }

    update(delta) {
        this.syncAttachedPosition();
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = 1 - progress;
        const radius = this.seed.radius * (0.9 + progress * 1.15);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#caff7b";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#f3ffd7";
        for (const index of Array.from({ length: 8 }, (_, value) => value)) {
            const angle = (Math.PI * 2 * index) / 8;
            const inner = Vector2.add(this.position, Vector2.fromAngle(angle, radius * 0.68));
            const outer = Vector2.add(this.position, Vector2.fromAngle(angle, radius * 1.32));
            const side = Vector2.add(inner, Vector2.fromAngle(angle + Math.PI / 2, 3));
            ctx.beginPath();
            ctx.moveTo(outer.x, outer.y);
            ctx.lineTo(side.x, side.y);
            ctx.lineTo(inner.x, inner.y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}
