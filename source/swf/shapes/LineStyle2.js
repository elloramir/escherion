import * as Swf from "../index.js";
import FillStyle from "./FillStyle.js";

const MITER_JOIN = 2;

// LINESTYLE2: extended stroke style with joins, caps and fills (DefineShape4).
class LineStyle2 {

    #width;
    #startCapStyle;
    #joinStyle;
    #noHScale;
    #noVScale;
    #pixelHinting;
    #noClose;
    #endCapStyle;
    #miterLimitFactor;
    #color;
    #fillType;

    constructor(
        width, startCapStyle, joinStyle, noHScale, noVScale, pixelHinting,
        noClose, endCapStyle, miterLimitFactor, color, fillType
    ) {
        this.#width = width;
        this.#startCapStyle = startCapStyle;
        this.#joinStyle = joinStyle;
        this.#noHScale = noHScale;
        this.#noVScale = noVScale;
        this.#pixelHinting = pixelHinting;
        this.#noClose = noClose;
        this.#endCapStyle = endCapStyle;
        this.#miterLimitFactor = miterLimitFactor;
        this.#color = color;
        this.#fillType = fillType;
    }

    get width() {
        return this.#width;
    }

    get startCapStyle() {
        return this.#startCapStyle;
    }

    get joinStyle() {
        return this.#joinStyle;
    }

    get noHScale() {
        return this.#noHScale;
    }

    get noVScale() {
        return this.#noVScale;
    }

    get pixelHinting() {
        return this.#pixelHinting;
    }

    get noClose() {
        return this.#noClose;
    }

    get endCapStyle() {
        return this.#endCapStyle;
    }

    get miterLimitFactor() {
        return this.#miterLimitFactor;
    }

    get color() {
        return this.#color;
    }

    get fillType() {
        return this.#fillType;
    }

    static read(reader) {
        const width = reader.readUI16();
        const startCapStyle = reader.readUB(2);
        const joinStyle = reader.readUB(2);
        const hasFillFlag = reader.readUB(1);
        const noHScale = Boolean(reader.readUB(1));
        const noVScale = Boolean(reader.readUB(1));
        const pixelHinting = Boolean(reader.readUB(1));
        reader.readUB(5);
        const noClose = Boolean(reader.readUB(1));
        const endCapStyle = reader.readUB(2);
        const miterLimitFactor = joinStyle === MITER_JOIN ? reader.readUI16() : null;
        const color = hasFillFlag ? null : Swf.Color.readRgba(reader);
        const fillType = hasFillFlag ? FillStyle.read(reader, 4) : null;
        return new LineStyle2(
            width, startCapStyle, joinStyle, noHScale, noVScale, pixelHinting,
            noClose, endCapStyle, miterLimitFactor, color, fillType
        );
    }

    static readArray(reader) {
        let count = reader.readUI8();
        if (count === 0xff) count = reader.readUI16();
        const styles = [];
        for (let i = 0; i < count; i++) {
            styles.push(LineStyle2.read(reader));
        }
        return styles;
    }
}

export default LineStyle2;
