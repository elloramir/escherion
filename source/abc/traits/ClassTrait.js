import TraitInfo from "./TraitInfo.js";
import TraitKind from "./TraitKind.js";

class ClassTrait extends TraitInfo {

    #slotId;
    #classIndex;

    constructor(nameIndex, attributes, metadataIndices, slotId, classIndex) {
        super(nameIndex, TraitKind.CLASS, attributes, metadataIndices);
        this.#slotId = slotId;
        this.#classIndex = classIndex;
    }

    get slotId() {
        return this.#slotId;
    }

    get classIndex() {
        return this.#classIndex;
    }

    static readData(reader, nameIndex, attributes) {
        const slotId = reader.readU30();
        const classIndex = reader.readU30();
        const metadataIndices = TraitInfo.readMetadataIndices(reader, attributes);
        return new ClassTrait(nameIndex, attributes, metadataIndices, slotId, classIndex);
    }
}

export default ClassTrait;
