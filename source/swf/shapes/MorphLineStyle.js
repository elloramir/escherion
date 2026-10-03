import * as Swf from "../index.js";

// MORPHLINESTYLE: a plain (round join/cap only) stroke style shared by a
// DefineMorphShape's start and end states.
class MorphLineStyle {

    #startWidth;
    #endWidth;
    #startColor;
    #endColor;

    constructor(startWidth, endWidth, startColor, endColor) {
        this.#startWidth = startWidth;
        this.#endWidth = endWidth;
        this.#startColor = startColor;
        this.#endColor = endColor;
    }

    get startWidth() {
        return this.#startWidth;
    }

    get endWidth() {
        return this.#endWidth;
    }

    get startColor() {
        return this.#startColor;
    }

    get endColor() {
        return this.#endColor;
    }

    static read(reader) {
        const startWidth = reader.readUI16();
        const endWidth = reader.readUI16();
        const startColor = Swf.Color.readRgba(reader);
        const endColor = Swf.Color.readRgba(reader);
        return new MorphLineStyle(startWidth, endWidth, startColor, endColor);
    }

    static readArray(reader) {
        let count = reader.readUI8();
        if (count === 0xff) count = reader.readUI16();
        const styles = [];
        for (let i = 0; i < count; i++) {
            styles.push(MorphLineStyle.read(reader));
        }
        return styles;
    }
}

export default MorphLineStyle;
