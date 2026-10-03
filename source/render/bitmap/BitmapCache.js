import Surface from "../Surface.js";
import BitmapDecoder from "./BitmapDecoder.js";


// Character-id keyed bitmap cache. Decoding is asynchronous (ZLIB via
// DecompressionStream, images via createImageBitmap), so the first frames after
// a bitmap is first used simply skip it; onReady lets the renderer request
// another frame when the pixels arrive.
//
// A decoded bitmap is wrapped in an offscreen canvas so it can be consumed
// synchronously as a CanvasPattern or drawn with drawImage.
class BitmapCache {

    #entries = new Map();
    #patterns = new Map();

    constructor({ onReady = null } = {}) {
        this.onReady = onReady;
    }

    get(tag) {
        if (!tag) return null;
        const entry = this.#entries.get(tag);
        if (entry?.state === "ready") return entry.source;
        if (entry) return null;
        this.#entries.set(tag, { state: "loading", source: null });
        this.#load(tag);
        return null;
    }

    pattern(fillStyle, context, dictionary) {
        const tag = dictionary?.get(fillStyle.bitmapId);
        if (!tag) {
            console.warn(`Bitmap '${fillStyle.bitmapId}' is not available`);
            return null;
        }
        const source = this.get(tag);
        if (!source) return null;
        if (typeof context.createPattern !== "function") return null;
        const repeating = fillStyle.type === 0x40 || fillStyle.type === 0x42;
        const key = `${fillStyle.bitmapId}:${repeating}:${BitmapCache.#matrixKey(fillStyle.bitmapMatrix)}`;
        let pattern = this.#patterns.get(key);
        if (pattern && pattern.context === context) return pattern.pattern;
        try {
            pattern = context.createPattern(source, repeating ? "repeat" : "no-repeat");
        } catch (error) {
            console.warn(`Bitmap '${fillStyle.bitmapId}' could not be used as a pattern: ${error?.message ?? error}`
            );
            return null;
        }
        if (!pattern) {
            console.warn(`Bitmap '${fillStyle.bitmapId}' decoded but createPattern returned nothing`
            );
            return null;
        }
        const matrix = fillStyle.bitmapMatrix;
        if (matrix && typeof pattern.setTransform === "function") {
            pattern.setTransform({
                a: matrix.scaleX,
                b: matrix.rotateSkew1,
                c: matrix.rotateSkew0,
                d: matrix.scaleY,
                e: matrix.translateX,
                f: matrix.translateY,
            });
        }
        this.#patterns.set(key, { context, pattern });
        return pattern;
    }

    async #load(tag) {
        try {
            let source = null;
            if (tag.imageData) {
                source = await BitmapCache.#decodeImage(tag.imageData);
            } else if (tag.zlibBitmapData) {
                source = await BitmapCache.#decodeLossless(tag);
            } else {
                throw new Error("bitmap data is unavailable");
            }
            if (!source) throw new Error("decoded bitmap has no pixels");
            this.#entries.set(tag, { state: "ready", source });
            this.onReady?.();
        } catch (error) {
            this.#entries.set(tag, { state: "failed", source: null });
            const id = BitmapCache.#tagId(tag);
            console.warn(`Bitmap '${id}' could not be decoded: ${error?.message ?? error}`);
        }
    }

    static async #decodeLossless(tag) {
        const hasAlpha = tag.constructor.name === "DefineBitsLossless2Tag";
        const decoded = await BitmapDecoder.decodeLossless(tag, hasAlpha);
        const surface = Surface.create(decoded.width, decoded.height);
        const context = Surface.context(surface);
        if (!context) return null;
        context.putImageData(new ImageData(decoded.pixels, decoded.width, decoded.height), 0, 0);
        return surface;
    }

    static #decodeImage(bytes) {
        return createImageBitmap(new Blob([bytes]));
    }

    static #matrixKey(matrix) {
        if (!matrix) return "none";
        return `${matrix.scaleX},${matrix.rotateSkew0},${matrix.rotateSkew1},`
            + `${matrix.scaleY},${matrix.translateX},${matrix.translateY}`;
    }

    static #tagId(tag) {
        return tag?.characterId ?? tag?.bitmapId ?? tag?.constructor?.name ?? "unknown";
    }

    clear() {
        this.#entries.clear();
        this.#patterns.clear();
    }
}

export default BitmapCache;
