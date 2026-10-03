import * as Traits from "../traits/index.js";

const CLASS_SEALED = 0x01;
const CLASS_FINAL = 0x02;
const CLASS_INTERFACE = 0x04;
const CLASS_PROTECTED_NS = 0x08;

// instance_info: superclass, interfaces, constructor and instance traits of a
// class. Paired by index with the ClassInfo holding its static side.
class InstanceInfo {

    #nameIndex;
    #superNameIndex;
    #isSealed;
    #isFinal;
    #isInterface;
    #protectedNsIndex;
    #interfaceIndices;
    #iinitIndex;
    #traits;

    constructor(
        nameIndex, superNameIndex, isSealed, isFinal, isInterface,
        protectedNsIndex, interfaceIndices, iinitIndex, traits
    ) {
        this.#nameIndex = nameIndex;
        this.#superNameIndex = superNameIndex;
        this.#isSealed = isSealed;
        this.#isFinal = isFinal;
        this.#isInterface = isInterface;
        this.#protectedNsIndex = protectedNsIndex;
        this.#interfaceIndices = interfaceIndices;
        this.#iinitIndex = iinitIndex;
        this.#traits = traits;
    }

    get nameIndex() {
        return this.#nameIndex;
    }

    get superNameIndex() {
        return this.#superNameIndex;
    }

    get isSealed() {
        return this.#isSealed;
    }

    get isFinal() {
        return this.#isFinal;
    }

    get isInterface() {
        return this.#isInterface;
    }

    get protectedNsIndex() {
        return this.#protectedNsIndex;
    }

    get interfaceIndices() {
        return this.#interfaceIndices;
    }

    get iinitIndex() {
        return this.#iinitIndex;
    }

    get traits() {
        return this.#traits;
    }

    static read(reader) {
        const nameIndex = reader.readU30();
        const superNameIndex = reader.readU30();
        const flags = reader.readUI8();
        const protectedNsIndex = flags & CLASS_PROTECTED_NS ? reader.readU30() : null;
        const interfaceCount = reader.readU30();
        const interfaceIndices = [];
        for (let i = 0; i < interfaceCount; i++) {
            interfaceIndices.push(reader.readU30());
        }
        const iinitIndex = reader.readU30();
        const traits = Traits.TraitReader.readArray(reader);
        return new InstanceInfo(
            nameIndex, superNameIndex, Boolean(flags & CLASS_SEALED), Boolean(flags & CLASS_FINAL),
            Boolean(flags & CLASS_INTERFACE), protectedNsIndex, interfaceIndices, iinitIndex, traits
        );
    }
}

export default InstanceInfo;
