// flash.utils.ByteArray — a functional subset over a Uint8Array. compress/uncompress are honest skips (they need a sync
// inflater, which the browser does not expose).
class ByteArray {

    constructor() {
        this.endian = "bigEndian";
        this.objectEncoding = 3;
        this.position = 0;
        this.#bytes = new Uint8Array(0);
    }

    #bytes;
    // The logical length (bytes written), distinct from the Uint8Array capacity.
    #length = 0;

    get length() {
        return this.#length;
    }

    set length(value) {
        const next = Math.max(0, value | 0);
        if (next > this.#bytes.length) this.#ensure(next - this.position);
        this.#length = next;
    }

    get bytesAvailable() {
        return Math.max(0, this.#length - this.position);
    }

    #advance(count) {
        this.position += count;
        if (this.position > this.#length) this.#length = this.position;
    }

    get #view() {
        return new DataView(this.#bytes.buffer, this.#bytes.byteOffset, this.#bytes.byteLength);
    }

    #ensure(extra) {
        if (this.position + extra <= this.#bytes.length) return;
        const next = new Uint8Array(Math.max(this.position + extra, (this.#bytes.length * 2) || 16));
        next.set(this.#bytes);
        this.#bytes = next;
    }

    clear() {
        this.#bytes = new Uint8Array(0);
        this.position = 0;
        this.#length = 0;
    }

    readBoolean() {
        return this.readByte() !== 0;
    }

    readByte() {
        return (this.readUnsignedByte() << 24) >> 24;
    }

    readUnsignedByte() {
        return this.#bytes[this.position++];
    }

    readShort() {
        const value = this.readUnsignedShort();
        return value & 0x8000 ? value - 0x10000 : value;
    }

    readUnsignedShort() {
        const little = this.endian === "littleEndian";
        const value = this.#view.getUint16(this.position, little);
        this.position += 2;
        return value;
    }

    readInt() {
        const little = this.endian === "littleEndian";
        const value = this.#view.getInt32(this.position, little);
        this.position += 4;
        return value;
    }

    readUnsignedInt() {
        const little = this.endian === "littleEndian";
        const value = this.#view.getUint32(this.position, little);
        this.position += 4;
        return value;
    }

    readFloat() {
        const little = this.endian === "littleEndian";
        const value = this.#view.getFloat32(this.position, little);
        this.position += 4;
        return value;
    }

    readDouble() {
        const little = this.endian === "littleEndian";
        const value = this.#view.getFloat64(this.position, little);
        this.position += 8;
        return value;
    }

    readBytes(target, offset = 0, length = 0) {
        const count = length || (this.#length - this.position);
        const slice = this.#bytes.subarray(this.position, this.position + count);
        this.position += count;
        target.writeBytes(slice, offset, count);
    }

    readUTF() {
        const length = this.readUnsignedShort();
        return this.readUTFBytes(length);
    }

    readUTFBytes(length) {
        const slice = this.#bytes.subarray(this.position, this.position + length);
        this.position += length;
        return new TextDecoder().decode(slice);
    }

    writeBoolean(value) {
        this.writeByte(value ? 1 : 0);
    }

    writeByte(value) {
        this.#ensure(1);
        this.#bytes[this.position] = value & 0xff;
        this.#advance(1);
    }

    writeShort(value) {
        this.#ensure(2);
        this.#view.setInt16(this.position, value, this.endian === "littleEndian");
        this.#advance(2);
    }

    writeInt(value) {
        this.#ensure(4);
        this.#view.setInt32(this.position, value, this.endian === "littleEndian");
        this.#advance(4);
    }

    writeUnsignedInt(value) {
        this.#ensure(4);
        this.#view.setUint32(this.position, value >>> 0, this.endian === "littleEndian");
        this.#advance(4);
    }

    writeFloat(value) {
        this.#ensure(4);
        this.#view.setFloat32(this.position, value, this.endian === "littleEndian");
        this.#advance(4);
    }

    writeDouble(value) {
        this.#ensure(8);
        this.#view.setFloat64(this.position, value, this.endian === "littleEndian");
        this.#advance(8);
    }

    writeBytes(source, offset = 0, length = 0) {
        const data = source instanceof ByteArray ? source.rawBytes : source;
        const count = length || data.length - offset;
        this.#ensure(count);
        this.#bytes.set(data.subarray(offset, offset + count), this.position);
        this.#advance(count);
    }

    writeUTF(value) {
        const bytes = new TextEncoder().encode(String(value));
        this.writeShort(bytes.length);
        this.writeBytes(bytes);
    }

    writeUTFBytes(value) {
        this.writeBytes(new TextEncoder().encode(String(value)));
    }

    // AMF3 round-trip for the only use the game makes of it: deep-copying plain
    // data (`copyObj`). The bytes are a length-prefixed JSON document, so any
    // value JSON survives a writeObject/readObject pair intact.
    writeObject(value) {
        const bytes = new TextEncoder().encode(JSON.stringify(value === undefined ? null : value));
        this.writeInt(bytes.length);
        this.writeBytes(bytes);
    }

    readObject() {
        const length = this.readInt();
        const json = new TextDecoder().decode(this.#bytes.subarray(this.position, this.position + length));
        this.position += length;
        if (this.position > this.#length) this.#length = this.position;
        return JSON.parse(json);
    }

    toString() {
        return new TextDecoder().decode(this.#bytes.subarray(0, this.#length));
    }

    compress() {
        console.warn("flash.utils.ByteArray.compress: not implemented");
    }

    uncompress() {
        console.warn("flash.utils.ByteArray.uncompress: not implemented");
    }

    get rawBytes() {
        return this.#bytes.subarray(0, this.#length);
    }
}

export default ByteArray;
