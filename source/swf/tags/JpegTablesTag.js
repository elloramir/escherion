// JPEGTables tag (code 8): the single shared JPEG encoding table (SOI...DHT/DQT
// header data, no image data) used by any DefineBits tags in the same file.
// Kept opaque, like the bitmap tags.
class JpegTablesTag {

    #jpegData;

    constructor(jpegData) {
        this.#jpegData = jpegData;
    }

    get jpegData() {
        return this.#jpegData;
    }

    static read(reader, length, bodyStart) {
        const remaining = length - (reader.position - bodyStart);
        const jpegData = reader.readBytes(remaining);
        return new JpegTablesTag(jpegData);
    }
}

export default JpegTablesTag;
