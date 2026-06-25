import { CombatEntity, Vector2 } from "../core.js";

export class SlashTrail extends CombatEntity {
    constructor(from, to, color) {
        super(from, new Vector2(), 0);
        this.from = from;
        this.to = to;
        this.color = color;
        this.life = 0.18;
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.from.x, this.from.y);
        ctx.lineTo(this.to.x, this.to.y);
        ctx.stroke();
        ctx.restore();
    }
}
