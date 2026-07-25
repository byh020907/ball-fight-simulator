import { getEquipmentTemplate } from "../hunting/equipmentTemplates.js";
import { resolveTagDraw } from "../equipmentIconTags.js";
import { HuntingLootItem } from "./huntingLootItem.js";

export class EquipmentDrop extends HuntingLootItem {
    static lootType = "equipment";

    constructor({ templateId, ...options } = {}) {
        const template = getEquipmentTemplate(templateId);
        const radius = 18;
        super({ ...options, radius });
        this.templateId = templateId;
        this._template = template;
    }

    collectReward(collector) {
        const template = this._template || getEquipmentTemplate(this.templateId);
        if (!template || template.tier !== "basic") return null;
        const label = template.name;
        return {
            type: EquipmentDrop.lootType,
            templateId: this.templateId,
            color: "#c084fc",
            label: `${label} 획득`,
            logMessage: `${collector.name} collects ${label}.`
        };
    }

    drawItem(ctx) {
        const { x, y } = this.position;
        const r = this.radius;
        const tagId = this.templateId;
        const drawFn = resolveTagDraw(tagId);
        if (drawFn) {
            ctx.save();
            ctx.translate(x, y);
            const scale = r * 2;
            ctx.scale(scale, scale);
            ctx.translate(-x, -y);
            drawFn(ctx, x, y);
            ctx.restore();
        } else {
            ctx.fillStyle = "#c084fc";
            ctx.strokeStyle = "#7c3aed";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("?", x, y);
        }
    }
}
