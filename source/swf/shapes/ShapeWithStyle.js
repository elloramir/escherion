import FillStyle from "./FillStyle.js";
import LineStyle from "./LineStyle.js";
import LineStyle2 from "./LineStyle2.js";
import ShapeRecordList from "./ShapeRecordList.js";

// SHAPEWITHSTYLE: fill styles, line styles and the shape record stream.
class ShapeWithStyle {

    #fillStyles;
    #lineStyles;
    #records;

    constructor(fillStyles, lineStyles, records) {
        this.#fillStyles = fillStyles;
        this.#lineStyles = lineStyles;
        this.#records = records;
    }

    get fillStyles() {
        return this.#fillStyles;
    }

    get lineStyles() {
        return this.#lineStyles;
    }

    get records() {
        return this.#records;
    }

    static read(reader, shapeVersion) {
        const fillStyles = FillStyle.readArray(reader, shapeVersion);
        const lineStyles = shapeVersion === 4
            ? LineStyle2.readArray(reader)
            : LineStyle.readArray(reader, shapeVersion);
        const fillBits = reader.readUB(4);
        const lineBits = reader.readUB(4);
        const records = ShapeRecordList.read(reader, fillBits, lineBits, shapeVersion);
        return new ShapeWithStyle(fillStyles, lineStyles, records);
    }
}

export default ShapeWithStyle;
