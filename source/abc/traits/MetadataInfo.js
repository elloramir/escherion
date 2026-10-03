class MetadataInfo {

    #nameIndex;
    #items;

    constructor(nameIndex, items) {
        this.#nameIndex = nameIndex;
        this.#items = items;
    }

    get nameIndex() {
        return this.#nameIndex;
    }

    get items() {
        return this.#items;
    }

    static read(reader) {
        const nameIndex = reader.readU30();
        const itemCount = reader.readU30();
        const items = [];
        for (let i = 0; i < itemCount; i++) {
            const keyIndex = reader.readU30();
            const valueIndex = reader.readU30();
            // keyIndex is 0 for a keyless (value-only) entry.
            items.push({ keyIndex, valueIndex });
        }
        return new MetadataInfo(nameIndex, items);
    }
}

export default MetadataInfo;
