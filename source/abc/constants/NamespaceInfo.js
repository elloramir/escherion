class NamespaceInfo {

    #kind;
    #nameIndex;

    constructor(kind, nameIndex) {
        this.#kind = kind;
        this.#nameIndex = nameIndex;
    }

    get kind() {
        return this.#kind;
    }

    get nameIndex() {
        return this.#nameIndex;
    }

    static read(reader) {
        const kind = reader.readUI8();
        const nameIndex = reader.readU30();
        return new NamespaceInfo(kind, nameIndex);
    }
}

export default NamespaceInfo;
