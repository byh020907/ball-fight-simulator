import { ShardDrop } from "./shardDrop.js";

const ENHANCEMENT_STONE_COLOR = "#54d6be";

export class EnhancementStoneDrop extends ShardDrop {
    static lootType = "enhancement_stone";

    constructor(options = {}) {
        super({ ...options, amount: 1, radius: 18, valueRadiusType: null });
        this.amount = 1;
    }

    collectReward(collector) {
        return {
            type: EnhancementStoneDrop.lootType,
            amount: 1,
            color: ENHANCEMENT_STONE_COLOR,
            label: "강화석 +1",
            logMessage: `${collector.name} collects an enhancement stone.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        ctx.fillStyle = "#edfff9";
        ctx.strokeStyle = ENHANCEMENT_STONE_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.78, y - r * 0.26);
        ctx.lineTo(x + r * 0.52, y + r * 0.74);
        ctx.lineTo(x - r * 0.52, y + r * 0.74);
        ctx.lineTo(x - r * 0.78, y - r * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = ENHANCEMENT_STONE_COLOR;
        ctx.fillRect(x - r * 0.16, y - r * 0.35, r * 0.32, r * 0.7);
    }
}
