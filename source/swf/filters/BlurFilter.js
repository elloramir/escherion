// BLURFILTER: a box blur bitmap filter.
class BlurFilter {

    #blurX;
    #blurY;
    #passes;

    constructor(blurX, blurY, passes) {
        this.#blurX = blurX;
        this.#blurY = blurY;
        this.#passes = passes;
    }

    get blurX() {
        return this.#blurX;
    }

    get blurY() {
        return this.#blurY;
    }

    get passes() {
        return this.#passes;
    }

    static read(reader) {
        const blurX = reader.readFixed();
        const blurY = reader.readFixed();
        const passes = reader.readUB(5);
        reader.readUB(3);
        return new BlurFilter(blurX, blurY, passes);
    }
}

export default BlurFilter;
