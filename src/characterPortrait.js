import { getCharacterDefinitionByAbility } from "./characters/characterRegistry.js";
import { Vector2 } from "./core.js";
import { BattleBall } from "./entities/battleBall.js";

const MAXIMUM_PIXEL_RATIO = 2;
const PORTRAIT_RADIUS_RATIO = 0.36;

function getCanvasDisplaySize(canvas) {
    const bounds = canvas.getBoundingClientRect?.();
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

export function renderCharacterPortrait(canvas, portrait) {
    if (!canvas) return false;
    const context = canvas.getContext?.("2d");
    if (!context) return false;

    const { width, height } = getCanvasDisplaySize(canvas);
    const pixelRatio = Math.min(MAXIMUM_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const fighter = portrait?.fighter ?? portrait;
    if (!fighter?.stats || !fighter?.ability) return false;

    const center = new Vector2(width / 2, height / 2);
    const radius = Math.min(width, height) * PORTRAIT_RADIUS_RATIO;
    const ball = createPortraitBall(fighter, portrait?.equipmentItems, center, radius);
    ball.drawPortrait(context);
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
