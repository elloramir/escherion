import TraitAttributes from "./TraitAttributes.js";

// Shared trait header (name, kind, attributes, metadata). Kind-specific data
// lives in a subclass, dispatched by TraitReader.
class TraitInfo {

    #nameIndex;
    #kind;
    #attributes;
    #metadataIndices;

    constructor(nameIndex, kind, attributes, metadataIndices) {
        this.#nameIndex = nameIndex;
        this.#kind = kind;
        this.#attributes = attributes;
        this.#metadataIndices = metadataIndices;
    }

    get nameIndex() {
        return this.#nameIndex;
    }

    get kind() {
        return this.#kind;
    }

    get attributes() {
        return this.#attributes;
    }

    get metadataIndices() {
        return this.#metadataIndices;
    }

    get isFinal() {
        return Boolean(this.#attributes & TraitAttributes.FINAL);
    }

    get isOverride() {
        return Boolean(this.#attributes & TraitAttributes.OVERRIDE);
    }

    // metadata_count/metadata tail, present only when METADATA is set.
    static readMetadataIndices(reader, attributes) {
        if (!(attributes & TraitAttributes.METADATA)) return [];
        const count = reader.readU30();
        const metadataIndices = [];
        for (let i = 0; i < count; i++) {
            metadataIndices.push(reader.readU30());
        }
        return metadataIndices;
    }
}

export default TraitInfo;
