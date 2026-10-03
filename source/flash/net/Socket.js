import EventDispatcher from "../events/EventDispatcher.js";
import ByteArray from "../utils/ByteArray.js";

// flash.net.Socket — the TCP socket bridge is not implemented yet, so connect
// warns and dispatches an ioError.
class Socket extends EventDispatcher {

    constructor(host = null, port = 0) {
        super();
        this.connected = false;
        this.timeout = 0;
        this.bytesAvailable = 0;
        this.endian = "bigEndian";
        this.objectEncoding = 3;
        void host;
        void port;
    }

    connect(host, port) {
        void host;
        void port;
        console.warn("flash.net.Socket.connect: no socket bridge");
    }

    close() {
        this.connected = false;
    }

    flush() {
        console.warn("flash.net.Socket.flush: no socket bridge");
    }

    writeBytes(bytes, offset = 0, length = 0) {
        void bytes;
        void offset;
        void length;
    }

    writeUTFBytes(text) {
        void text;
    }

    writeByte(value) {
        void value;
    }

    writeUTF(text) {
        void text;
    }

    readBytes() {}

    readUTFBytes() {
        return "";
    }

    readByte() {
        return 0;
    }

    get bytes() {
        return new ByteArray();
    }
}

export default Socket;
