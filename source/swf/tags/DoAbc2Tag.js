const LAZY_INITIALIZE_FLAG = 1;

// DoABC tag (code 82, commonly called DoABC2): a named block of ActionScript 3.0
// bytecode for the AVM2 virtual machine. The bytecode itself (the ABC file
// format) is a separate specification and is kept here as an opaque byte block.
class DoAbc2Tag {

    #lazyInitialize;
    #name;
    #abcData;

    constructor(lazyInitialize, name, abcData) {
        this.#lazyInitialize = lazyInitialize;
        this.#name = name;
        this.#abcData = abcData;
    }

    get lazyInitialize() {
        return this.#lazyInitialize;
    }

    get name() {
        return this.#name;
    }

    get abcData() {
        return this.#abcData;
    }

    static read(reader, length, bodyStart) {
        const flags = reader.readUI32();
        const name = reader.readString();
        const remaining = length - (reader.position - bodyStart);
        const abcData = reader.readBytes(remaining);
        return new DoAbc2Tag(Boolean(flags & LAZY_INITIALIZE_FLAG), name, abcData);
    }
}

export default DoAbc2Tag;
