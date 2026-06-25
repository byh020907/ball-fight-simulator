import { CombatEntity, Vector2 } from "../core.js";

export class VisualBurst extends CombatEntity {
    constructor(position, color, radiusGrowth, life) {
        super(position, new Vector2(), 10);
        this.color = color;
        this.radiusGrowth = radiusGrowth;
        this.life = life;
        this.maxLife = life;
    }

    update(delta) {
        this.life -= delta;
        this.radius += this.radiusGrowth * delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
