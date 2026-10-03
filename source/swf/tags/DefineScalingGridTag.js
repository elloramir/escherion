import * as Swf from "../index.js";

// DefineScalingGrid tag (code 78): associates a sprite or button with a 9-slice
// scaling grid. It is a hint for a live object being resized; the player stores
// the tag but does not apply the visual scaling itself.
class DefineScalingGridTag {

    #characterId;
    #splitter;

    constructor(characterId, splitter) {
        this.#characterId = characterId;
        this.#splitter = splitter;
    }

    get characterId() {
        return this.#characterId;
    }

    get splitter() {
        return this.#splitter;
    }

    static read(reader) {
        const characterId = reader.readUI16();
        const splitter = Swf.Rect.read(reader);
        return new DefineScalingGridTag(characterId, splitter);
    }
}

export default DefineScalingGridTag;
