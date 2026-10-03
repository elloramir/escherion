import * as Swf from "../index.js";
import MorphFillStyle from "./MorphFillStyle.js";

const MITER_JOIN = 2;

// MORPHLINESTYLE2: a stroke style shared by a DefineMorphShape2's start and end
// states, with the same join/cap/scaling options as LINESTYLE2 (unlike
// MORPHLINESTYLE, which only supports DefineMorphShape's plain round joins).
class MorphLineStyle2 {

    #startWidth;
    #endWidth;
    #startCapStyle;
    #joinStyle;
    #noHScale;
    #noVScale;
    #pixelHinting;
    #noClose;
    #endCapStyle;
    #miterLimitFactor;
    #startColor;
    #endColor;
    #fillType;

    constructor(
        startWidth, endWidth, startCapStyle, joinStyle, noHScale, noVScale, pixelHinting,
        noClose, endCapStyle, miterLimitFactor, startColor, endColor, fillType
    ) {
        this.#startWidth = startWidth;
        this.#endWidth = endWidth;
        this.#startCapStyle = startCapStyle;
        this.#joinStyle = joinStyle;
        this.#noHScale = noHScale;
        this.#noVScale = noVScale;
        this.#pixelHinting = pixelHinting;
        this.#noClose = noClose;
        this.#endCapStyle = endCapStyle;
        this.#miterLimitFactor = miterLimitFactor;
        this.#startColor = startColor;
        this.#endColor = endColor;
        this.#fillType = fillType;
    }

    get startWidth() {
        return this.#startWidth;
    }

    get endWidth() {
        return this.#endWidth;
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

    get startColor() {
        return this.#startColor;
    }

    get endColor() {
        return this.#endColor;
    }

    get fillType() {
        return this.#fillType;
    }

    static read(reader) {
        const startWidth = reader.readUI16();
        const endWidth = reader.readUI16();
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
        const startColor = hasFillFlag ? null : Swf.Color.readRgba(reader);
        const endColor = hasFillFlag ? null : Swf.Color.readRgba(reader);
        const fillType = hasFillFlag ? MorphFillStyle.read(reader) : null;
        return new MorphLineStyle2(
            startWidth, endWidth, startCapStyle, joinStyle, noHScale, noVScale, pixelHinting,
            noClose, endCapStyle, miterLimitFactor, startColor, endColor, fillType
        );
    }

    static readArray(reader) {
        let count = reader.readUI8();
        if (count === 0xff) count = reader.readUI16();
        const styles = [];
        for (let i = 0; i < count; i++) {
            styles.push(MorphLineStyle2.read(reader));
        }
        return styles;
    }
}

export default MorphLineStyle2;
