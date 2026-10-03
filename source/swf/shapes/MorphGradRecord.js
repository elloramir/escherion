import * as Swf from "../index.js";

// MORPHGRADRECORD: one color stop shared by a morph gradient's start and end states.
class MorphGradRecord {

    #startRatio;
    #startColor;
    #endRatio;
    #endColor;

    constructor(startRatio, startColor, endRatio, endColor) {
        this.#startRatio = startRatio;
        this.#startColor = startColor;
        this.#endRatio = endRatio;
        this.#endColor = endColor;
    }

    get startRatio() {
        return this.#startRatio;
    }

    get startColor() {
        return this.#startColor;
    }

    get endRatio() {
        return this.#endRatio;
    }

    get endColor() {
        return this.#endColor;
    }

    static read(reader) {
        const startRatio = reader.readUI8();
        const startColor = Swf.Color.readRgba(reader);
        const endRatio = reader.readUI8();
        const endColor = Swf.Color.readRgba(reader);
        return new MorphGradRecord(startRatio, startColor, endRatio, endColor);
    }
}

export default MorphGradRecord;
