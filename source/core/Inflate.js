import Huffman from "./Huffman.js";
import BitReader from "./BitReader.js";
import Output from "./Output.js";

// DEFLATE (RFC 1951) inflater, used for lossless bitmaps.
const LENGTH_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
    67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4,
    5, 5, 5, 5, 0,
];
const DIST_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
    1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13,
];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

class Inflate {

    static #fixed = null;

    static inflateRaw(input) {
        const reader = new BitReader(input);
        const output = new Output();
        let final = 0;
        do {
            final = reader.bits(1);
            const type = reader.bits(2);
            if (type === 0) {
                reader.align();
                const length = input[reader.bytePos] | (input[reader.bytePos + 1] << 8);
                reader.bytePos += 4;
                for (let i = 0; i < length; i++) output.push(input[reader.bytePos++]);
            } else if (type === 1) {
                if (!Inflate.#fixed) Inflate.#fixed = Inflate.#fixedTables();
                Inflate.#inflateBlock(reader, output, Inflate.#fixed.literal, Inflate.#fixed.distance);
            } else if (type === 2) {
                const tables = Inflate.#dynamicTables(reader);
                Inflate.#inflateBlock(reader, output, tables.literal, tables.distance);
            } else {
                throw new Error("invalid DEFLATE block type");
            }
        } while (!final);
        return output.toUint8Array();
    }

    static #inflateBlock(reader, output, literal, distance) {
        while (true) {
            const symbol = literal.decodeSymbol(reader);
            if (symbol === 256) return;
            if (symbol < 256) {
                output.push(symbol);
                continue;
            }
            const lengthIndex = symbol - 257;
            if (lengthIndex >= LENGTH_BASE.length) throw new Error("invalid DEFLATE length code");
            const length = LENGTH_BASE[lengthIndex] + reader.bits(LENGTH_EXTRA[lengthIndex]);
            const distanceSymbol = distance.decodeSymbol(reader);
            if (distanceSymbol >= DIST_BASE.length) throw new Error("invalid DEFLATE distance code");
            const back = DIST_BASE[distanceSymbol] + reader.bits(DIST_EXTRA[distanceSymbol]);
            output.copy(back, length);
        }
    }

    // Fixed literal/length and distance tables (RFC 1951 3.2.6), built once.
    static #fixedTables() {
        const literalLengths = new Array(288);
        for (let i = 0; i < 144; i++) literalLengths[i] = 8;
        for (let i = 144; i < 256; i++) literalLengths[i] = 9;
        for (let i = 256; i < 280; i++) literalLengths[i] = 7;
        for (let i = 280; i < 288; i++) literalLengths[i] = 8;
        const distanceLengths = new Array(30).fill(5);
        return {
            literal: new Huffman(literalLengths, 15),
            distance: new Huffman(distanceLengths, 15),
        };
    }

    // Reads the dynamic-Huffman header (RFC 1951 3.2.7) and builds its tables.
    static #dynamicTables(reader) {
        const hlit = reader.bits(5) + 257;
        const hdist = reader.bits(5) + 1;
        const hclen = reader.bits(4) + 4;

        const codeLengths = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) codeLengths[CODE_LENGTH_ORDER[i]] = reader.bits(3);
        const codeLengthTable = new Huffman(codeLengths, 7);

        const lengths = new Array(hlit + hdist).fill(0);
        let index = 0;
        while (index < lengths.length) {
            const symbol = codeLengthTable.decodeSymbol(reader);
            if (symbol < 16) {
                lengths[index++] = symbol;
            } else if (symbol === 16) {
                const previous = lengths[index - 1];
                const repeat = reader.bits(2) + 3;
                for (let i = 0; i < repeat; i++) lengths[index++] = previous;
            } else if (symbol === 17) {
                const repeat = reader.bits(3) + 3;
                for (let i = 0; i < repeat; i++) lengths[index++] = 0;
            } else {
                const repeat = reader.bits(7) + 11;
                for (let i = 0; i < repeat; i++) lengths[index++] = 0;
            }
        }

        return {
            literal: new Huffman(lengths.slice(0, hlit), 15),
            distance: new Huffman(lengths.slice(hlit), 15),
        };
    }

    static zlibUncompress(bytes) {
        if (bytes.length < 2 || (bytes[0] & 0x0f) !== 8) {
            throw new Error("invalid zlib header");
        }
        return Inflate.inflateRaw(bytes.subarray(2));
    }
}

export default Inflate;
