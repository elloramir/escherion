import * as Swf from "../index.js";

// SetBackgroundColor tag: sets the background color of the stage.
class SetBackgroundColorTag {

    #color;

    constructor(color) {
        this.#color = color;
    }

    get color() {
        return this.#color;
    }

    static read(reader) {
        return new SetBackgroundColorTag(Swf.Color.readRgb(reader));
    }
}

export default SetBackgroundColorTag;
