import * as Swf from "../index.js";

// CONVOLUTIONFILTER: a two-dimensional discrete convolution filter.
class ConvolutionFilter {

    #matrixX;
    #matrixY;
    #divisor;
    #bias;
    #matrix;
    #defaultColor;
    #clamp;
    #preserveAlpha;

    constructor(matrixX, matrixY, divisor, bias, matrix, defaultColor, clamp, preserveAlpha) {
        this.#matrixX = matrixX;
        this.#matrixY = matrixY;
        this.#divisor = divisor;
        this.#bias = bias;
        this.#matrix = matrix;
        this.#defaultColor = defaultColor;
        this.#clamp = clamp;
        this.#preserveAlpha = preserveAlpha;
    }

    get matrixX() {
        return this.#matrixX;
    }

    get matrixY() {
        return this.#matrixY;
    }

    get divisor() {
        return this.#divisor;
    }

    get bias() {
        return this.#bias;
    }

    get matrix() {
        return this.#matrix;
    }

    get defaultColor() {
        return this.#defaultColor;
    }

    get clamp() {
        return this.#clamp;
    }

    get preserveAlpha() {
        return this.#preserveAlpha;
    }

    static read(reader) {
        const matrixX = reader.readUI8();
        const matrixY = reader.readUI8();
        const divisor = reader.readFloat();
        const bias = reader.readFloat();
        const matrix = [];
        for (let i = 0; i < matrixX * matrixY; i++) matrix.push(reader.readFloat());
        const defaultColor = Swf.Color.readRgba(reader);
        reader.readUB(6);
        const clamp = Boolean(reader.readUB(1));
        const preserveAlpha = Boolean(reader.readUB(1));
        return new ConvolutionFilter(matrixX, matrixY, divisor, bias, matrix, defaultColor, clamp, preserveAlpha);
    }
}

export default ConvolutionFilter;
