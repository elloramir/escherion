import * as Swf from "../index.js";

// GRADIENTBEVELFILTER: a bevel filter using a gradient ramp instead of a single color.
class GradientBevelFilter {

    #colors;
    #ratios;
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
        colors, ratios, blurX, blurY, angle, distance,
        strength, innerShadow, knockout, onTop, passes
    ) {
        this.#colors = colors;
        this.#ratios = ratios;
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

    get colors() {
        return this.#colors;
    }

    get ratios() {
        return this.#ratios;
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
        const numColors = reader.readUI8();
        const colors = [];
        for (let i = 0; i < numColors; i++) colors.push(Swf.Color.readRgba(reader));
        const ratios = [];
        for (let i = 0; i < numColors; i++) ratios.push(reader.readUI8());
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
        return new GradientBevelFilter(
            colors, ratios, blurX, blurY, angle, distance,
            strength, innerShadow, knockout, onTop, passes
        );
    }
}

export default GradientBevelFilter;
