import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import {
    drawRebirthVisualOverlay,
    drawRebirthVisualUnderlay,
    getRebirthVisualProfile
} from "../rebirth/rebirthVisuals.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

const RAGE_FIRE_COLORS = Object.freeze(["#fff4bd", "#ff983d", "#e83f18"]);
export const BURNING_EFFECT_CONFIG = Object.freeze({
    duration: 0.5,
    tickInterval: 0.1,
    maximumTicks: 5,
    totalDamageMultiplier: 0.5
});

export function applyBurningEffect({ source, target, simulation, label = "Burning" }) {
    const damagePerTick =
        (source.stats.baseDamage * BURNING_EFFECT_CONFIG.totalDamageMultiplier) / BURNING_EFFECT_CONFIG.maximumTicks;
    if (target._igniteState instanceof BurningEffect && !target._igniteState.isExpired) {
        target._igniteState.refresh({ source, damagePerTick, label });
        return target._igniteState;
    }
    const effect = new BurningEffect({
        source,
        target,
        duration: BURNING_EFFECT_CONFIG.duration,
        tickInterval: BURNING_EFFECT_CONFIG.tickInterval,
        maximumTicks: BURNING_EFFECT_CONFIG.maximumTicks,
        damagePerTick,
        label
    });
    target._igniteState = effect;
    simulation.entities.push(effect);
    return effect;
}

export function consumeBurningEffect(target) {
    const effect = target._igniteState;
    if (!(effect instanceof BurningEffect) || effect.isExpired) return false;
    effect.consume();
    return true;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
    return 1 - (1 - clamp01(value)) ** 3;
}

export class RageFlameRing extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(center, radius, options = {}) {
        super(center.clone(), new Vector2(), 0);
        this.maxRadius = radius;
        this.waveDelays = options.waveDelays ?? [0];
        this.waveDuration = options.waveDuration ?? 0.22;
        this.doubleRing = options.doubleRing ?? false;
        this.particleCount = options.particleCount ?? 18;
        this.maxLife = Math.max(...this.waveDelays) + this.waveDuration;
        this.life = this.maxLife;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const elapsed = this.maxLife - this.life;
        ctx.save();
        this.waveDelays.forEach((delay, index) => this._drawWave(ctx, elapsed, delay, index));
        this._drawFlameFragments(ctx, elapsed);
        ctx.restore();
    }

    _drawWave(ctx, elapsed, delay, index) {
        const localProgress = (elapsed - delay) / this.waveDuration;
        if (localProgress < 0 || localProgress > 1) return;
        const progress = easeOutCubic(localProgress);
        const alpha = 1 - clamp01((localProgress - 0.62) / 0.38);
        const radius = this.maxRadius * progress;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = RAGE_FIRE_COLORS[(index + 1) % RAGE_FIRE_COLORS.length];
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 5);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (this.doubleRing) {
            ctx.strokeStyle = RAGE_FIRE_COLORS[0];
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, radius * 0.82, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = RAGE_FIRE_COLORS[0];
        ctx.globalAlpha = alpha * (1 - progress) * 0.9;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, Math.max(5, this.maxRadius * 0.13 * (1 - progress)), 0, Math.PI * 2);
        ctx.fill();
    }

    _drawFlameFragments(ctx, elapsed) {
        const progress = clamp01(elapsed / this.maxLife);
        const alpha = 1 - progress;
        ctx.globalAlpha = alpha;
        for (const index of Array.from({ length: this.particleCount }, (_, value) => value)) {
            const angle = (Math.PI * 2 * index) / this.particleCount + (index % 2) * 0.08;
            const distance = this.maxRadius * (0.12 + progress * (0.42 + (index % 5) * 0.09));
            const size = 3 + (index % 3) * 2;
            ctx.save();
            ctx.translate(this.position.x + Math.cos(angle) * distance, this.position.y + Math.sin(angle) * distance);
            ctx.rotate(angle + progress * 1.2);
            ctx.fillStyle = RAGE_FIRE_COLORS[index % RAGE_FIRE_COLORS.length];
            ctx.fillRect(-size, -size * 0.6, size * 2, size * 1.2);
            ctx.restore();
        }
    }
}

export class BurningEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({ source, target, duration, tickInterval, maximumTicks, damagePerTick, label = "Ignite" }) {
        super(target.position.clone(), new Vector2(), target.radius);
        this.source = source;
        this.target = target;
        this.duration = duration;
        this.life = duration;
        this.maxLife = duration;
        this.tickInterval = tickInterval;
        this.maximumTicks = maximumTicks;
        this.damagePerTick = damagePerTick;
        this.label = label;
        this.damageLife = duration;
        this.tickTimer = 0;
        this.tickCount = 0;
        this.damageComplete = false;
        this.rebirthVisual = getRebirthVisualProfile(10);
    }

    refresh({ source = this.source, damagePerTick = this.damagePerTick, label = this.label } = {}) {
        this.source = source;
        this.damagePerTick = damagePerTick;
        this.label = label;
        this.life = this.duration;
        this.maxLife = this.duration;
        this.damageLife = this.duration;
        this.tickTimer = 0;
        this.tickCount = 0;
        this.damageComplete = false;
    }

    consume() {
        this._finish();
    }

    update(delta) {
        if (this.target.flags.defeated) {
            this._finish();
            return;
        }
        this.pos = this.target.position.clone();
        this.life = Math.max(0, this.life - delta);
        const damageDelta = Math.min(delta, Math.max(0, this.damageLife));
        this.damageLife = Math.max(0, this.damageLife - damageDelta);
        this.tickTimer += damageDelta;
        while (this.tickTimer + 1e-9 >= this.tickInterval && this.tickCount < this.maximumTicks) {
            this.tickTimer -= this.tickInterval;
            this.tickCount += 1;
            if (!this.source?.flags?.defeated) {
                this.target.takeDamage(this.damagePerTick, this.source, this.label);
            }
        }
        this.damageComplete = this.damageLife <= 1e-9 || this.tickCount >= this.maximumTicks;
        if (this.life <= 1e-9) this._finish();
    }

    _finish() {
        this.isExpired = true;
        if (this.target._igniteState === this) this.target._igniteState = null;
    }

    draw(ctx) {
        if (this.target.flags.defeated) return;
        const ball = this.target;
        const time = this.maxLife - this.life;
        drawRebirthVisualUnderlay(ctx, ball, this.rebirthVisual, time);
        ctx.save();
        ctx.strokeStyle = "#fff4bd";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", this.rebirthVisual.outlineWidth + 3);
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, ball.radius + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        drawRebirthVisualOverlay(ctx, ball, this.rebirthVisual, time);
    }
}
