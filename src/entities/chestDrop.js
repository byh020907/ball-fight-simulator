import { HuntingLootItem } from "./huntingLootItem.js";

const CHEST_COLOR = "#c98134";
const CHEST_METAL_COLOR = "#ffd45b";

export class ChestDrop extends HuntingLootItem {
    static lootType = "chest";

    constructor({ chest, ...options } = {}) {
        super({ ...options, radius: 16 });
        this.chest = chest;
    }

    collectReward(collector) {
        if (!this.chest) return null;
        return {
            type: ChestDrop.lootType,
            chest: this.chest,
            color: CHEST_METAL_COLOR,
            label: "상자 획득",
            soundIntensity: 1,
            logMessage: `${collector.name} collects a ${this.chest.rarity} hunting chest.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        ctx.fillStyle = CHEST_COLOR;
        ctx.strokeStyle = "#754119";
        ctx.lineWidth = 3;
        ctx.fillRect(x - r, y - r * 0.2, r * 2, r * 1.05);
        ctx.strokeRect(x - r, y - r * 0.2, r * 2, r * 1.05);
        ctx.beginPath();
        ctx.arc(x, y - r * 0.2, r, Math.PI, 0);
        ctx.lineTo(x + r, y + r * 0.05);
        ctx.lineTo(x - r, y + r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = CHEST_METAL_COLOR;
        ctx.fillRect(x - r * 0.14, y - r * 0.12, r * 0.28, r * 0.72);
    }
}
