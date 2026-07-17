import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export class GrenadeReburstEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position, radius = 90) {
        super(position.clone(), new Vector2(), 0);
        this.life = 0.34;
        this.maxLife = this.life;
        this.radius = radius;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - this.life / this.maxLife;
        const ringProgress = Math.max(0, (progress - 0.22) / 0.78);
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = progress < 0.22 ? "#ff7d2d" : "#ffb24f";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 7);
        ctx.beginPath();
        ctx.arc(
            this.position.x,
            this.position.y,
            progress < 0.22 ? this.radius * (0.45 - progress) : this.radius * ringProgress,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        if (progress >= 0.18) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, Math.max(2, 12 * (1 - ringProgress)), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
