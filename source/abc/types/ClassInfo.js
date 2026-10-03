import * as Traits from "../traits/index.js";

class ClassInfo {

    #cinitIndex;
    #traits;

    constructor(cinitIndex, traits) {
        this.#cinitIndex = cinitIndex;
        this.#traits = traits;
    }

    get cinitIndex() {
        return this.#cinitIndex;
    }

    get traits() {
        return this.#traits;
    }

    static read(reader) {
        const cinitIndex = reader.readU30();
        const traits = Traits.TraitReader.readArray(reader);
        return new ClassInfo(cinitIndex, traits);
    }
}

export default ClassInfo;
