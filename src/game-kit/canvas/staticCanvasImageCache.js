const DEFAULT_PIXEL_BUDGET = 4_000_000;

function releaseImage(image) {
    image?.close?.();
}

export class StaticCanvasImageCache {
    constructor({ pixelBudget = DEFAULT_PIXEL_BUDGET } = {}) {
        this.pixelBudget = pixelBudget;
        this.pixelCount = 0;
        this.entries = new Map();
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.image;
    }

    canStore(width, height) {
        return width * height <= this.pixelBudget;
    }

    set(key, image, width, height) {
        const pixels = width * height;
        if (!this.canStore(width, height)) return image;
        const previous = this.entries.get(key);
        if (previous) {
            this.pixelCount -= previous.pixels;
            releaseImage(previous.image);
            this.entries.delete(key);
        }
        this.entries.set(key, { image, pixels });
        this.pixelCount += pixels;
        while (this.pixelCount > this.pixelBudget && this.entries.size > 1) {
            const oldestKey = this.entries.keys().next().value;
            const oldest = this.entries.get(oldestKey);
            this.entries.delete(oldestKey);
            this.pixelCount -= oldest.pixels;
            releaseImage(oldest.image);
        }
        return image;
    }

    clear() {
        this.entries.forEach((entry) => releaseImage(entry.image));
        this.entries.clear();
        this.pixelCount = 0;
    }
}

export const staticCanvasImageCache = new StaticCanvasImageCache();

export function createStaticCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    return null;
}

function finalizeStaticCanvasImage(surface) {
    return surface.transferToImageBitmap?.() ?? surface;
}

export function renderCachedCanvasImage({
    cache = staticCanvasImageCache,
    key,
    width,
    height,
    render,
    createSurface = createStaticCanvas,
    finalizeImage = finalizeStaticCanvasImage
}) {
    const cached = cache.get(key);
    if (cached) return { image: cached, hit: true };
    if (!cache.canStore(width, height)) return null;
    const surface = createSurface(width, height);
    const context = surface?.getContext?.("2d");
    if (!context) return null;
    render(context);
    const image = finalizeImage(surface);
    return { image: cache.set(key, image, width, height), hit: false };
}
