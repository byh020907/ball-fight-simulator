import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";
import { SPIN_VORTEX_CONFIG } from "../abilities/spinConfig.js";

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

export class SpinVortexEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(ability) {
        super(ability.owner.position.clone(), new Vector2(), 0);
        this.ability = ability;
        this.streams = Array.from({ length: 26 }, (_, index) => this._createStream(index));
    }

    _createStream(index) {
        const angle = (Math.PI * 2 * index) / 26;
        const radialRatio = 0.18 + ((index * 11) % 23) / 27;
        const position = Vector2.add(
            this.ability.owner.position,
            Vector2.fromAngle(angle, SPIN_VORTEX_CONFIG.radius * radialRatio)
        );
        return { position, points: [position.clone()], seed: index };
    }

    update(delta) {
        this.position = this.ability.owner.position.clone();
        if (!this.ability.getLevelUpgrade().piercingVortex || !this.ability.isFullyCharged()) {
            this.isExpired = true;
            return;
        }

        for (const stream of this.streams) {
            const acceleration = this.ability.getVortexAccelerationAt(stream.position);
            const distance = Vector2.subtract(stream.position, this.position).length();
            const speedBoost = 1.25 + Math.max(0, 1 - distance / SPIN_VORTEX_CONFIG.radius) * 2.2;
            stream.position.add(acceleration.scale(delta * speedBoost));
            stream.points.push(stream.position.clone());
            if (stream.points.length > 7) stream.points.shift();
            if (distance < this.ability.owner.radius * 0.8 || distance > SPIN_VORTEX_CONFIG.radius + 20) {
                const angle = (stream.seed * 2.399 + this.ability.owner.angle) % (Math.PI * 2);
                stream.position = Vector2.add(
                    this.position,
                    Vector2.fromAngle(angle, SPIN_VORTEX_CONFIG.radius * 0.94)
                );
                stream.points = [stream.position.clone()];
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.strokeStyle = "#ffe36d";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 2);
        for (const stream of this.streams) {
            if (stream.points.length < 2) continue;
            const distance = Vector2.subtract(stream.position, this.position).length();
            ctx.globalAlpha = 0.35 + Math.max(0, 1 - distance / SPIN_VORTEX_CONFIG.radius) * 0.6;
            ctx.beginPath();
            stream.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        }
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.5);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, SPIN_VORTEX_CONFIG.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
