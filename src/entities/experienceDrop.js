import { HuntingLootItem } from "./huntingLootItem.js";
import { getHuntingExperienceDropColor } from "../hunting/huntingExperience.js";

const EXPERIENCE_CORE_COLOR = "#f2ff9b";

export class ExperienceDrop extends HuntingLootItem {
    static lootType = "experience";

    constructor({ amount = 1, radius = 10, ...options } = {}) {
        super({ ...options, radius });
        this.amount = Math.max(1, Math.round(amount));
    }

    collectReward() {
        return {
            type: ExperienceDrop.lootType,
            amount: this.amount,
            color: getHuntingExperienceDropColor(),
            collectionEffect: "experience",
            sound: "loot",
            soundIntensity: 0.72
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        ctx.fillStyle = getHuntingExperienceDropColor();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2f7f2f";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = EXPERIENCE_CORE_COLOR;
        ctx.beginPath();
        ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r * 0.42, y - r * 0.46, r * 0.24, r * 0.24);
    }
}
