import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";
import { ELEMENTAL_PALETTE } from "../abilities/elementalistRecipes.js";
import { getVisibleLineWidth } from "./effectVisibility.js";
import { addElementalWetStack, getActiveElementalWetStackCount, pruneElementalWetStacks } from "./elementalWetState.js";

export const ELEMENTAL_WET_VISUAL_CONFIG = Object.freeze({
    rimPadding: 5,
    rimGap: 4,
    dropletCount: 5,
    dropletTravelPadding: 12,
    dropletSpeed: 0.72,
    minimumDropletSize: 3.5,
    dropletSizeStep: 1.1,
    fadeDuration: 0.24
});

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function drawDroplet(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.35);
    ctx.quadraticCurveTo(size, -size * 0.08, size * 0.72, size * 0.58);
    ctx.quadraticCurveTo(0, size * 1.35, -size * 0.72, size * 0.58);
    ctx.quadraticCurveTo(-size, -size * 0.08, 0, -size * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawWetRims(ctx, target, time) {
    const config = ELEMENTAL_WET_VISUAL_CONFIG;
    const baseRadius = target.radius + config.rimPadding;
    ctx.save();
    ctx.lineCap = "round";
    [0, 1].forEach((index) => {
        const radius = baseRadius + index * config.rimGap;
        const rotation = time * (index === 0 ? 1.55 : -1.1) + index * Math.PI;
        ctx.strokeStyle = index === 0 ? ELEMENTAL_PALETTE.water : "#e8fbff";
        ctx.lineWidth = getVisibleLineWidth(ctx, index === 0 ? "emphasis" : "standard", index === 0 ? 4 : 2.5);
        ctx.beginPath();
        ctx.arc(target.position.x, target.position.y, radius, rotation, rotation + Math.PI * 1.42);
        ctx.stroke();
    });
    ctx.restore();
}

function drawFallingDroplets(ctx, target, time, fade, stackCount) {
    const config = ELEMENTAL_WET_VISUAL_CONFIG;
    const dropletCount = config.dropletCount + Math.max(0, stackCount - 1) * 3;
    const travel = target.radius * 2 + config.dropletTravelPadding * 2;
    ctx.save();
    ctx.fillStyle = ELEMENTAL_PALETTE.water;
    ctx.strokeStyle = "#e8fbff";
    ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 1.5);
    Array.from({ length: dropletCount }, (_, index) => index).forEach((index) => {
        const progress = (time * config.dropletSpeed + index / dropletCount) % 1;
        const side = index % 2 === 0 ? -1 : 1;
        const lane = 0.58 + (index % 3) * 0.15;
        const x = target.position.x + side * target.radius * lane;
        const y = target.position.y - target.radius - config.dropletTravelPadding + travel * progress;
        const alpha = Math.sin(progress * Math.PI);
        const size = config.minimumDropletSize + (index % 3) * config.dropletSizeStep;
        ctx.globalAlpha = (0.46 + alpha * 0.5) * fade;
        drawDroplet(ctx, x, y, size);
    });
    ctx.restore();
}

export class ElementalWetEffect extends EntityAttachment(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({ target, simulation }) {
        super(target.position.clone(), new Vector2(), target.radius);
        this.target = target;
        this.attachToEntity(target);
        this.simulation = simulation;
        this.expiresAt = target.state.elementalWetUntil;
        this.stackCount = getActiveElementalWetStackCount(target, simulation.elapsed);
    }

    refresh() {
        this.stackCount = getActiveElementalWetStackCount(this.target, this.simulation.elapsed);
        this.expiresAt = this.target.state.elementalWetUntil;
        this.isExpired = false;
    }

    consume() {
        this.isExpired = true;
        if (this.target?.state?.elementalWetEffect === this) this.target.state.elementalWetEffect = null;
    }

    update() {
        const activeExpiries = pruneElementalWetStacks(this.target, this.simulation.elapsed);
        if (this.target?.flags?.defeated || activeExpiries.length === 0) {
            this.consume();
            return;
        }
        this.stackCount = activeExpiries.length;
        this.expiresAt = activeExpiries.at(-1);
        this.syncAttachedPosition();
    }

    draw(ctx) {
        if (this.isExpired || !this.target) return;
        const remaining = Math.max(0, this.expiresAt - this.simulation.elapsed);
        const fade = clamp01(remaining / ELEMENTAL_WET_VISUAL_CONFIG.fadeDuration);
        const time = this.simulation.elapsed;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = `rgba(119, 223, 255, ${0.1 + this.stackCount * 0.06})`;
        ctx.beginPath();
        ctx.arc(this.target.position.x, this.target.position.y, this.target.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        drawWetRims(ctx, this.target, time);
        drawFallingDroplets(ctx, this.target, time, fade, this.stackCount);
        ctx.restore();
    }
}

export function applyElementalWet(target, simulation, duration) {
    addElementalWetStack(target, simulation.elapsed, duration);
    const currentEffect = target.state.elementalWetEffect;
    if (currentEffect instanceof ElementalWetEffect && !currentEffect.isExpired) {
        currentEffect.refresh();
        return currentEffect;
    }
    const effect = new ElementalWetEffect({ target, simulation });
    target.state.elementalWetEffect = effect;
    simulation.entities.push(effect);
    return effect;
}
