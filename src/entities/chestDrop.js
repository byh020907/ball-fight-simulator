import { HuntingLootItem } from "./huntingLootItem.js";

const CHEST_COLOR = "#c98134";
const CHEST_METAL_COLOR = "#ffd45b";
const CHEST_RARITY_COLORS = Object.freeze({
    common: { body: CHEST_COLOR, metal: CHEST_METAL_COLOR },
    uncommon: { body: "#4ca765", metal: "#b8ff81" },
    rare: { body: "#bf8a2b", metal: "#fff07a" },
    epic: { body: "#8552c9", metal: "#ffc4ff" },
    legendary: { body: "#c24c3e", metal: "#fff0bd" }
});

export class ChestDrop extends HuntingLootItem {
    static lootType = "chest";
    static highLootType = "high_chest";

    constructor({ chest, ...options } = {}) {
        super({ ...options, radius: 16 });
        this.chest = chest;
    }

    collectReward(collector) {
        if (!this.chest) return null;
        return {
            type: ChestDrop.lootType,
            chest: this.chest,
            color: (CHEST_RARITY_COLORS[this.chest.rarity] ?? CHEST_RARITY_COLORS.common).metal,
            label: "상자 획득",
            soundIntensity: 1,
            logMessage: `${collector.name} collects a ${this.chest.rarity} hunting chest.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        const colors = CHEST_RARITY_COLORS[this.chest?.rarity] ?? CHEST_RARITY_COLORS.common;
        ctx.fillStyle = colors.body;
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
        ctx.fillStyle = colors.metal;
        ctx.fillRect(x - r * 0.14, y - r * 0.12, r * 0.28, r * 0.72);
    }
}
