// MATRIX: a 2x3 transform (scale, rotate/skew, translate).
class Matrix {

    #scaleX;
    #scaleY;
    #rotateSkew0;
    #rotateSkew1;
    #translateX;
    #translateY;

    constructor(scaleX, scaleY, rotateSkew0, rotateSkew1, translateX, translateY) {
        this.#scaleX = scaleX;
        this.#scaleY = scaleY;
        this.#rotateSkew0 = rotateSkew0;
        this.#rotateSkew1 = rotateSkew1;
        this.#translateX = translateX;
        this.#translateY = translateY;
    }

    get scaleX() {
        return this.#scaleX;
    }

    get scaleY() {
        return this.#scaleY;
    }

    get rotateSkew0() {
        return this.#rotateSkew0;
    }

    get rotateSkew1() {
        return this.#rotateSkew1;
    }

    get translateX() {
        return this.#translateX;
    }

    get translateY() {
        return this.#translateY;
    }

    static read(reader) {
        let scaleX = 1;
        let scaleY = 1;
        if (reader.readUB(1)) {
            const nScaleBits = reader.readUB(5);
            scaleX = reader.readFB(nScaleBits);
            scaleY = reader.readFB(nScaleBits);
        }
        let rotateSkew0 = 0;
        let rotateSkew1 = 0;
        if (reader.readUB(1)) {
            const nRotateBits = reader.readUB(5);
            rotateSkew0 = reader.readFB(nRotateBits);
            rotateSkew1 = reader.readFB(nRotateBits);
        }
        const nTranslateBits = reader.readUB(5);
        const translateX = reader.readSB(nTranslateBits);
        const translateY = reader.readSB(nTranslateBits);
        reader.align();
        return new Matrix(scaleX, scaleY, rotateSkew0, rotateSkew1, translateX, translateY);
    }
}

export default Matrix;
