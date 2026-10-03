// DefineBits tag (code 6): a bitmap whose JPEG data (from the frame header
// onward, no encoding table of its own) is decoded together with the file's one
// shared JPEGTables tag. Kept opaque, like the other bitmap tags.
class DefineBitsTag {

    #characterId;
    #jpegData;

    constructor(characterId, jpegData) {
        this.#characterId = characterId;
        this.#jpegData = jpegData;
    }

    get characterId() {
        return this.#characterId;
    }

    get jpegData() {
        return this.#jpegData;
    }

    static read(reader, length, bodyStart) {
        const characterId = reader.readUI16();
        const remaining = length - (reader.position - bodyStart);
        const jpegData = reader.readBytes(remaining);
        return new DefineBitsTag(characterId, jpegData);
    }
}

export default DefineBitsTag;
