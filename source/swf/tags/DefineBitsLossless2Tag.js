// DefineBitsLossless2 tag (code 36): a ZLIB-compressed lossless bitmap with
// alpha (32-bit ARGB direct images, RGBA colormap entries). Kept opaque, like
// the JPEG bitmap tags.
class DefineBitsLossless2Tag {

    #characterId;
    #bitmapFormat;
    #bitmapWidth;
    #bitmapHeight;
    #bitmapColorTableSize;
    #zlibBitmapData;

    constructor(characterId, bitmapFormat, bitmapWidth, bitmapHeight, bitmapColorTableSize, zlibBitmapData) {
        this.#characterId = characterId;
        this.#bitmapFormat = bitmapFormat;
        this.#bitmapWidth = bitmapWidth;
        this.#bitmapHeight = bitmapHeight;
        this.#bitmapColorTableSize = bitmapColorTableSize;
        this.#zlibBitmapData = zlibBitmapData;
    }

    get characterId() {
        return this.#characterId;
    }

    get bitmapFormat() {
        return this.#bitmapFormat;
    }

    get bitmapWidth() {
        return this.#bitmapWidth;
    }

    get bitmapHeight() {
        return this.#bitmapHeight;
    }

    get bitmapColorTableSize() {
        return this.#bitmapColorTableSize;
    }

    get zlibBitmapData() {
        return this.#zlibBitmapData;
    }

    static read(reader, length, bodyStart) {
        const characterId = reader.readUI16();
        const bitmapFormat = reader.readUI8();
        const bitmapWidth = reader.readUI16();
        const bitmapHeight = reader.readUI16();
        // The color table size only exists for the 8-bit colormapped format.
        const bitmapColorTableSize = bitmapFormat === 3 ? reader.readUI8() : null;
        const remaining = length - (reader.position - bodyStart);
        const zlibBitmapData = reader.readBytes(remaining);
        return new DefineBitsLossless2Tag(
            characterId, bitmapFormat, bitmapWidth, bitmapHeight, bitmapColorTableSize, zlibBitmapData
        );
    }
}

export default DefineBitsLossless2Tag;
