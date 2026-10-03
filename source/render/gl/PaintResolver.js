import Matrix from "./core/Matrix.js";

const BITMAP_FILL_TYPES = new Set([0x40, 0x41, 0x42, 0x43]);
const GRADIENT_TYPES = { 0x10: 1, 0x12: 2, 0x13: 3 };

// Resolves fill/stroke styles to cached paint descriptors (solid colour, gradient ramp or bitmap).
class PaintResolver {

    #textures;
    #bitmaps;
    #bitmapData;
    #paints = new WeakMap();

    constructor(textures, bitmaps, bitmapData) {
        this.#textures = textures;
        this.#bitmaps = bitmaps;
        this.#bitmapData = bitmapData;
    }

    // Null when unresolved (pending bitmap, unknown type).
    resolve(style, dictionary) {
        if (!style) return null;
        let fill = style;
        if (style.fillType) fill = style.fillType;
        else if (style.color === undefined && style.fill) fill = style.fill;
        const solid = fill.color;
        if (solid) {
            let paint = this.#paints.get(fill);
            if (!paint) {
                const color = Float32Array.of(
                    solid.red / 255, solid.green / 255, solid.blue / 255, (solid.alpha ?? 255) / 255,
                );
                paint = { kind: 0, color };
                this.#paints.set(fill, paint);
            }
            return paint;
        }
        if (fill.gradient) {
            let paint = this.#paints.get(fill);
            if (!paint) {
                const kind = GRADIENT_TYPES[fill.type];
                const inverse = Matrix.invert(PaintResolver.#swfMatrix(fill.gradientMatrix), new Float64Array(6));
                if (!kind || !inverse || !fill.gradient.records?.length) return null;
                paint = {
                    kind,
                    matrix: Matrix.toMat3(inverse, new Float32Array(9)),
                    focal: kind === 3 ? Math.max(-0.98, Math.min(0.98, fill.gradient.focalPoint ?? 0)) : 0,
                    spread: fill.gradient.spreadMode ?? 0,
                    texture: this.#textures.ramp(fill.gradient),
                };
                this.#paints.set(fill, paint);
            }
            return paint;
        }
        if (BITMAP_FILL_TYPES.has(fill.type) || fill.bitmapId || fill.bitmap) {
            let texture;
            let width;
            let height;
            if (fill.bitmap) {
                const entry = this.#bitmapData.entry(fill.bitmap);
                if (!entry) return null;
                ({ texture, width, height } = entry);
            } else {
                const tag = dictionary?.get(fill.bitmapId);
                if (!tag) {
                    console.warn(`Bitmap '${fill.bitmapId}' is not available`);
                    return null;
                }
                const source = this.#bitmaps.get(tag);
                const image = source ? this.#textures.image(source) : null;
                if (!image) return null;
                ({ texture, width, height } = image);
            }
            let paint = this.#paints.get(fill);
            if (!paint || paint.texture !== texture) {
                const inverse = Matrix.invert(PaintResolver.#swfMatrix(fill.bitmapMatrix), new Float64Array(6));
                if (!inverse) return null;
                paint = {
                    kind: 4,
                    matrix: Matrix.toMat3(inverse, new Float32Array(9)),
                    texture,
                    width,
                    height,
                    repeat: fill.type === 0x40 || fill.type === 0x42,
                    smooth: fill.type === 0x40 || fill.type === 0x41,
                };
                this.#paints.set(fill, paint);
            }
            return paint;
        }
        console.warn(`Fill type '${fill.type ?? "unknown"}' is not implemented`);
        return null;
    }

    // SWF matrix record to `[a, b, c, d, tx, ty]`.
    static #swfMatrix(matrix) {
        if (!matrix) return Matrix.identity();
        return new Float64Array([
            matrix.scaleX, matrix.rotateSkew1, matrix.rotateSkew0,
            matrix.scaleY, matrix.translateX, matrix.translateY,
        ]);
    }
}

export default PaintResolver;
