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

    get length() {
        return this.#bytes.length;
    }

    set length(value) {
        const next = new Uint8Array(Math.max(0, value | 0));
        next.set(this.#bytes.subarray(0, next.length));
        this.#bytes = next;
    }

    get bytesAvailable() {
        return Math.max(0, this.#bytes.length - this.position);
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
        const count = length || (this.#bytes.length - this.position);
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
        this.#bytes[this.position++] = value & 0xff;
    }

    writeShort(value) {
        this.#ensure(2);
        this.#view.setInt16(this.position, value, this.endian === "littleEndian");
        this.position += 2;
    }

    writeInt(value) {
        this.#ensure(4);
        this.#view.setInt32(this.position, value, this.endian === "littleEndian");
        this.position += 4;
    }

    writeUnsignedInt(value) {
        this.#ensure(4);
        this.#view.setUint32(this.position, value >>> 0, this.endian === "littleEndian");
        this.position += 4;
    }

    writeFloat(value) {
        this.#ensure(4);
        this.#view.setFloat32(this.position, value, this.endian === "littleEndian");
        this.position += 4;
    }

    writeDouble(value) {
        this.#ensure(8);
        this.#view.setFloat64(this.position, value, this.endian === "littleEndian");
        this.position += 8;
    }

    writeBytes(source, offset = 0, length = 0) {
        const data = source instanceof ByteArray ? source.rawBytes : source;
        const count = length || data.length - offset;
        this.#ensure(count);
        this.#bytes.set(data.subarray(offset, offset + count), this.position);
        this.position += count;
    }

    writeUTF(value) {
        const bytes = new TextEncoder().encode(String(value));
        this.writeShort(bytes.length);
        this.writeBytes(bytes);
    }

    writeUTFBytes(value) {
        this.writeBytes(new TextEncoder().encode(String(value)));
    }

    toString() {
        return new TextDecoder().decode(this.#bytes);
    }

    compress() {
        console.warn("flash.utils.ByteArray.compress: not implemented");
    }

    uncompress() {
        console.warn("flash.utils.ByteArray.uncompress: not implemented");
    }

    get rawBytes() {
        return this.#bytes;
    }
}

export default ByteArray;
