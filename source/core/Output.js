class Output {

    constructor() {
        this.bytes = new Uint8Array(1024);
        this.length = 0;
    }

    push(value) {
        if (this.length === this.bytes.length) {
            const grown = new Uint8Array(this.bytes.length * 2);
            grown.set(this.bytes, 0);
            this.bytes = grown;
        }
        this.bytes[this.length++] = value;
    }

    copy(distance, count) {
        let from = this.length - distance;
        for (let i = 0; i < count; i++) this.push(this.bytes[from++]);
    }

    toUint8Array() {
        return this.bytes.slice(0, this.length);
    }
}

export default Output;
