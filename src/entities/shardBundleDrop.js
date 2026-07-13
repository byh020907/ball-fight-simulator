import { ShardDrop } from "./shardDrop.js";

const SHARD_BUNDLE_COLOR = "#8d6dff";

export class ShardBundleDrop extends ShardDrop {
    static lootType = "shard_bundle";

    constructor(options = {}) {
        super({ ...options, radius: 18 });
    }

    collectReward(collector) {
        return {
            ...super.collectReward(collector),
            color: SHARD_BUNDLE_COLOR,
            label: `파편 꾸러미 +${this.amount}`,
            logMessage: `${collector.name} collects a shard bundle for ${this.amount} shards.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        const crystals = [
            { x: -0.42, y: 0.2, scale: 0.56 },
            { x: 0.32, y: 0.26, scale: 0.5 },
            { x: 0, y: -0.28, scale: 0.76 }
        ];
        ctx.fillStyle = "#efeaff";
        ctx.strokeStyle = SHARD_BUNDLE_COLOR;
        ctx.lineWidth = 3;
        for (const crystal of crystals) {
            const size = r * crystal.scale;
            ctx.beginPath();
            ctx.moveTo(x + crystal.x * r, y + crystal.y * r - size);
            ctx.lineTo(x + crystal.x * r + size * 0.68, y + crystal.y * r);
            ctx.lineTo(x + crystal.x * r, y + crystal.y * r + size);
            ctx.lineTo(x + crystal.x * r - size * 0.68, y + crystal.y * r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}
