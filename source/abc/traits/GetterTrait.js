import TraitInfo from "./TraitInfo.js";
import TraitKind from "./TraitKind.js";

// Kept distinct from MethodTrait/SetterTrait so a getter can never be installed
// where a setter was declared.
class GetterTrait extends TraitInfo {

    #dispId;
    #methodIndex;

    constructor(nameIndex, attributes, metadataIndices, dispId, methodIndex) {
        super(nameIndex, TraitKind.GETTER, attributes, metadataIndices);
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
        return new GetterTrait(nameIndex, attributes, metadataIndices, dispId, methodIndex);
    }
}

export default GetterTrait;
