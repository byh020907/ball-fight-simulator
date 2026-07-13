import { HuntingLootItem } from "./huntingLootItem.js";

const SHARD_COLOR = "#48a9ff";

export class ShardDrop extends HuntingLootItem {
    static lootType = "shard";

    constructor({ amount = 5, radius = 12, ...options } = {}) {
        super({ ...options, radius });
        this.amount = Math.max(1, Math.round(amount));
    }

    collectReward(collector) {
        return {
            type: ShardDrop.lootType,
            amount: this.amount,
            color: SHARD_COLOR,
            label: `파편 +${this.amount}`,
            logMessage: `${collector.name} collects ${this.amount} shards.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        ctx.fillStyle = "#d8f0ff";
        ctx.strokeStyle = SHARD_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.72, y - r * 0.12);
        ctx.lineTo(x + r * 0.42, y + r);
        ctx.lineTo(x - r * 0.58, y + r * 0.68);
        ctx.lineTo(x - r * 0.8, y - r * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}
