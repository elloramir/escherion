import TraitInfo from "./TraitInfo.js";
import TraitKind from "./TraitKind.js";

class FunctionTrait extends TraitInfo {

    #slotId;
    #methodIndex;

    constructor(nameIndex, attributes, metadataIndices, slotId, methodIndex) {
        super(nameIndex, TraitKind.FUNCTION, attributes, metadataIndices);
        this.#slotId = slotId;
        this.#methodIndex = methodIndex;
    }

    get slotId() {
        return this.#slotId;
    }

    get methodIndex() {
        return this.#methodIndex;
    }

    static readData(reader, nameIndex, attributes) {
        const slotId = reader.readU30();
        const methodIndex = reader.readU30();
        const metadataIndices = TraitInfo.readMetadataIndices(reader, attributes);
        return new FunctionTrait(nameIndex, attributes, metadataIndices, slotId, methodIndex);
    }
}

export default FunctionTrait;
