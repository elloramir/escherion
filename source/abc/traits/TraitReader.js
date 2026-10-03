import TraitKind from "./TraitKind.js";
import SlotTrait from "./SlotTrait.js";
import ConstTrait from "./ConstTrait.js";
import MethodTrait from "./MethodTrait.js";
import GetterTrait from "./GetterTrait.js";
import SetterTrait from "./SetterTrait.js";
import ClassTrait from "./ClassTrait.js";
import FunctionTrait from "./FunctionTrait.js";

const TRAIT_CLASSES_BY_KIND = {
    [TraitKind.SLOT]: SlotTrait,
    [TraitKind.METHOD]: MethodTrait,
    [TraitKind.GETTER]: GetterTrait,
    [TraitKind.SETTER]: SetterTrait,
    [TraitKind.CLASS]: ClassTrait,
    [TraitKind.FUNCTION]: FunctionTrait,
    [TraitKind.CONST]: ConstTrait
};

// Reads a traits_info entry and dispatches to its kind-specific class.
class TraitReader {

    static read(reader) {
        const nameIndex = reader.readU30();
        const kindByte = reader.readUI8();
        const kind = kindByte & 0x0f;
        const attributes = (kindByte >> 4) & 0x0f;
        const TraitClass = TRAIT_CLASSES_BY_KIND[kind];
        if (!TraitClass) {
            throw new Error(`TraitReader: unknown trait kind ${kind}`);
        }
        return TraitClass.readData(reader, nameIndex, attributes);
    }

    static readArray(reader) {
        const count = reader.readU30();
        const traits = [];
        for (let i = 0; i < count; i++) {
            traits.push(TraitReader.read(reader));
        }
        return traits;
    }
}

export default TraitReader;
