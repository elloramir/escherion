import * as Swf from "../index.js";

// BEVELFILTER: a bevel bitmap filter.
class BevelFilter {

    #shadowColor;
    #highlightColor;
    #blurX;
    #blurY;
    #angle;
    #distance;
    #strength;
    #innerShadow;
    #knockout;
    #onTop;
    #passes;

    constructor(
        shadowColor, highlightColor, blurX, blurY, angle, distance,
        strength, innerShadow, knockout, onTop, passes
    ) {
        this.#shadowColor = shadowColor;
        this.#highlightColor = highlightColor;
        this.#blurX = blurX;
        this.#blurY = blurY;
        this.#angle = angle;
        this.#distance = distance;
        this.#strength = strength;
        this.#innerShadow = innerShadow;
        this.#knockout = knockout;
        this.#onTop = onTop;
        this.#passes = passes;
    }

    get shadowColor() {
        return this.#shadowColor;
    }

    get highlightColor() {
        return this.#highlightColor;
    }

    get blurX() {
        return this.#blurX;
    }

    get blurY() {
        return this.#blurY;
    }

    get angle() {
        return this.#angle;
    }

    get distance() {
        return this.#distance;
    }

    get strength() {
        return this.#strength;
    }

    get innerShadow() {
        return this.#innerShadow;
    }

    get knockout() {
        return this.#knockout;
    }

    get onTop() {
        return this.#onTop;
    }

    get passes() {
        return this.#passes;
    }

    static read(reader) {
        const shadowColor = Swf.Color.readRgba(reader);
        const highlightColor = Swf.Color.readRgba(reader);
        const blurX = reader.readFixed();
        const blurY = reader.readFixed();
        const angle = reader.readFixed();
        const distance = reader.readFixed();
        const strength = reader.readFixed8();
        const innerShadow = Boolean(reader.readUB(1));
        const knockout = Boolean(reader.readUB(1));
        reader.readUB(1);
        const onTop = Boolean(reader.readUB(1));
        const passes = reader.readUB(4);
        return new BevelFilter(
            shadowColor, highlightColor, blurX, blurY, angle, distance,
            strength, innerShadow, knockout, onTop, passes
        );
    }
}

export default BevelFilter;
