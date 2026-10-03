import * as Traits from "../traits/index.js";

class ScriptInfo {

    #initIndex;
    #traits;

    constructor(initIndex, traits) {
        this.#initIndex = initIndex;
        this.#traits = traits;
    }

    get initIndex() {
        return this.#initIndex;
    }

    get traits() {
        return this.#traits;
    }

    static read(reader) {
        const initIndex = reader.readU30();
        const traits = Traits.TraitReader.readArray(reader);
        return new ScriptInfo(initIndex, traits);
    }
}

export default ScriptInfo;
