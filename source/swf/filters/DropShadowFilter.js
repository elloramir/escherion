import * as Swf from "../index.js";

// DROPSHADOWFILTER: a drop shadow bitmap filter.
class DropShadowFilter {

    #color;
    #blurX;
    #blurY;
    #angle;
    #distance;
    #strength;
    #innerShadow;
    #knockout;
    #passes;

    constructor(color, blurX, blurY, angle, distance, strength, innerShadow, knockout, passes) {
        this.#color = color;
        this.#blurX = blurX;
        this.#blurY = blurY;
        this.#angle = angle;
        this.#distance = distance;
        this.#strength = strength;
        this.#innerShadow = innerShadow;
        this.#knockout = knockout;
        this.#passes = passes;
    }

    get color() {
        return this.#color;
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

    get passes() {
        return this.#passes;
    }

    static read(reader) {
        const color = Swf.Color.readRgba(reader);
        const blurX = reader.readFixed();
        const blurY = reader.readFixed();
        const angle = reader.readFixed();
        const distance = reader.readFixed();
        const strength = reader.readFixed8();
        const innerShadow = Boolean(reader.readUB(1));
        const knockout = Boolean(reader.readUB(1));
        reader.readUB(1);
        const passes = reader.readUB(5);
        return new DropShadowFilter(color, blurX, blurY, angle, distance, strength, innerShadow, knockout, passes);
    }
}

export default DropShadowFilter;
