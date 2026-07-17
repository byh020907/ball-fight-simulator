import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export class ArcherPredictionEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(ability) {
        super(ability.state.aimPoint.clone(), new Vector2(), 0);
        this.ability = ability;
    }

    update() {
        const { owner, state } = this.ability;
        if (owner.flags.destroyed || state.windUp <= 0 || !state.aimPoint) {
            this.isExpired = true;
            return;
        }
        this.position = state.aimPoint.clone();
    }

    draw(ctx) {
        const progress = 1 - this.ability.state.windUp / this.ability._getWindupDuration();
        const radius = 6 + Math.max(0, Math.min(1, progress)) * 5;
        ctx.save();
        ctx.globalAlpha = 0.5 + progress * 0.35;
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = this.ability.owner.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.position.x - radius - 6, this.position.y);
        ctx.lineTo(this.position.x + radius + 6, this.position.y);
        ctx.moveTo(this.position.x, this.position.y - radius - 6);
        ctx.lineTo(this.position.x, this.position.y + radius + 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
}
