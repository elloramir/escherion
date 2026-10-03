import OptionDetail from "./OptionDetail.js";

const NEED_ARGUMENTS = 0x01;
const NEED_ACTIVATION = 0x02;
const NEED_REST = 0x04;
const HAS_OPTIONAL = 0x08;
const SET_DXNS = 0x40;
const HAS_PARAM_NAMES = 0x80;

// method_info: a method signature. The code lives in a MethodBody referencing
// this entry by index.
class MethodInfo {

    #paramTypeIndices;
    #returnTypeIndex;
    #nameIndex;
    #needsArguments;
    #needsActivation;
    #needsRest;
    #setsDxns;
    #options;
    #paramNameIndices;

    constructor(
        paramTypeIndices, returnTypeIndex, nameIndex, needsArguments, needsActivation,
        needsRest, setsDxns, options, paramNameIndices
    ) {
        this.#paramTypeIndices = paramTypeIndices;
        this.#returnTypeIndex = returnTypeIndex;
        this.#nameIndex = nameIndex;
        this.#needsArguments = needsArguments;
        this.#needsActivation = needsActivation;
        this.#needsRest = needsRest;
        this.#setsDxns = setsDxns;
        this.#options = options;
        this.#paramNameIndices = paramNameIndices;
    }

    get paramTypeIndices() {
        return this.#paramTypeIndices;
    }

    get returnTypeIndex() {
        return this.#returnTypeIndex;
    }

    get nameIndex() {
        return this.#nameIndex;
    }

    get needsArguments() {
        return this.#needsArguments;
    }

    get needsActivation() {
        return this.#needsActivation;
    }

    get needsRest() {
        return this.#needsRest;
    }

    get setsDxns() {
        return this.#setsDxns;
    }

    get options() {
        return this.#options;
    }

    get paramNameIndices() {
        return this.#paramNameIndices;
    }

    static read(reader) {
        const paramCount = reader.readU30();
        const returnTypeIndex = reader.readU30();
        const paramTypeIndices = [];
        for (let i = 0; i < paramCount; i++) {
            paramTypeIndices.push(reader.readU30());
        }
        const nameIndex = reader.readU30();
        const flags = reader.readUI8();
        let options = null;
        if (flags & HAS_OPTIONAL) {
            const optionCount = reader.readU30();
            options = [];
            for (let i = 0; i < optionCount; i++) {
                options.push(OptionDetail.read(reader));
            }
        }
        let paramNameIndices = null;
        if (flags & HAS_PARAM_NAMES) {
            paramNameIndices = [];
            for (let i = 0; i < paramCount; i++) {
                paramNameIndices.push(reader.readU30());
            }
        }
        return new MethodInfo(
            paramTypeIndices, returnTypeIndex, nameIndex,
            Boolean(flags & NEED_ARGUMENTS), Boolean(flags & NEED_ACTIVATION),
            Boolean(flags & NEED_REST), Boolean(flags & SET_DXNS),
            options, paramNameIndices
        );
    }
}

export default MethodInfo;
