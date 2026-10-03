import * as Swf from "../index.js";

// LINESTYLE: width and color of a stroke (DefineShape/2/3).
class LineStyle {

    #width;
    #color;

    constructor(width, color) {
        this.#width = width;
        this.#color = color;
    }

    get width() {
        return this.#width;
    }

    get color() {
        return this.#color;
    }

    static read(reader, shapeVersion) {
        const width = reader.readUI16();
        const color = shapeVersion >= 3 ? Swf.Color.readRgba(reader) : Swf.Color.readRgb(reader);
        return new LineStyle(width, color);
    }

    static readArray(reader, shapeVersion) {
        let count = reader.readUI8();
        if (count === 0xff) count = reader.readUI16();
        const styles = [];
        for (let i = 0; i < count; i++) {
            styles.push(LineStyle.read(reader, shapeVersion));
        }
        return styles;
    }
}

export default LineStyle;
