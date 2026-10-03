// COLORMATRIXFILTER: a 4x5 color transformation matrix filter.
class ColorMatrixFilter {

    #matrix;

    constructor(matrix) {
        this.#matrix = matrix;
    }

    get matrix() {
        return this.#matrix;
    }

    static read(reader) {
        const matrix = [];
        for (let i = 0; i < 20; i++) matrix.push(reader.readFloat());
        return new ColorMatrixFilter(matrix);
    }
}

export default ColorMatrixFilter;
