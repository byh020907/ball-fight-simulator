import { getCharacterDefinitionByAbility } from "./characters/characterRegistry.js";
import { Vector2 } from "./core.js";
import { BattleBall } from "./entities/battleBall.js";
import { renderCachedCanvasImage } from "./game-kit/canvas/staticCanvasImageCache.js";

const MAXIMUM_PIXEL_RATIO = 2;
const PORTRAIT_RADIUS_RATIO = 0.36;

function getCanvasDisplaySize(canvas) {
    const bounds = canvas.getBoundingClientRect?.();
    if (bounds && (bounds.width <= 0 || bounds.height <= 0)) return null;
    return {
        width: Math.max(1, bounds?.width || canvas.clientWidth || canvas.width || 1),
        height: Math.max(1, bounds?.height || canvas.clientHeight || canvas.height || 1)
    };
}

function createPortraitBall(fighter, equipmentItems, center, radius) {
    const ball = new BattleBall(
        {
            ...fighter,
            rotationEnabled: false,
            equipment: {
                ...fighter.equipment,
                equippedItems: Array.isArray(equipmentItems) ? equipmentItems : []
            }
        },
        center
    );
    ball.radius = radius;
    ball.stats.baseRadius = radius;
    ball.angle = 0;
    ball.applyImpulse(ball.velocity.clone().scale(-1));

    const AbilityClass = getCharacterDefinitionByAbility(fighter.ability)?.abilityClass;
    if (AbilityClass) ball.bindAbility(new AbilityClass(ball, {}));
    return ball;
}

export function getPortraitVisualKey(portrait) {
    const fighter = portrait?.fighter ?? portrait;
    const equipmentItems = portrait?.equipmentItems ?? [];
    return JSON.stringify({
        id: fighter?.id,
        ability: fighter?.ability,
        color: fighter?.color,
        face: fighter?.face,
        appearance: fighter?.appearance,
        rebirthCount: fighter?.rebirthCount,
        equipment: equipmentItems.map((item) => ({ rarity: item.rarity, enhanceLevel: item.enhanceLevel }))
    });
}

export function renderCharacterPortrait(canvas, portrait, { cache, createSurface, finalizeImage } = {}) {
    if (!canvas) return false;
    const displaySize = getCanvasDisplaySize(canvas);
    if (!displaySize) {
        if (canvas.width !== 1) canvas.width = 1;
        if (canvas.height !== 1) canvas.height = 1;
        return false;
    }

    const context = canvas.getContext?.("2d");
    if (!context) return false;

    const { width, height } = displaySize;
    const pixelRatio = Math.min(MAXIMUM_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    const fighter = portrait?.fighter ?? portrait;
    if (!fighter?.stats || !fighter?.ability) return false;
    const backingWidth = canvas.width;
    const backingHeight = canvas.height;
    const drawVector = (targetContext) => {
        targetContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        targetContext.clearRect(0, 0, width, height);
        const center = new Vector2(width / 2, height / 2);
        const radius = Math.min(width, height) * PORTRAIT_RADIUS_RATIO;
        const ball = createPortraitBall(fighter, portrait?.equipmentItems, center, radius);
        ball.drawPortrait(targetContext);
    };
    const cached = renderCachedCanvasImage({
        cache,
        key: `character-portrait:${getPortraitVisualKey(portrait)}:${backingWidth}x${backingHeight}:${pixelRatio}`,
        width: backingWidth,
        height: backingHeight,
        render: drawVector,
        createSurface,
        finalizeImage
    });
    if (cached) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, backingWidth, backingHeight);
        context.drawImage(cached.image, 0, 0);
    } else {
        drawVector(context);
    }
    return true;
}

export class CharacterPortraitController {
    constructor(
        canvas,
        {
            ResizeObserverClass = globalThis.ResizeObserver,
            requestFrame = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((callback) => callback())
        } = {}
    ) {
        this.canvas = canvas;
        this.portrait = null;
        this.requestFrame = requestFrame;
        this.renderPending = false;
        this.resizeObserver = ResizeObserverClass ? new ResizeObserverClass(() => this.scheduleRender()) : null;
        this.resizeObserver?.observe(canvas);
    }

    setPortrait(portrait) {
        if (getPortraitVisualKey(this.portrait) === getPortraitVisualKey(portrait)) return;
        this.portrait = portrait;
        this.scheduleRender();
    }

    scheduleRender() {
        if (this.renderPending) return;
        this.renderPending = true;
        this.requestFrame(() => {
            this.renderPending = false;
            renderCharacterPortrait(this.canvas, this.portrait);
        });
    }

    destroy() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.canvas = null;
    }
}

export function registerCharacterPortraitDirective(Alpine) {
    Alpine.directive("character-portrait", (canvas, { expression }, { evaluateLater, effect, cleanup }) => {
        const controller = new CharacterPortraitController(canvas);
        const evaluatePortrait = evaluateLater(expression);
        effect(() => evaluatePortrait((portrait) => controller.setPortrait(portrait)));
        cleanup(() => controller.destroy());
    });
}
