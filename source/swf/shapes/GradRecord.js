import * as Swf from "../index.js";

// GRADRECORD: a single color stop within a gradient.
class GradRecord {

    #ratio;
    #color;

    constructor(ratio, color) {
        this.#ratio = ratio;
        this.#color = color;
    }

    get ratio() {
        return this.#ratio;
    }

    get color() {
        return this.#color;
    }

    static read(reader, shapeVersion) {
        const ratio = reader.readUI8();
        const color = shapeVersion >= 3 ? Swf.Color.readRgba(reader) : Swf.Color.readRgb(reader);
        return new GradRecord(ratio, color);
    }
}

export default GradRecord;
