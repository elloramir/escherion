import EventDispatcher from "../events/EventDispatcher.js";
import Event from "../events/Event.js";
import IOErrorEvent from "../events/IOErrorEvent.js";
import ProgressEvent from "../events/ProgressEvent.js";
import ByteArray from "../utils/ByteArray.js";

// flash.net.Socket. A browser cannot open a raw TCP connection, so a mapped
// `Socket.connect(host, port)` tunnels through a WebSocket bridge: it opens the
// `proxyUrl` from the host's `socketProxy` config (passing the target host/port)
// and carries the byte stream over it. A movie reaches this class through
// `domain.bind(Socket)`, which supplies `static domain`.
class Socket extends EventDispatcher {

    static domain = null;

    #socket = null;
    #read = new ByteArray();
    #write = new ByteArray();

    constructor(host = null, port = 0) {
        super();
        this.connected = false;
        this.timeout = 0;
        this.endian = "bigEndian";
        this.objectEncoding = 3;
        if (host !== null && host !== undefined) this.connect(host, port);
    }

    get bytesAvailable() {
        return this.#read.bytesAvailable;
    }

    // Opens the bridge mapped to `host:port` (or reports an ioError when unmapped).
    connect(host, port) {
        const mapping = this.constructor.domain?.host?.socketProxyFor?.(host, port) ?? null;
        if (typeof WebSocket === "undefined" || !mapping) {
            const reason = mapping
                ? "WebSocket is not available in this environment"
                : `no socketProxy mapping for ${host}:${port}`;
            console.warn(`flash.net.Socket.connect: ${reason}`);
            const event = new IOErrorEvent(IOErrorEvent.IO_ERROR);
            event.text = reason;
            this.dispatchEvent(event);
            return;
        }
        const url = new URL(mapping.proxyUrl);
        url.searchParams.set("host", String(host));
        url.searchParams.set("port", String(port));
        const socket = new WebSocket(url.href);
        socket.binaryType = "arraybuffer";
        this.#socket = socket;

        socket.onopen = () => {
            this.connected = true;
            this.dispatchEvent(new Event(Event.CONNECT));
        };
        socket.onmessage = (message) => {
            const data = message.data;
            const chunk = data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
            Socket.#append(this.#read, chunk);
            this.dispatchEvent(new ProgressEvent(ProgressEvent.SOCKET_DATA, false, false, chunk.length, chunk.length));
        };
        socket.onclose = () => {
            this.connected = false;
            this.dispatchEvent(new Event(Event.CLOSE));
        };
        socket.onerror = () => {
            const event = new IOErrorEvent(IOErrorEvent.IO_ERROR);
            event.text = `socket error ${host}:${port}`;
            this.dispatchEvent(event);
        };
    }

    close() {
        this.connected = false;
        this.#socket?.close();
        this.#socket = null;
    }

    // Sends the buffered writes as one binary frame.
    flush() {
        const length = this.#write.length;
        if (length > 0 && typeof WebSocket !== "undefined" && this.#socket?.readyState === WebSocket.OPEN) {
            this.#socket.send(new Uint8Array(this.#write.rawBytes.subarray(0, length)));
        }
        this.#write = new ByteArray();
    }

    writeBytes(bytes, offset = 0, length = 0) {
        this.#write.writeBytes(bytes, offset, length);
    }

    writeByte(value) {
        this.#write.writeByte(value);
    }

    writeUTF(text) {
        this.#write.writeUTF(text);
    }

    writeUTFBytes(text) {
        this.#write.writeUTFBytes(text);
    }

    readBytes(bytes, offset = 0, length = 0) {
        this.#read.readBytes(bytes, offset, length);
    }

    readByte() {
        return this.#read.readByte();
    }

    readUTFBytes(length) {
        return this.#read.readUTFBytes(length);
    }

    get bytes() {
        return this.#read;
    }

    // Appends `chunk` to the end of a read buffer without moving its read cursor.
    static #append(buffer, chunk) {
        const position = buffer.position;
        buffer.position = buffer.length;
        buffer.writeBytes(chunk);
        buffer.position = position;
    }
}

export default Socket;
