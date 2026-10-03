import TraitInfo from "./TraitInfo.js";
import TraitKind from "./TraitKind.js";

class SlotTrait extends TraitInfo {

    #slotId;
    #typeNameIndex;
    #vindex;
    #vkind;

    constructor(nameIndex, attributes, metadataIndices, slotId, typeNameIndex, vindex, vkind) {
        super(nameIndex, TraitKind.SLOT, attributes, metadataIndices);
        this.#slotId = slotId;
        this.#typeNameIndex = typeNameIndex;
        this.#vindex = vindex;
        this.#vkind = vkind;
    }

    get slotId() {
        return this.#slotId;
    }

    get typeNameIndex() {
        return this.#typeNameIndex;
    }

    get vindex() {
        return this.#vindex;
    }

    get vkind() {
        return this.#vkind;
    }

    static readData(reader, nameIndex, attributes) {
        const slotId = reader.readU30();
        const typeNameIndex = reader.readU30();
        const vindex = reader.readU30();
        // vkind is present only when a default value exists.
        const vkind = vindex !== 0 ? reader.readUI8() : null;
        const metadataIndices = TraitInfo.readMetadataIndices(reader, attributes);
        return new SlotTrait(nameIndex, attributes, metadataIndices, slotId, typeNameIndex, vindex, vkind);
    }
}

export default SlotTrait;
