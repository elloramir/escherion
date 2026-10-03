// Cursor over a byte buffer with SWF primitive readers, bit-level and byte-level.
class Reader {

    #bytes;
    #byteOffset;
    #bitBuffer;
    #bitCount;

    constructor(bytes) {
        this.#bytes = bytes;
        this.#byteOffset = 0;
        this.#bitBuffer = 0;
        this.#bitCount = 0;
    }

    get position() {
        return this.#byteOffset;
    }

    get bytesLeft() {
        return this.#bytes.length - this.#byteOffset;
    }

    // Hands out a sub-reader over the next bytes without copying, for deferred body parsing.
    split(count) {
        const part = new Reader(this.#bytes.subarray(this.#byteOffset, this.#byteOffset + count));
        this.#byteOffset += count;
        this.#bitBuffer = 0;
        this.#bitCount = 0;
        return part;
    }

    // Drops buffered bits; a byte-aligned SWF field requires this after bit-level fields.
    align() {
        this.#bitBuffer = 0;
        this.#bitCount = 0;
    }

    readUB(nBits) {
        let value = 0;
        let bitsNeeded = nBits;
        while (bitsNeeded > 0) {
            if (this.#bitCount === 0) {
                this.#bitBuffer = this.#bytes[this.#byteOffset++];
                this.#bitCount = 8;
            }
            const take = Math.min(bitsNeeded, this.#bitCount);
            const shift = this.#bitCount - take;
            const mask = (1 << take) - 1;
            value = (value * (1 << take)) + ((this.#bitBuffer >> shift) & mask);
            this.#bitCount -= take;
            bitsNeeded -= take;
        }
        return value >>> 0;
    }

    readSB(nBits) {
        if (nBits === 0) return 0;
        const value = this.readUB(nBits);
        const signBit = 2 ** (nBits - 1);
        return value >= signBit ? value - (signBit * 2) : value;
    }

    readFB(nBits) {
        return this.readSB(nBits) / 65536;
    }

    // Skips an unmodeled tag body; the tag header length is authoritative, so parsing continues.
    skip(count) {
        this.align();
        this.#byteOffset += Math.max(0, count | 0);
    }

    readUI8() {
        this.align();
        return this.#bytes[this.#byteOffset++];
    }

    readUI16() {
        this.align();
        const o = this.#byteOffset;
        const value = this.#bytes[o] | (this.#bytes[o + 1] << 8);
        this.#byteOffset += 2;
        return value;
    }

    readSI16() {
        const value = this.readUI16();
        return value & 0x8000 ? value - 0x10000 : value;
    }

    readUI32() {
        this.align();
        const o = this.#byteOffset;
        const b = this.#bytes;
        const value = (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
        this.#byteOffset += 4;
        return value;
    }

    readFixed() {
        return (this.readUI32() | 0) / 65536;
    }

    readFixed8() {
        return this.readSI16() / 256;
    }

    readFloat() {
        this.align();
        const o = this.#byteOffset;
        const buffer = new ArrayBuffer(4);
        const bytes = new Uint8Array(buffer);
        bytes.set(this.#bytes.subarray(o, o + 4));
        this.#byteOffset += 4;
        return new DataView(buffer).getFloat32(0, true);
    }

    readFloat16() {
        const value = this.readUI16();
        const sign = value & 0x8000 ? -1 : 1;
        const exponent = (value >> 10) & 0x1f;
        const fraction = value & 0x3ff;
        if (exponent === 0) return sign * fraction * 2 ** -24;
        if (exponent === 0x1f) return fraction ? NaN : sign * Infinity;
        return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
    }

    readEncodedU32() {
        let result = this.readUI8();
        if (!(result & 0x80)) return result;
        result = (result & 0x7f) | (this.readUI8() << 7);
        if (!(result & 0x4000)) return result;
        result = (result & 0x3fff) | (this.readUI8() << 14);
        if (!(result & 0x200000)) return result;
        result = (result & 0x1fffff) | (this.readUI8() << 21);
        if (!(result & 0x10000000)) return result;
        result = (result & 0xfffffff) | (this.readUI8() << 28);
        return result >>> 0;
    }

    readBytes(count) {
        this.align();
        const slice = this.#bytes.subarray(this.#byteOffset, this.#byteOffset + count);
        this.#byteOffset += count;
        return slice;
    }

    readString() {
        this.align();
        const start = this.#byteOffset;
        while (this.#bytes[this.#byteOffset] !== 0) this.#byteOffset++;
        const slice = this.#bytes.subarray(start, this.#byteOffset);
        this.#byteOffset++;
        return new TextDecoder("utf-8").decode(slice);
    }
}

export default Reader;
