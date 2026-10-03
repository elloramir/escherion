// DefineBitsJPEG3 tag (code 35): DefineBitsJPEG2 plus a separate, ZLIB-
// compressed alpha channel for the JPEG image. Kept opaque, like JPEG2.
class DefineBitsJPEG3Tag {

    #characterId;
    #imageData;
    #bitmapAlphaData;

    constructor(characterId, imageData, bitmapAlphaData) {
        this.#characterId = characterId;
        this.#imageData = imageData;
        this.#bitmapAlphaData = bitmapAlphaData;
    }

    get characterId() {
        return this.#characterId;
    }

    get imageData() {
        return this.#imageData;
    }

    get bitmapAlphaData() {
        return this.#bitmapAlphaData;
    }

    static read(reader, length, bodyStart) {
        const characterId = reader.readUI16();
        const alphaDataOffset = reader.readUI32();
        const imageData = reader.readBytes(alphaDataOffset);
        const remaining = length - (reader.position - bodyStart);
        const bitmapAlphaData = reader.readBytes(remaining);
        return new DefineBitsJPEG3Tag(characterId, imageData, bitmapAlphaData);
    }
}

export default DefineBitsJPEG3Tag;
