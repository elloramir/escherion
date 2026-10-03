import TraitInfo from "./TraitInfo.js";
import TraitKind from "./TraitKind.js";

// Kept distinct from MethodTrait/GetterTrait so a setter can never be installed
// where a getter was declared.
class SetterTrait extends TraitInfo {

    #dispId;
    #methodIndex;

    constructor(nameIndex, attributes, metadataIndices, dispId, methodIndex) {
        super(nameIndex, TraitKind.SETTER, attributes, metadataIndices);
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
        return new SetterTrait(nameIndex, attributes, metadataIndices, dispId, methodIndex);
    }
}

export default SetterTrait;
