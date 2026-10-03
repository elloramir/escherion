import TagList from "./TagList.js";

// DefineSprite tag: a character made of its own timeline (frames and control
// tags), terminated by an End tag.
class DefineSpriteTag {

    #spriteId;
    #frameCount;
    #controlTags;

    constructor(spriteId, frameCount, controlTags) {
        this.#spriteId = spriteId;
        this.#frameCount = frameCount;
        this.#controlTags = controlTags;
    }

    get spriteId() {
        return this.#spriteId;
    }

    get frameCount() {
        return this.#frameCount;
    }

    get controlTags() {
        return this.#controlTags;
    }

    static read(reader, length, bodyStart, swfVersion) {
        const spriteId = reader.readUI16();
        const frameCount = reader.readUI16();
        const controlTags = TagList.read(reader, swfVersion);
        return new DefineSpriteTag(spriteId, frameCount, controlTags);
    }
}

export default DefineSpriteTag;
