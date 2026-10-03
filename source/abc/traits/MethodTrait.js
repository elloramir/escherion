import TraitInfo from "./TraitInfo.js";
import TraitKind from "./TraitKind.js";

class MethodTrait extends TraitInfo {

    #dispId;
    #methodIndex;

    constructor(nameIndex, attributes, metadataIndices, dispId, methodIndex) {
        super(nameIndex, TraitKind.METHOD, attributes, metadataIndices);
        this.#dispId = dispId;
        this.#methodIndex = methodIndex;
    }

    get dispId() {
        return this.#dispId;
    }

    get methodIndex() {
        return this.#methodIndex;
    }

    static readData(reader, nameIndex, attributes) {
        const dispId = reader.readU30();
        const methodIndex = reader.readU30();
        const metadataIndices = TraitInfo.readMetadataIndices(reader, attributes);
        return new MethodTrait(nameIndex, attributes, metadataIndices, dispId, methodIndex);
    }
}

export default MethodTrait;
