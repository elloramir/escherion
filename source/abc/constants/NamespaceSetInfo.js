class NamespaceSetInfo {

    #namespaceIndices;

    constructor(namespaceIndices) {
        this.#namespaceIndices = namespaceIndices;
    }

    get namespaceIndices() {
        return this.#namespaceIndices;
    }

    static read(reader) {
        const count = reader.readU30();
        const namespaceIndices = [];
        for (let i = 0; i < count; i++) {
            namespaceIndices.push(reader.readU30());
        }
        return new NamespaceSetInfo(namespaceIndices);
    }
}

export default NamespaceSetInfo;
