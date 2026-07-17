const TOKEN_MINIMUM_CSS_PIXELS = Object.freeze({
    hairline: 1.25,
    standard: 2,
    emphasis: 3.25,
    combatText: 13
});

function getTransformScale(ctx) {
    const transform = ctx.getTransform?.();
    if (!transform) return 1;
    const xScale = Math.hypot(transform.a ?? 1, transform.b ?? 0);
    const yScale = Math.hypot(transform.c ?? 0, transform.d ?? 1);
    return Math.max(0.001, Math.min(xScale || 1, yScale || 1));
}

function getCanvasCssScale(ctx) {
    const canvas = ctx.canvas;
    if (!canvas) return 1;
    const rect = canvas.getBoundingClientRect?.();
    const cssWidth = rect?.width ?? canvas.clientWidth ?? canvas.width;
    const cssHeight = rect?.height ?? canvas.clientHeight ?? canvas.height;
    const xScale = canvas.width > 0 ? cssWidth / canvas.width : 1;
    const yScale = canvas.height > 0 ? cssHeight / canvas.height : 1;
    return Math.max(0.001, Math.min(xScale || 1, yScale || 1));
}

export function getWorldToCssScale(ctx) {
    return getTransformScale(ctx) * getCanvasCssScale(ctx);
}

export function getVisibleEffectSize(ctx, token, baseWorldSize) {
    const minimumCssPixels = TOKEN_MINIMUM_CSS_PIXELS[token];
    if (minimumCssPixels == null) {
        throw new Error(`Unknown effect visibility token: ${token}`);
    }
    return Math.max(baseWorldSize, minimumCssPixels / getWorldToCssScale(ctx));
}

export function getVisibleLineWidth(ctx, token = "standard", baseWorldWidth = 3) {
    return getVisibleEffectSize(ctx, token, baseWorldWidth);
}

export function getVisibleCombatTextSize(ctx, baseWorldSize = 18) {
    return getVisibleEffectSize(ctx, "combatText", baseWorldSize);
}

export const EFFECT_VISIBILITY_TOKENS = TOKEN_MINIMUM_CSS_PIXELS;
