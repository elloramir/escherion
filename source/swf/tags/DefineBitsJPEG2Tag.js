// DefineBitsJPEG2 tag (code 21): a bitmap whose ImageData is a complete JPEG,
// PNG or GIF89a stream. Kept opaque: pixel decoding is out of scope here, so
// the encoded bytes are preserved for a future backend.
class DefineBitsJPEG2Tag {

    #characterId;
    #imageData;

    constructor(characterId, imageData) {
        this.#characterId = characterId;
        this.#imageData = imageData;
    }

    get characterId() {
        return this.#characterId;
    }

    get imageData() {
        return this.#imageData;
    }

    static read(reader, length, bodyStart) {
        const characterId = reader.readUI16();
        const remaining = length - (reader.position - bodyStart);
        const imageData = reader.readBytes(remaining);
        return new DefineBitsJPEG2Tag(characterId, imageData);
    }
}

export default DefineBitsJPEG2Tag;
