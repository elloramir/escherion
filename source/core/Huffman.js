class Huffman {

    constructor(lengths, maxBits) {
        this.counts = new Array(maxBits + 1).fill(0);
        for (const length of lengths) this.counts[length]++;
        this.counts[0] = 0;
        const offsets = new Array(maxBits + 1).fill(0);
        for (let i = 1; i <= maxBits; i++) offsets[i] = offsets[i - 1] + this.counts[i - 1];
        this.symbols = new Array(lengths.length).fill(0);
        for (let symbol = 0; symbol < lengths.length; symbol++) {
            if (lengths[symbol] !== 0) this.symbols[offsets[lengths[symbol]]++] = symbol;
        }
        this.maxBits = maxBits;
    }

    // Canonical Huffman decode using zlib's puff count/offset method.
    decodeSymbol(reader) {
        let code = 0;
        let first = 0;
        let index = 0;
        for (let length = 1; length <= this.maxBits; length++) {
            code |= reader.bits(1);
            const count = this.counts[length];
            if (code - count < first) return this.symbols[index + (code - first)];
            index += count;
            first += count;
            first <<= 1;
            code <<= 1;
        }
        throw new Error("invalid DEFLATE Huffman code");
    }
}

export default Huffman;
