// RECT: a rectangular region in twips.
class Rect {

    #xMin;
    #xMax;
    #yMin;
    #yMax;

    constructor(xMin, xMax, yMin, yMax) {
        this.#xMin = xMin;
        this.#xMax = xMax;
        this.#yMin = yMin;
        this.#yMax = yMax;
    }

    get xMin() {
        return this.#xMin;
    }

    get xMax() {
        return this.#xMax;
    }

    get yMin() {
        return this.#yMin;
    }

    get yMax() {
        return this.#yMax;
    }

    static read(reader) {
        const nBits = reader.readUB(5);
        const xMin = reader.readSB(nBits);
        const xMax = reader.readSB(nBits);
        const yMin = reader.readSB(nBits);
        const yMax = reader.readSB(nBits);
        reader.align();
        return new Rect(xMin, xMax, yMin, yMax);
    }
}

export default Rect;
