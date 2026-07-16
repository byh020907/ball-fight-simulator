import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";

class FloatingText extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position, velY, text, color, fontSize, life = 0.9) {
        super(position.clone(), new Vector2(0, velY), 0);
        this.displayText = text;
        this.color = color;
        this.life = life;
        this.maxLife = this.life;
        this.fontSize = fontSize;
    }

    update(delta) {
        this.life -= delta;
        this.integrate(delta);
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const alpha = progress < 0.2 ? progress / 0.2 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = `700 ${this.fontSize}px Bahnschrift, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.displayText, this.position.x, this.position.y);
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
