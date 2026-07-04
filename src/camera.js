const DEFAULT_ZOOM = 1;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class ArenaCamera {
    constructor({ minZoom = 0.72, maxZoom = 1.08 } = {}) {
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
    }

    getTargetZoom(simulation) {
        const requestedZoom = simulation?.camera?.zoom;
        if (Number.isFinite(requestedZoom)) {
            return clamp(requestedZoom, this.minZoom, this.maxZoom);
        }

        const aliveCount = (simulation?.fighters ?? []).filter((fighter) => !fighter.flags?.defeated).length;
        if (aliveCount <= 2) return DEFAULT_ZOOM;
        if (aliveCount <= 4) return clamp(0.86, this.minZoom, this.maxZoom);
        return clamp(0.78, this.minZoom, this.maxZoom);
    }

    apply(ctx, canvas, simulation) {
        const zoom = this.getTargetZoom(simulation);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(zoom, zoom);
        ctx.translate(-centerX, -centerY);
    }
}
