import * as Swf from "../index.js";

// GLOWFILTER: a glow bitmap filter.
class GlowFilter {

    #color;
    #blurX;
    #blurY;
    #strength;
    #innerGlow;
    #knockout;
    #passes;

    constructor(color, blurX, blurY, strength, innerGlow, knockout, passes) {
        this.#color = color;
        this.#blurX = blurX;
        this.#blurY = blurY;
        this.#strength = strength;
        this.#innerGlow = innerGlow;
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

    get strength() {
        return this.#strength;
    }

    get innerGlow() {
        return this.#innerGlow;
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
        const strength = reader.readFixed8();
        const innerGlow = Boolean(reader.readUB(1));
        const knockout = Boolean(reader.readUB(1));
        reader.readUB(1);
        const passes = reader.readUB(5);
        return new GlowFilter(color, blurX, blurY, strength, innerGlow, knockout, passes);
    }
}

export default GlowFilter;
