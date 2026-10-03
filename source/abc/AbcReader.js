import Reader from "../core/Reader.js";

const textDecoder = new TextDecoder("utf-8");

// Byte cursor for the ABC format (AVM2 Overview Chapter 4). Adds ABC's
// primitives: varints, fixed 24/64-bit values, and length-prefixed UTF-8 strings.
class AbcReader extends Reader {

    readU30() {
        return this.readEncodedU32();
    }

    readU32() {
        return this.readEncodedU32();
    }

    // An s32 is a u32 varint reinterpreted as two's complement, with NO sign
    // extension from the last byte's high bit. Extending from bit 6 turned every
    // constant in 64..127 negative (e.g. Chat.lineLimit = 100 became -28), which
    // trimmed away every chat line.
    readS32() {
        return this.readEncodedU32() | 0;
    }

    readS24() {
        const b0 = this.readUI8();
        const b1 = this.readUI8();
        const b2 = this.readUI8();
        const value = b0 | (b1 << 8) | (b2 << 16);
        return value & 0x800000 ? value - 0x1000000 : value;
    }

    readD64() {
        const bytes = this.readBytes(8);
        const buffer = new ArrayBuffer(8);
        new Uint8Array(buffer).set(bytes);
        return new DataView(buffer).getFloat64(0, true);
    }

    readAbcString() {
        const size = this.readU30();
        return textDecoder.decode(this.readBytes(size));
    }

    // ABC strings are length-prefixed, never null-terminated.
    readString() {
        throw new Error("AbcReader: use readAbcString(), ABC strings are not null-terminated");
    }
}

export default AbcReader;
