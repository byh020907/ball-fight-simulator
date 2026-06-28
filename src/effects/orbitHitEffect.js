import { CombatEntity, Vector2 } from "../core.js";

export class OrbitHitEffect extends CombatEntity {
    constructor(shardPosition, targetPosition, color) {
        super(targetPosition, new Vector2(), 0);
        this.shardPosition = shardPosition;
        this.targetPosition = targetPosition;
        this.color = color;
        this.life = 0.24;
        this.maxLife = this.life;
    }

    update(delta) {
        if (!this.tickLife(delta)) { }
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.shardPosition.x, this.shardPosition.y);
        ctx.lineTo(this.targetPosition.x, this.targetPosition.y);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.targetPosition.x, this.targetPosition.y, 18 + progress * 48, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = this.color;
        for (let index = 0; index < 6; index += 1) {
            const angle = (Math.PI * 2 * index) / 6;
            const distance = 22 + progress * 36;
            ctx.save();
            ctx.translate(
                this.targetPosition.x + Math.cos(angle) * distance,
                this.targetPosition.y + Math.sin(angle) * distance
            );
            ctx.rotate(angle);
            ctx.fillRect(-7, -3, 14, 6);
            ctx.restore();
        }
        ctx.restore();
    }
}
