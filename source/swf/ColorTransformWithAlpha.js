// CXFORMWITHALPHA: a color multiply/add transform including alpha.
class ColorTransformWithAlpha {

    #redMult;
    #greenMult;
    #blueMult;
    #alphaMult;
    #redAdd;
    #greenAdd;
    #blueAdd;
    #alphaAdd;

    constructor(redMult, greenMult, blueMult, alphaMult, redAdd, greenAdd, blueAdd, alphaAdd) {
        this.#redMult = redMult;
        this.#greenMult = greenMult;
        this.#blueMult = blueMult;
        this.#alphaMult = alphaMult;
        this.#redAdd = redAdd;
        this.#greenAdd = greenAdd;
        this.#blueAdd = blueAdd;
        this.#alphaAdd = alphaAdd;
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

    get alphaMult() {
        return this.#alphaMult;
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

    get alphaAdd() {
        return this.#alphaAdd;
    }

    static read(reader) {
        const hasAddTerms = reader.readUB(1);
        const hasMultTerms = reader.readUB(1);
        const nBits = reader.readUB(4);
        // Multiply terms are 8.8 fixed point: 256 means 1.0.
        const redMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const greenMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const blueMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const alphaMult = hasMultTerms ? reader.readSB(nBits) : 256;
        const redAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        const greenAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        const blueAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        const alphaAdd = hasAddTerms ? reader.readSB(nBits) : 0;
        reader.align();
        return new ColorTransformWithAlpha(
            redMult, greenMult, blueMult, alphaMult,
            redAdd, greenAdd, blueAdd, alphaAdd
        );
    }
}

export default ColorTransformWithAlpha;
