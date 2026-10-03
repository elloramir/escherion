import ExceptionInfo from "./ExceptionInfo.js";
import * as Traits from "../traits/index.js";
import CodeReader from "../code/CodeReader.js";

// method_body_info, per AVM2 Overview 4.11. code holds raw instruction bytes;
// instructions decodes them lazily into a flat, offset-addressed list (no CFG).
class MethodBody {

    #methodIndex;
    #maxStack;
    #localCount;
    #initScopeDepth;
    #maxScopeDepth;
    #code;
    // Exception handlers resolved to instruction indices by the interpreter (cached).
    indexedHandlers = undefined;

    #exceptions;
    #traits;
    #instructions;
    #offsetToIndex;

    constructor(methodIndex, maxStack, localCount, initScopeDepth, maxScopeDepth, code, exceptions, traits) {
        this.#methodIndex = methodIndex;
        this.#maxStack = maxStack;
        this.#localCount = localCount;
        this.#initScopeDepth = initScopeDepth;
        this.#maxScopeDepth = maxScopeDepth;
        this.#code = code;
        this.#exceptions = exceptions;
        this.#traits = traits;
        this.#instructions = null;
        this.#offsetToIndex = null;
    }

    get methodIndex() {
        return this.#methodIndex;
    }

    get maxStack() {
        return this.#maxStack;
    }

    get localCount() {
        return this.#localCount;
    }

    get initScopeDepth() {
        return this.#initScopeDepth;
    }

    get maxScopeDepth() {
        return this.#maxScopeDepth;
    }

    get code() {
        return this.#code;
    }

    get exceptions() {
        return this.#exceptions;
    }

    get traits() {
        return this.#traits;
    }

    // Decoded once, on first access.
    get instructions() {
        this.#decodeIfNeeded();
        return this.#instructions;
    }

    // Returns undefined when byteOffset does not land on an instruction boundary.
    indexOfOffset(byteOffset) {
        this.#decodeIfNeeded();
        return this.#offsetToIndex.get(byteOffset);
    }

    #decodeIfNeeded() {
        if (this.#instructions !== null) return;
        const { instructions, offsetToIndex } = CodeReader.decode(this.#code);
        this.#instructions = instructions;
        this.#offsetToIndex = offsetToIndex;
    }

    static read(reader) {
        const methodIndex = reader.readU30();
        const maxStack = reader.readU30();
        const localCount = reader.readU30();
        const initScopeDepth = reader.readU30();
        const maxScopeDepth = reader.readU30();
        const codeLength = reader.readU30();
        const code = reader.readBytes(codeLength);
        const exceptionCount = reader.readU30();
        const exceptions = [];
        for (let i = 0; i < exceptionCount; i++) {
            exceptions.push(ExceptionInfo.read(reader));
        }
        const traits = Traits.TraitReader.readArray(reader);
        return new MethodBody(
            methodIndex, maxStack, localCount, initScopeDepth,
            maxScopeDepth, code, exceptions, traits
        );
    }
}

export default MethodBody;
