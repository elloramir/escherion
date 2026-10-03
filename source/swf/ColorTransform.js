// CXFORM: a color multiply/add transform with no alpha channel.
class ColorTransform {

    #redMult;
    #greenMult;
    #blueMult;
    #redAdd;
    #greenAdd;
    #blueAdd;

    constructor(redMult, greenMult, blueMult, redAdd, greenAdd, blueAdd) {
        this.#redMult = redMult;
        this.#greenMult = greenMult;
        this.#blueMult = blueMult;
        this.#redAdd = redAdd;
        this.#greenAdd = greenAdd;
        this.#blueAdd = blueAdd;
    }

    get redMult() {
        return this.#redMult;
    }

    get greenMult() {
        return this.#greenMult;
    }

    get blueMult() {
        return this.#blueMult;
    }

    get redAdd() {
        return this.#redAdd;
    }

    get greenAdd() {
        return this.#greenAdd;
    }

    get blueAdd() {
        return this.#blueAdd;
    }

    static read(reader) {
        const hasAddTerms = reader.readUB(1);
        const hasMultTerms = reader.readUB(1);
        const nBits = reader.readUB(4);
        // Multiply terms are 8.8 fixed point: 256 means 1.0.
        const redMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const greenMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const blueMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const redAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        const greenAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        const blueAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        reader.align();
        return new ColorTransform(redMult, greenMult, blueMult, redAdd, greenAdd, blueAdd);
    }
}

export default ColorTransform;
