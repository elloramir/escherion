// Offscreen raster surface helper. Web-only: uses OffscreenCanvas when present,
// otherwise a detached <canvas>. The only place such a surface is allocated.
class Surface {

    static isSupported() {
        return typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined";
    }

    static create(width, height) {
        if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    static context(surface) {
        return surface?.getContext?.("2d") ?? null;
    }
}

export default Surface;
