import { Vector2 } from "../core.js";
import { ELEMENTALIST_CONFIG, getElementalistWetDamageComparison } from "../abilities/elementalistAbility.js";
import { ELEMENTAL_COMPOSITE_RECIPES, ELEMENTAL_PALETTE, ELEMENTAL_TYPES } from "../abilities/elementalistRecipes.js";
import { ElementalChannelEffect, drawElementalOrb } from "../effects/elementalistEffects.js";
import { ElementalWetReactionEffect } from "../effects/elementalWetReactionEffect.js";
import { applyElementalWet } from "../effects/elementalWetEffect.js";

const ELEMENT_LABELS = Object.freeze({
    fire: "화염",
    electric: "전기",
    frost: "냉기",
    wind: "바람",
    earth: "대지"
});

const PREVIEW_CONFIG = Object.freeze({
    width: 640,
    height: 360,
    wetDuration: 2.5,
    source: Object.freeze({ x: 120, y: 180, radius: 28 }),
    target: Object.freeze({ x: 515, y: 180, radius: 34 }),
    orbRadius: 13,
    maximumPixelRatio: 2,
    maximumFrameDelta: 1 / 20,
    wetReactionLeadIn: 0.6
});

const SINGLE_PREVIEWS = ELEMENTAL_TYPES.map((element) =>
    Object.freeze({
        id: `single:${element}`,
        label: `단일 · ${ELEMENT_LABELS[element]}`,
        description: `${ELEMENT_LABELS[element]} 원소 채널의 실제 전투 연출`,
        elements: Object.freeze([element]),
        recipe: null
    })
);

const COMPOSITE_PREVIEWS = Object.values(ELEMENTAL_COMPOSITE_RECIPES).map((recipe) =>
    Object.freeze({
        id: `composite:${recipe.id}`,
        label: `융합 · ${recipe.name}`,
        description: `${recipe.elements.map((element) => ELEMENT_LABELS[element]).join(" + ")} 조합의 실제 전투 연출`,
        elements: recipe.elements,
        recipe
    })
);

export const ELEMENTALIST_VFX_PREVIEW_OPTIONS = Object.freeze([
    Object.freeze({
        id: "wet",
        label: "상태 · 젖음",
        description: "원소 반응이 가능한 젖음 상태의 실제 추적 연출",
        elements: Object.freeze(["water"]),
        recipe: null
    }),
    ...SINGLE_PREVIEWS,
    ...COMPOSITE_PREVIEWS
]);

function getPreviewOption(previewId) {
    return (
        ELEMENTALIST_VFX_PREVIEW_OPTIONS.find((option) => option.id === previewId) ??
        ELEMENTALIST_VFX_PREVIEW_OPTIONS.find((option) => option.id === "single:fire")
    );
}

function createPreviewFighter(config, color) {
    return {
        id: `elementalist-preview-${color}`,
        position: new Vector2(config.x, config.y),
        velocity: new Vector2(),
        radius: config.radius,
        color,
        flags: { defeated: false },
        state: { elementalWetUntil: 0, elementalWetStackExpiries: [], elementalWetEffect: null },
        stats: { baseSpeed: 300 }
    };
}

function drawPreviewFighter(ctx, fighter) {
    ctx.save();
    ctx.fillStyle = fighter.color;
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(fighter.position.x, fighter.position.y, fighter.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawPreviewArena(ctx) {
    const { width, height } = PREVIEW_CONFIG;
    ctx.fillStyle = "#e6e4df";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    ctx.fillStyle = "rgba(32, 32, 32, 0.12)";
    [0.18, 0.38, 0.62, 0.82].forEach((ratio, index) => {
        ctx.beginPath();
        ctx.arc(width * ratio, height * (index % 2 === 0 ? 0.22 : 0.78), 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function createPreviewOrbs(option, source) {
    const elements = option.elements.filter((element) => element !== "water");
    const centerOffset = (elements.length - 1) / 2;
    return elements.map((element, index) => ({
        element,
        elements: [element],
        position: new Vector2(source.position.x + 62, source.position.y + (index - centerOffset) * 58),
        radius: PREVIEW_CONFIG.orbRadius,
        createdAt: index * 0.17
    }));
}

export class ElementalistVfxPreviewScene {
    constructor(previewId = "single:fire", previewMode = "dry") {
        this.elapsed = 0;
        this.simulation = { elapsed: 0, entities: [] };
        this.source = createPreviewFighter(PREVIEW_CONFIG.source, "#8f6ee8");
        this.target = createPreviewFighter(PREVIEW_CONFIG.target, "#d06b5e");
        this.setPreview(previewId, previewMode);
    }

    setPreview(previewId, previewMode = "dry") {
        this.effect?.consume?.();
        this.option = getPreviewOption(previewId);
        this.orbs = createPreviewOrbs(this.option, this.source);
        this.replay(previewMode);
    }

    replay(previewMode = "dry") {
        this.effect?.consume?.();
        this.target.state.elementalWetUntil = 0;
        this.target.state.elementalWetStackExpiries = [];
        this.target.state.elementalWetEffect = null;
        this.phaseElapsed = 0;
        this.wetReactionLeadIn = false;
        this.wetReactionLeadOut = false;
        this.reactionEffects = [];
        if (this.option.id === "wet") {
            this.effect = null;
            return true;
        }
        this.previewMode = previewMode === "wet" ? "wet" : "dry";
        if (this.previewMode === "wet") {
            this.wetReactionLeadIn = true;
            this.effect = applyElementalWet(this.target, this.simulation, PREVIEW_CONFIG.wetDuration);
            return true;
        }
        this._createChannelEffect(false);
        return true;
    }

    _createChannelEffect(wetSnapshot) {
        this.effect?.consume?.();
        this.phaseElapsed = 0;
        this.wetReactionLeadIn = false;
        this.wetReactionLeadOut = false;
        this.effect = new ElementalChannelEffect({
            channel: { cancelled: false, finished: false, wetSnapshot },
            source: this.source,
            target: this.target,
            elements: this.option.elements,
            recipe: this.option.recipe,
            duration: ELEMENTALIST_CONFIG.channelDuration
        });
        if (wetSnapshot && this.option.elements.includes("earth")) {
            this.reactionEffects.push(new ElementalWetReactionEffect({ target: this.target, elements: ["earth"] }));
        }
    }

    triggerWet() {
        if (this.option.id !== "wet") return false;
        this.phaseElapsed = 0;
        this.effect = applyElementalWet(this.target, this.simulation, PREVIEW_CONFIG.wetDuration);
        return true;
    }

    update(delta) {
        const boundedDelta = Math.min(PREVIEW_CONFIG.maximumFrameDelta, Math.max(0, delta));
        this.elapsed += boundedDelta;
        this.phaseElapsed += boundedDelta;
        this.simulation.elapsed = this.elapsed;
        this.reactionEffects.forEach((effect) => effect.update(boundedDelta));
        this.reactionEffects = this.reactionEffects.filter((effect) => !effect.isExpired);
        if (!this.effect) return;
        this.effect.update(boundedDelta);
        if (this.option.id === "wet") {
            if (this.effect.isExpired) this.effect = null;
            return;
        }
        if (this.wetReactionLeadIn) {
            if (this.phaseElapsed >= PREVIEW_CONFIG.wetReactionLeadIn) this._createChannelEffect(true);
            return;
        }
        if (this.wetReactionLeadOut) {
            if (this.effect.isExpired) this.replay(this.previewMode);
            return;
        }
        if (this.effect.isExpired || this.phaseElapsed >= ELEMENTALIST_CONFIG.channelDuration) {
            if (this.previewMode === "wet") {
                const settledElements = this.option.elements.filter((element) => element !== "earth");
                if (settledElements.length > 0) {
                    this.effect = new ElementalWetReactionEffect({
                        target: this.target,
                        elements: settledElements
                    });
                    this.wetReactionLeadOut = true;
                    this.phaseElapsed = 0;
                    return;
                }
            }
            this.replay(this.previewMode);
        }
    }

    draw(ctx) {
        drawPreviewArena(ctx);
        drawPreviewFighter(ctx, this.source);
        drawPreviewFighter(ctx, this.target);
        this.orbs.forEach((orb) => drawElementalOrb(ctx, orb, this.elapsed));
        this.effect?.draw(ctx);
        this.reactionEffects.forEach((effect) => effect.draw(ctx));
    }
}

export class ElementalistVfxPreviewController {
    constructor({
        requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
        cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
        ResizeObserverClass = globalThis.ResizeObserver
    } = {}) {
        this.requestFrame = requestFrame;
        this.cancelFrame = cancelFrame;
        this.ResizeObserverClass = ResizeObserverClass;
        this.frameId = null;
        this.lastFrameTime = null;
        this.canvas = null;
        this.scene = null;
        this.resizeObserver = null;
    }

    start(canvas, previewId, previewMode = "dry") {
        if (!canvas?.getContext || !this.requestFrame) return { ok: false, error: "preview_unavailable" };
        this.stop();
        this.canvas = canvas;
        this.scene = new ElementalistVfxPreviewScene(previewId, previewMode);
        this.resizeObserver = this.ResizeObserverClass ? new this.ResizeObserverClass(() => this._resize()) : null;
        this.resizeObserver?.observe(canvas);
        this._resize();
        this.frameId = this.requestFrame((time) => this._renderFrame(time));
        return { ok: true };
    }

    stop() {
        if (this.frameId !== null) this.cancelFrame?.(this.frameId);
        this.resizeObserver?.disconnect();
        this.frameId = null;
        this.lastFrameTime = null;
        this.canvas = null;
        this.scene = null;
        this.resizeObserver = null;
        return { ok: true };
    }

    triggerWet() {
        if (!this.scene || !this.canvas) return { ok: false, error: "preview_unavailable" };
        if (!this.scene.triggerWet()) return { ok: false, error: "wet_preview_inactive" };
        return { ok: true };
    }

    _resize() {
        if (!this.canvas) return;
        const bounds = this.canvas.getBoundingClientRect();
        const pixelRatio = Math.min(PREVIEW_CONFIG.maximumPixelRatio, globalThis.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }

    _renderFrame(time) {
        if (!this.canvas || !this.scene) return;
        const delta = this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
        this.lastFrameTime = time;
        this.scene.update(delta);
        const context = this.canvas.getContext("2d");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const scale = Math.min(this.canvas.width / PREVIEW_CONFIG.width, this.canvas.height / PREVIEW_CONFIG.height);
        const offsetX = (this.canvas.width - PREVIEW_CONFIG.width * scale) / 2;
        const offsetY = (this.canvas.height - PREVIEW_CONFIG.height * scale) / 2;
        context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
        this.scene.draw(context);
        this.frameId = this.requestFrame((nextTime) => this._renderFrame(nextTime));
    }
}

export function getElementalistVfxPreviewOptions() {
    return ELEMENTALIST_VFX_PREVIEW_OPTIONS.map(({ id, label, description, elements, recipe }) => ({
        id,
        label,
        description,
        damageComparison: id === "wet" ? null : getElementalistWetDamageComparison(elements, recipe)
    }));
}
