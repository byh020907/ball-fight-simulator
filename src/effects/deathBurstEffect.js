import { CombatEntity, Vector2 } from "../core.js";

export class DeathBurstEffect extends CombatEntity {
    constructor(position, color) {
        super(position, new Vector2(), 0);
        this.color = color;
        this.life = 0.78;
        this.maxLife = this.life;
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 26 + progress * 110, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 10 + progress * 72, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        for (let index = 0; index < 10; index += 1) {
            const angle = (Math.PI * 2 * index) / 10 + progress * 0.7;
            const distance = 34 + progress * 82;
            ctx.save();
            ctx.translate(this.position.x + Math.cos(angle) * distance, this.position.y + Math.sin(angle) * distance);
            ctx.rotate(angle + progress * Math.PI);
            ctx.fillRect(-10, -4, 20, 8);
            ctx.restore();
        }
        ctx.restore();
    }
}
