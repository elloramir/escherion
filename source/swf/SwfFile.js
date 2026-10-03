import Reader from "../core/Reader.js";
import * as Swf from "./index.js";
import * as Tags from "./tags/index.js";

// A fully parsed SWF file: header plus its top-level tag list. Browser-only by
// design: bytes arrive via fetch and the body is inflated with the platform
// DecompressionStream. Used for the root movie and every nested SWF a Loader
// receives over the network.
class SwfFile {

    #header;
    #tags;

    constructor(header, tags) {
        this.#header = header;
        this.#tags = tags;
    }

    get header() {
        return this.#header;
    }

    get tags() {
        return this.#tags;
    }

    // The ABC bytes of the movie's code, or null for a pure-timeline SWF.
    get abcData() {
        return this.#tags.find((tag) => tag.abcData !== undefined)?.abcData ?? null;
    }

    // Every SymbolClass entry: { tagId, name } linking a character to a class.
    get symbols() {
        return this.#tags.filter((tag) => tag instanceof Tags.SymbolClassTag).flatMap((tag) => tag.symbols);
    }

    // The main timeline's class (character id 0), as a dotted name, or null.
    get documentClass() {
        return this.symbols.find((symbol) => symbol.tagId === 0)?.name ?? null;
    }

    // Relative URLs resolve against the document; the dev server proxies
    // /game/* so AQW keeps its original relative asset loads on our origin.
    static async load(url) {
        const response = await fetch(String(url), { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`SwfFile: GET ${url} -> ${response.status} ${response.statusText}`);
        }
        return SwfFile.parse(new Uint8Array(await response.arrayBuffer()), String(url));
    }

    // Parsed SWFs are immutable once built (tags are read-only at runtime), so re-parsing a movie a
    // Loader loads again (e.g. revisiting a map) is wasted work. Cache the last few by URL, or by a
    // hash of the bytes when no URL is known.
    static #cache = new Map();
    static #CACHE_LIMIT = 48;

    static async parse(fileBytes, cacheKey = null) {
        const key = cacheKey ?? SwfFile.#bytesKey(fileBytes);
        const cached = SwfFile.#cache.get(key);
        if (cached !== undefined) return cached;
        const swf = await SwfFile.#parseUncached(fileBytes);
        SwfFile.#cache.set(key, swf);
        if (SwfFile.#cache.size > SwfFile.#CACHE_LIMIT) {
            SwfFile.#cache.delete(SwfFile.#cache.keys().next().value);
        }
        return swf;
    }

    static #bytesKey(bytes) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < bytes.length; index++) {
            hash ^= bytes[index];
            hash = Math.imul(hash, 0x01000193);
        }
        return `${bytes.length}:${(hash >>> 0).toString(16)}`;
    }

    static async #parseUncached(fileBytes) {
        const { compression, version, fileLength, headerSize } = Swf.SwfHeader.readPreamble(fileBytes);
        const bodyBytes = await SwfFile.#decompressBody(fileBytes.subarray(headerSize), compression);
        const reader = new Reader(bodyBytes);
        const header = Swf.SwfHeader.read(reader, compression, version, fileLength);
        const tags = Tags.TagList.read(reader, version);
        return new SwfFile(header, tags);
    }

    static async #decompressBody(compressedTail, compression) {
        if (compression === "none") return compressedTail;
        if (compression === "zlib") {
            const stream = new Blob([compressedTail]).stream().pipeThrough(new DecompressionStream("deflate"));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        }
        throw new Error(`SwfFile: "${compression}" compression is not supported`);
    }
}

export default SwfFile;
