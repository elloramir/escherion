// flash.geom.ColorTransform. Multipliers are
// floats (1 = identity) and offsets are 0-255, matching avmplus.
class ColorTransform {

    constructor(
        redMultiplier = 1, greenMultiplier = 1, blueMultiplier = 1, alphaMultiplier = 1,
        redOffset = 0, greenOffset = 0, blueOffset = 0, alphaOffset = 0,
    ) {
        this.redMultiplier = redMultiplier;
        this.greenMultiplier = greenMultiplier;
        this.blueMultiplier = blueMultiplier;
        this.alphaMultiplier = alphaMultiplier;
        this.redOffset = redOffset;
        this.greenOffset = greenOffset;
        this.blueOffset = blueOffset;
        this.alphaOffset = alphaOffset;
    }

    get color() {
        const channel = (name) => Math.max(0, Math.min(255, Math.round(Number(this[name]) || 0)));
        return (channel("redOffset") << 16) | (channel("greenOffset") << 8) | channel("blueOffset");
    }

    set color(value) {
        const rgb = Number(value) >>> 0;
        this.redMultiplier = 0;
        this.greenMultiplier = 0;
        this.blueMultiplier = 0;
        this.redOffset = (rgb >> 16) & 0xff;
        this.greenOffset = (rgb >> 8) & 0xff;
        this.blueOffset = rgb & 0xff;
    }

    // Ruffle ColorTransform.as: multipliers multiply, offsets accumulate.
    concat(second) {
        for (const channel of ["red", "green", "blue", "alpha"]) {
            const multiplier = `${channel}Multiplier`;
            const offset = `${channel}Offset`;
            this[offset] += this[multiplier] * second[offset];
            this[multiplier] *= second[multiplier];
        }
    }

    toString() {
        const names = [
            "redMultiplier", "greenMultiplier", "blueMultiplier", "alphaMultiplier",
            "redOffset", "greenOffset", "blueOffset", "alphaOffset",
        ];
        return `(${names.map((name) => `${name}=${this[name]}`).join(", ")})`;
    }
}

export default ColorTransform;
