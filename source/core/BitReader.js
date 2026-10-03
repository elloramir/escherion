class BitReader {

    constructor(input) {
        this.input = input;
        this.bytePos = 0;
        this.bitBuffer = 0;
        this.bitCount = 0;
    }

    bits(count) {
        let value = 0;
        for (let i = 0; i < count; i++) {
            if (this.bitCount === 0) {
                this.bitBuffer = this.input[this.bytePos++] ?? 0;
                this.bitCount = 8;
            }
            value |= (this.bitBuffer & 1) << i;
            this.bitBuffer >>= 1;
            this.bitCount--;
        }
        return value;
    }

    align() {
        this.bitBuffer = 0;
        this.bitCount = 0;
    }
}

export default BitReader;
