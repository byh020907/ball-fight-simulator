const DEFAULT_ZOOM = 1;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class ArenaCamera {
    constructor({ minZoom = 0.55, maxZoom = 1.25 } = {}) {
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
    }

    getTargetZoom(simulation) {
        const requestedZoom = simulation?.camera?.zoom;
        if (Number.isFinite(requestedZoom)) {
            return clamp(requestedZoom, this.minZoom, this.maxZoom);
        }

        return DEFAULT_ZOOM;
    }

    getViewTransform(canvas, simulation) {
        const worldWidth = Math.max(1, simulation?.width ?? canvas.width);
        const worldHeight = Math.max(1, simulation?.height ?? canvas.height);
        const fitScale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);
        const scale = fitScale * this.getTargetZoom(simulation);

        return {
            scale,
            offsetX: (canvas.width - worldWidth * scale) / 2,
            offsetY: (canvas.height - worldHeight * scale) / 2,
            worldWidth,
            worldHeight
        };
    }

    apply(ctx, canvas, simulation) {
        const { scale, offsetX, offsetY } = this.getViewTransform(canvas, simulation);

        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
    }
}
