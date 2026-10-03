import * as Swf from "../index.js";
import Gradient from "./Gradient.js";
import FocalGradient from "./FocalGradient.js";

const SOLID = 0x00;
const LINEAR_GRADIENT = 0x10;
const RADIAL_GRADIENT = 0x12;
const FOCAL_RADIAL_GRADIENT = 0x13;
const REPEATING_BITMAP = 0x40;
const CLIPPED_BITMAP = 0x41;
const NON_SMOOTHED_REPEATING_BITMAP = 0x42;
const NON_SMOOTHED_CLIPPED_BITMAP = 0x43;

const BITMAP_TYPES = new Set([
    REPEATING_BITMAP, CLIPPED_BITMAP, NON_SMOOTHED_REPEATING_BITMAP, NON_SMOOTHED_CLIPPED_BITMAP
]);

// FILLSTYLE: a solid color, gradient or bitmap fill for a shape path.
class FillStyle {

    #type;
    #color;
    #gradientMatrix;
    #gradient;
    #bitmapId;
    #bitmapMatrix;

    constructor(type, color, gradientMatrix, gradient, bitmapId, bitmapMatrix) {
        this.#type = type;
        this.#color = color;
        this.#gradientMatrix = gradientMatrix;
        this.#gradient = gradient;
        this.#bitmapId = bitmapId;
        this.#bitmapMatrix = bitmapMatrix;
    }

    get type() {
        return this.#type;
    }

    get color() {
        return this.#color;
    }

    get gradientMatrix() {
        return this.#gradientMatrix;
    }

    get gradient() {
        return this.#gradient;
    }

    get bitmapId() {
        return this.#bitmapId;
    }

    get bitmapMatrix() {
        return this.#bitmapMatrix;
    }

    static read(reader, shapeVersion) {
        const type = reader.readUI8();
        if (type === SOLID) {
            const color = shapeVersion >= 3 ? Swf.Color.readRgba(reader) : Swf.Color.readRgb(reader);
            return new FillStyle(type, color, null, null, null, null);
        }
        if (type === LINEAR_GRADIENT || type === RADIAL_GRADIENT) {
            const gradientMatrix = Swf.Matrix.read(reader);
            const gradient = Gradient.read(reader, shapeVersion);
            return new FillStyle(type, null, gradientMatrix, gradient, null, null);
        }
        if (type === FOCAL_RADIAL_GRADIENT) {
            const gradientMatrix = Swf.Matrix.read(reader);
            const gradient = FocalGradient.read(reader, shapeVersion);
            return new FillStyle(type, null, gradientMatrix, gradient, null, null);
        }
        if (BITMAP_TYPES.has(type)) {
            const bitmapId = reader.readUI16();
            const bitmapMatrix = Swf.Matrix.read(reader);
            return new FillStyle(type, null, null, null, bitmapId, bitmapMatrix);
        }
        throw new Error(`FillStyle: unknown fill style type 0x${type.toString(16)}`);
    }

    static readArray(reader, shapeVersion) {
        let count = reader.readUI8();
        if (count === 0xff) count = reader.readUI16();
        const styles = [];
        for (let i = 0; i < count; i++) {
            styles.push(FillStyle.read(reader, shapeVersion));
        }
        return styles;
    }
}

export default FillStyle;
