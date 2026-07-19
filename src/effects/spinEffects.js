import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { getVisibleLineWidth } from "./effectVisibility.js";
import { SPIN_VORTEX_CONFIG } from "../abilities/spinConfig.js";
import { createFlowFieldVisual, drawFlowFieldVisual, updateFlowFieldVisual } from "./flowFieldVisual.js";

const CUT_DURATION = 0.6;

export class SpinCutEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(ability, cut) {
        super(cut.contactPoint.clone(), new Vector2(), 0);
        this.ability = ability;
        this.cut = cut;
        this.life = CUT_DURATION + 0.18;
        this.maxLife = this.life;
        this.tickFlashes = [];
        this.finished = false;
    }

    registerTick(tickCount) {
        this.tickFlashes.push({ tickCount, life: 0.16, maxLife: 0.16 });
    }

    finish() {
        this.finished = true;
        this.life = Math.min(this.life, 0.18);
    }

    update(delta) {
        this.position = this.cut.contactPoint.clone();
        for (const flash of this.tickFlashes) flash.life -= delta;
        this.tickFlashes = this.tickFlashes.filter((flash) => flash.life > 0);
        if (this.finished) this.tickLife(delta);
    }

    draw(ctx) {
        const progress = Math.min(1, this.cut.elapsed / CUT_DURATION);
        const color = this.ability.getLevelUpgrade().piercingVortex ? "#fff4ae" : "#ffb347";
        const radius = 18 + progress * 24;
        const startAngle = this.ability.owner.angle - Math.PI * 0.2;
        const endAngle = startAngle + Math.PI * (0.85 + progress * 0.65);

        ctx.save();
        ctx.lineCap = "round";
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.76;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 9 - progress * 2);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, startAngle, endAngle);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.globalAlpha = 1;
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, startAngle, endAngle);
        ctx.stroke();

        for (const flash of this.tickFlashes) {
            const flashProgress = 1 - flash.life / flash.maxLife;
            const angle = endAngle + flash.tickCount * 0.72;
            ctx.globalAlpha = 1 - flashProgress;
            ctx.strokeStyle = flash.tickCount % 2 === 0 ? "#ffffff" : color;
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(
                this.position.x + Math.cos(angle) * (32 + flashProgress * 32),
                this.position.y + Math.sin(angle) * (32 + flashProgress * 32)
            );
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class SpinVortexEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(ability) {
        super(ability.owner.position.clone(), new Vector2(), 0);
        this.ability = ability;
        this.attachToEntity(ability.owner);
        this.flowField = createFlowFieldVisual(this.position, { radius: SPIN_VORTEX_CONFIG.radius });
        this.streams = this.flowField.streams;
    }

    update(delta) {
        this.syncAttachedPosition();
        if (!this.ability.getLevelUpgrade().piercingVortex || !this.ability.isFullyCharged()) {
            this.isExpired = true;
            return;
        }

        updateFlowFieldVisual(this.flowField, {
            center: this.position,
            delta,
            innerRadius: this.ability.owner.radius * 0.8,
            rotation: this.ability.owner.angle,
            getAccelerationAt: (position) => this.ability.getVortexAccelerationAt(position),
            getSpeedBoost: (distance) => 1.25 + Math.max(0, 1 - distance / SPIN_VORTEX_CONFIG.radius) * 2.2
        });
    }

    draw(ctx) {
        drawFlowFieldVisual(ctx, this.flowField, {
            center: this.position,
            color: "#ffe36d",
            boundaryColor: "#ffffff"
        });
    }
}
