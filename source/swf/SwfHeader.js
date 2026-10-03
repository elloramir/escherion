import Rect from "./Rect.js";

// SWF file header: signature, version, frame size, rate and count.
class SwfHeader {

    #compression;
    #version;
    #fileLength;
    #frameSize;
    #frameRate;
    #frameCount;

    constructor(compression, version, fileLength, frameSize, frameRate, frameCount) {
        this.#compression = compression;
        this.#version = version;
        this.#fileLength = fileLength;
        this.#frameSize = frameSize;
        this.#frameRate = frameRate;
        this.#frameCount = frameCount;
    }

    get compression() {
        return this.#compression;
    }

    get version() {
        return this.#version;
    }

    get fileLength() {
        return this.#fileLength;
    }

    get frameSize() {
        return this.#frameSize;
    }

    get frameRate() {
        return this.#frameRate;
    }

    get frameCount() {
        return this.#frameCount;
    }

    // The signature, version and file length always precede compression.
    static readPreamble(bytes) {
        const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
        const compressionBySignature = { FWS: "none", CWS: "zlib", ZWS: "lzma" };
        const compression = compressionBySignature[signature];
        if (!compression) {
            throw new Error(`SwfHeader: unknown signature "${signature}"`);
        }
        const version = bytes[3];
        const fileLength = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
        return { compression, version, fileLength, headerSize: 8 };
    }

    static read(reader, compression, version, fileLength) {
        const frameSize = Rect.read(reader);
        const frameRate = reader.readFixed8();
        const frameCount = reader.readUI16();
        return new SwfHeader(compression, version, fileLength, frameSize, frameRate, frameCount);
    }
}

export default SwfHeader;
