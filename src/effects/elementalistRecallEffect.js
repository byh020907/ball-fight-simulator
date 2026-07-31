import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "../game-kit/canvas/effectVisibility.js";
import { ELEMENTAL_PALETTE } from "../abilities/elementalistRecipes.js";
import { ELEMENTALIST_RECALL_VISUAL_CONFIG } from "./elementalistEffects.js";

export class ElementalistRecallEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({ owner, orbs }) {
        super(owner.position.clone(), new Vector2(), owner.radius);
        this.owner = owner;
        this.sources = orbs.map((orb) => ({
            position: orb.position.clone(),
            radius: orb.radius,
            colors: (orb.elements ?? [orb.element]).map((element) => ELEMENTAL_PALETTE[element] ?? "#ffffff")
        }));
        this.life = ELEMENTALIST_RECALL_VISUAL_CONFIG.duration;
        this.maxLife = ELEMENTALIST_RECALL_VISUAL_CONFIG.duration;
    }

    update(delta, simulation) {
        this.life -= delta;
        if (this.life <= 0 || this.owner.flags.defeated || simulation.finished) this.isExpired = true;
    }

    draw(ctx) {
        const progress = Math.max(0, Math.min(1, 1 - this.life / this.maxLife));
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        this.sources.forEach(({ position, radius, colors }, index) => {
            const bead = new Vector2(
                position.x + (this.owner.position.x - position.x) * progress,
                position.y + (this.owner.position.y - position.y) * progress
            );
            colors.forEach((color, colorIndex) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = getVisibleLineWidth(ctx, "standard", ELEMENTALIST_RECALL_VISUAL_CONFIG.tetherWidth);
                ctx.setLineDash(ELEMENTALIST_RECALL_VISUAL_CONFIG.tetherDash);
                ctx.lineDashOffset = colorIndex * 4;
                ctx.beginPath();
                ctx.moveTo(position.x, position.y);
                ctx.lineTo(this.owner.position.x, this.owner.position.y);
                ctx.stroke();
            });
            ctx.setLineDash([]);
            ctx.fillStyle = colors[0];
            ctx.beginPath();
            ctx.arc(bead.x, bead.y, ELEMENTALIST_RECALL_VISUAL_CONFIG.beadRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(
                position.x,
                position.y,
                radius + ELEMENTALIST_RECALL_VISUAL_CONFIG.ringPadding + index * 2,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        });
        ctx.restore();
    }
}
