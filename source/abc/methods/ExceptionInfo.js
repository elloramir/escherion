// Exception handler code range and target, per AVM2 Overview 4.12. from/to/target
// are raw byte offsets into the owning method body's code array; the runtime
// resolves them to instruction indices.
class ExceptionInfo {

    #from;
    #to;
    #target;
    #excTypeIndex;
    #varNameIndex;

    constructor(from, to, target, excTypeIndex, varNameIndex) {
        this.#from = from;
        this.#to = to;
        this.#target = target;
        this.#excTypeIndex = excTypeIndex;
        this.#varNameIndex = varNameIndex;
    }

    get from() {
        return this.#from;
    }

    get to() {
        return this.#to;
    }

    get target() {
        return this.#target;
    }

    get excTypeIndex() {
        return this.#excTypeIndex;
    }

    get varNameIndex() {
        return this.#varNameIndex;
    }

    static read(reader) {
        const from = reader.readU30();
        const to = reader.readU30();
        const target = reader.readU30();
        const excTypeIndex = reader.readU30();
        const varNameIndex = reader.readU30();
        return new ExceptionInfo(from, to, target, excTypeIndex, varNameIndex);
    }
}

export default ExceptionInfo;
