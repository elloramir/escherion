import * as Swf from "../index.js";
import MorphGradient from "./MorphGradient.js";

const SOLID_FILL = 0x00;
const LINEAR_GRADIENT = 0x10;
const RADIAL_GRADIENT = 0x12;
const FOCAL_RADIAL_GRADIENT = 0x13;
const GRADIENT_TYPES = new Set([LINEAR_GRADIENT, RADIAL_GRADIENT, FOCAL_RADIAL_GRADIENT]);
const BITMAP_TYPES = new Set([0x40, 0x41, 0x42, 0x43]);

// MORPHFILLSTYLE: a fill style shared by a morph shape's start and end states.
// Every field that can differ between the two (color, matrix) arrives as a
// start/end pair; only the fill's own type stays fixed across the morph.
class MorphFillStyle {

    #type;
    #startColor;
    #endColor;
    #startGradientMatrix;
    #endGradientMatrix;
    #gradient;
    #bitmapId;
    #startBitmapMatrix;
    #endBitmapMatrix;

    constructor(
        type, startColor, endColor, startGradientMatrix, endGradientMatrix,
        gradient, bitmapId, startBitmapMatrix, endBitmapMatrix
    ) {
        this.#type = type;
        this.#startColor = startColor;
        this.#endColor = endColor;
        this.#startGradientMatrix = startGradientMatrix;
        this.#endGradientMatrix = endGradientMatrix;
        this.#gradient = gradient;
        this.#bitmapId = bitmapId;
        this.#startBitmapMatrix = startBitmapMatrix;
        this.#endBitmapMatrix = endBitmapMatrix;
    }

    get type() {
        return this.#type;
    }

    get startColor() {
        return this.#startColor;
    }

    get endColor() {
        return this.#endColor;
    }

    get startGradientMatrix() {
        return this.#startGradientMatrix;
    }

    get endGradientMatrix() {
        return this.#endGradientMatrix;
    }

    get gradient() {
        return this.#gradient;
    }

    get bitmapId() {
        return this.#bitmapId;
    }

    get startBitmapMatrix() {
        return this.#startBitmapMatrix;
    }

    get endBitmapMatrix() {
        return this.#endBitmapMatrix;
    }

    static read(reader) {
        const type = reader.readUI8();
        if (type === SOLID_FILL) {
            const startColor = Swf.Color.readRgba(reader);
            const endColor = Swf.Color.readRgba(reader);
            return new MorphFillStyle(type, startColor, endColor, null, null, null, null, null, null);
        }
        if (GRADIENT_TYPES.has(type)) {
            const startGradientMatrix = Swf.Matrix.read(reader);
            const endGradientMatrix = Swf.Matrix.read(reader);
            const gradient = MorphGradient.read(reader, type);
            return new MorphFillStyle(
                type, null, null, startGradientMatrix, endGradientMatrix, gradient, null, null, null
            );
        }
        if (BITMAP_TYPES.has(type)) {
            const bitmapId = reader.readUI16();
            const startBitmapMatrix = Swf.Matrix.read(reader);
            const endBitmapMatrix = Swf.Matrix.read(reader);
            return new MorphFillStyle(
                type, null, null, null, null, null, bitmapId, startBitmapMatrix, endBitmapMatrix
            );
        }
        throw new Error(`MorphFillStyle: unknown fill style type 0x${type.toString(16)}`);
    }

    static readArray(reader) {
        let count = reader.readUI8();
        if (count === 0xff) count = reader.readUI16();
        const styles = [];
        for (let i = 0; i < count; i++) {
            styles.push(MorphFillStyle.read(reader));
        }
        return styles;
    }
}

export default MorphFillStyle;
