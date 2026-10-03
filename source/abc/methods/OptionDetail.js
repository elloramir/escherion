class OptionDetail {

    #val;
    #kind;

    constructor(val, kind) {
        this.#val = val;
        this.#kind = kind;
    }

    get val() {
        return this.#val;
    }

    get kind() {
        return this.#kind;
    }

    static read(reader) {
        const val = reader.readU30();
        const kind = reader.readUI8();
        return new OptionDetail(val, kind);
    }
}

export default OptionDetail;
