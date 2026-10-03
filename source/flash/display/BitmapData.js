import Rectangle from "../geom/Rectangle.js";

// flash.display.BitmapData — a real RGBA buffer with the common read/write
// surface. Pixels are A,R,G,B (Flash order).
// Operations needing a full compositor are honest skips.
class BitmapData {

    constructor(width = 0, height = 0, transparent = true, fillColor = 0xffffffff) {
        this.width = Math.max(0, Number(width) | 0);
        this.height = Math.max(0, Number(height) | 0);
        this.transparent = Boolean(transparent);
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
        if (fillColor !== undefined && fillColor !== null && this.width > 0 && this.height > 0) {
            const value = Number(fillColor) >>> 0;
            for (let index = 0; index < this.data.length; index += 4) {
                this.data[index] = (value >> 24) & 0xff;
                this.data[index + 1] = (value >> 16) & 0xff;
                this.data[index + 2] = (value >> 8) & 0xff;
                this.data[index + 3] = value & 0xff;
            }
        }
    }

    get rect() {
        return new Rectangle(0, 0, this.width, this.height);
    }

    getPixel(x, y) {
        const [a, r, g, b] = this.#readPixel(x, y);
        return (r << 16) | (g << 8) | b;
    }

    getPixel32(x, y) {
        const [a, r, g, b] = this.#readPixel(x, y);
        return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
    }

    setPixel(x, y, color) {
        const value = Number(color) >>> 0;
        this.#writePixel(x, y, 255, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
    }

    setPixel32(x, y, color) {
        this.#writeColor(x, y, Number(color) >>> 0);
    }

    fillRect(rect, color) {
        const value = Number(color) >>> 0;
        const x0 = Math.max(0, Math.floor(Number(rect.x) || 0));
        const y0 = Math.max(0, Math.floor(Number(rect.y) || 0));
        for (let y = y0; y < y0 + Math.floor(Number(rect.height) || 0); y++) {
            for (let x = x0; x < x0 + Math.floor(Number(rect.width) || 0); x++) {
                this.#writeColor(x, y, value);
            }
        }
    }

    clone() {
        const copy = new BitmapData(this.width, this.height, this.transparent);
        copy.data.set(this.data);
        return copy;
    }

    dispose() {
        this.data = null;
    }

    getBytesPerPixel() {
        return 4;
    }

    setPixels(rect, data) {
        const source = data?.data ?? data;
        if (source instanceof Uint8Array && this.data) {
            this.data.set(source.subarray(0, this.data.length));
        }
    }

    // Renders `source` (a display object) through the player's renderer, honouring the transform,
    // colour transform and clip rectangle. The renderer is reached through the stage so the flash
    // layer never imports it; without one the buffer is left untouched.
    draw(source, matrix = null, colorTransform = null, blendMode = null, clipRect = null, smoothing = false) {
        void blendMode;
        const rasterizer = source?.stage?.bitmapRasterizer;
        if (typeof rasterizer !== "function") {
            console.warn("flash.display.BitmapData.draw: no rasterizer available");
            return;
        }
        const pixels = rasterizer(this, source, matrix, colorTransform, clipRect, smoothing);
        if (pixels && this.data) this.data.set(pixels);
    }

    copyPixels() {
        console.warn("flash.display.BitmapData.copyPixels: not implemented");
    }

    fill() {
        console.warn("flash.display.BitmapData.fill: not implemented");
    }

    applyFilter() {
        console.warn("flash.display.BitmapData.applyFilter: not implemented");
    }

    colorTransform() {
        console.warn("flash.display.BitmapData.colorTransform: not implemented");
    }

    threshold() {
        console.warn("flash.display.BitmapData.threshold: not implemented");
    }

    merge() {
        console.warn("flash.display.BitmapData.merge: not implemented");
    }

    noise() {
        console.warn("flash.display.BitmapData.noise: not implemented");
    }

    perlinNoise() {
        console.warn("flash.display.BitmapData.perlinNoise: not implemented");
    }

    paletteMap() {
        console.warn("flash.display.BitmapData.paletteMap: not implemented");
    }

    scroll() {
        console.warn("flash.display.BitmapData.scroll: not implemented");
    }

    generateFilterRect(rect) {
        return rect;
    }

    compare() {
        return 0;
    }

    #readPixel(x, y) {
        const px = Math.floor(Number(x) || 0);
        const py = Math.floor(Number(y) || 0);
        if (!this.data || px < 0 || py < 0 || px >= this.width || py >= this.height) {
            return [0, 0, 0, 0];
        }
        const index = (py * this.width + px) * 4;
        return [this.data[index], this.data[index + 1], this.data[index + 2], this.data[index + 3]];
    }

    #writeColor(x, y, value) {
        const a = (value >> 24) & 0xff;
        const r = (value >> 16) & 0xff;
        const g = (value >> 8) & 0xff;
        const b = value & 0xff;
        this.#writePixel(x, y, a, r, g, b);
    }

    #writePixel(x, y, a, r, g, b) {
        const px = Math.floor(Number(x) || 0);
        const py = Math.floor(Number(y) || 0);
        if (!this.data || px < 0 || py < 0 || px >= this.width || py >= this.height) return;
        const index = (py * this.width + px) * 4;
        this.data[index] = a;
        this.data[index + 1] = r;
        this.data[index + 2] = g;
        this.data[index + 3] = b;
    }
}

export default BitmapData;
