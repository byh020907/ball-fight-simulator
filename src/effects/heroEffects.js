import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";

const SHARD_COUNT = 12;

export class HeroShieldBreakEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position, maximumRadius, duration) {
        super(position.clone(), new Vector2(), 0);
        this.maximumRadius = maximumRadius;
        this.duration = duration;
        this.life = duration;
        this.shards = Array.from({ length: SHARD_COUNT }, (_, index) => ({
            angle: (Math.PI * 2 * index) / SHARD_COUNT,
            distanceRatio: 0.62 + (index % 3) * 0.12,
            rotation: index * 0.47
        }));
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) this.isExpired = true;
    }

    draw(ctx) {
        const progress = Math.min(1, Math.max(0, 1 - this.life / this.duration));
        const eased = 1 - (1 - progress) ** 3;
        const radius = this.maximumRadius * eased;
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#fff4b8";
        ctx.lineWidth = 8 * (1 - progress) + 2;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#d89a00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius * 0.82, 0, Math.PI * 2);
        ctx.stroke();

        this.shards.forEach((shard) => {
            const distance = radius * shard.distanceRatio;
            const x = this.position.x + Math.cos(shard.angle) * distance;
            const y = this.position.y + Math.sin(shard.angle) * distance;
            const size = 7 * (1 - progress * 0.45);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(shard.angle + shard.rotation + progress * 2.5);
            ctx.fillStyle = "#ffd84d";
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size * 0.6, -size * 0.7);
            ctx.lineTo(-size * 0.6, size * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }
}
