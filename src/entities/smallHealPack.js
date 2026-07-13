import { HuntingLootItem } from "./huntingLootItem.js";

const HEAL_COLOR = "#49cf6a";

export class SmallHealPack extends HuntingLootItem {
    static lootType = "small_heal_pack";

    constructor({ amount = 5, ...options } = {}) {
        super({ ...options, radius: 14 });
        this.amount = Math.max(1, Math.round(amount));
    }

    canCollect(collector) {
        return collector.hp < collector.maxHp;
    }

    collectReward(collector) {
        const amount = collector.heal(this.amount);
        if (amount <= 0) return null;
        return {
            type: SmallHealPack.lootType,
            amount,
            color: HEAL_COLOR,
            label: `+${amount} HP`,
            logMessage: `${collector.name} collects a small heal pack for ${amount} HP.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        ctx.fillStyle = "#ecfff0";
        ctx.strokeStyle = HEAL_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, r * 2, r * 2, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = HEAL_COLOR;
        ctx.fillRect(x - r * 0.18, y - r * 0.6, r * 0.36, r * 1.2);
        ctx.fillRect(x - r * 0.6, y - r * 0.18, r * 1.2, r * 0.36);
    }
}
