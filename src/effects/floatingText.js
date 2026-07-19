import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleCombatTextSize, getVisibleLineWidth } from "./effectVisibility.js";

class FloatingText extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position, velY, text, color, fontSize, life = 0.9) {
        super(position.clone(), new Vector2(0, velY), 0);
        this.displayText = text;
        this.color = color;
        this.life = life;
        this.maxLife = this.life;
        this.fontSize = fontSize;
        this.visibilityToken = null;
    }

    update(delta) {
        this.integrate(delta);
        this.tickLife(delta);
    }

    draw(ctx, simulation = null) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const alpha = progress < 0.2 ? progress / 0.2 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        const fontSize =
            this.visibilityToken === "combatText" ? getVisibleCombatTextSize(ctx, this.fontSize) : this.fontSize;
        ctx.font = `700 ${fontSize}px Bahnschrift, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let textX = this.position.x;
        if (this.visibilityToken === "combatText") {
            const measuredWidth =
                ctx.measureText?.(this.displayText)?.width ?? fontSize * this.displayText.length * 0.55;
            if (simulation?.width) {
                const horizontalInset = measuredWidth / 2 + fontSize * 0.45;
                textX = Math.max(horizontalInset, Math.min(simulation.width - horizontalInset, textX));
            }
            ctx.strokeStyle = "#202020";
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2);
            ctx.strokeText(this.displayText, textX, this.position.y);
        }
        ctx.fillText(this.displayText, textX, this.position.y);
        ctx.restore();
    }
}

export class DamageNumber extends FloatingText {
    constructor(position, amount, color) {
        super(position, -28, String(Math.round(amount)), color, 15, 0.9);
    }
}

export class CriticalNumber extends FloatingText {
    constructor(position, amount) {
        super(position, -36, `CRIT! ${Math.round(amount)}`, "#ffdd00", 19, 1.1);
    }
}

export class ActionText extends FloatingText {
    constructor(position, text, color) {
        super(position, -36, text, color, 13, 1.1);
    }
}
