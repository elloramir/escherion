import ShapeRecordList from "./ShapeRecordList.js";

const NO_STYLE_ARRAYS_SHAPE_VERSION = 1;

// SHAPE: a glyph outline in a font's GlyphShapeTable. Same record stream as
// SHAPEWITHSTYLE but with no fill/line style arrays; the outline is drawn with
// a style selected by the consumer, and per spec the first STYLECHANGERECORD
// must set both fill style fields to 1.
class Shape {

    #records;

    constructor(records) {
        this.#records = records;
    }

    get records() {
        return this.#records;
    }

    static read(reader) {
        const fillBits = reader.readUB(4);
        const lineBits = reader.readUB(4);
        const records = ShapeRecordList.read(reader, fillBits, lineBits, NO_STYLE_ARRAYS_SHAPE_VERSION);
        return new Shape(records);
    }
}

export default Shape;
