// RGB / RGBA color record; reading as RGB leaves alpha opaque (255).
class Color {

    #red;
    #green;
    #blue;
    #alpha;

    constructor(red, green, blue, alpha = 255) {
        this.#red = red;
        this.#green = green;
        this.#blue = blue;
        this.#alpha = alpha;
    }

    get red() {
        return this.#red;
    }

    get green() {
        return this.#green;
    }

    get blue() {
        return this.#blue;
    }

    get alpha() {
        return this.#alpha;
    }

    static readRgb(reader) {
        const red = reader.readUI8();
        const green = reader.readUI8();
        const blue = reader.readUI8();
        return new Color(red, green, blue, 255);
    }

    static readRgba(reader) {
        const red = reader.readUI8();
        const green = reader.readUI8();
        const blue = reader.readUI8();
        const alpha = reader.readUI8();
        return new Color(red, green, blue, alpha);
    }
}

export default Color;
