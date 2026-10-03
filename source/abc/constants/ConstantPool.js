import NamespaceInfo from "./NamespaceInfo.js";
import NamespaceSetInfo from "./NamespaceSetInfo.js";
import Multiname from "./Multiname.js";
import ConstantKind from "./ConstantKind.js";

// cpool_info, per AVM2 Overview 4.3. Every array is 1-based; index 0 is never
// stored and carries a fixed default (0, NaN, "", or "any") returned directly.
class ConstantPool {

    #integers;
    #uintegers;
    #doubles;
    #strings;
    #namespaces;
    #namespaceSets;
    #multinames;

    constructor(integers, uintegers, doubles, strings, namespaces, namespaceSets, multinames) {
        this.#integers = integers;
        this.#uintegers = uintegers;
        this.#doubles = doubles;
        this.#strings = strings;
        this.#namespaces = namespaces;
        this.#namespaceSets = namespaceSets;
        this.#multinames = multinames;
    }

    // The value of a constant reference (trait default or optional-parameter default).
    valueAt(index, kind) {
        if (!index || kind === null || kind === undefined) return undefined;
        switch (kind) {
            case ConstantKind.UTF8: return this.stringAt(index);
            case ConstantKind.INT: return this.intAt(index);
            case ConstantKind.U_INT: return this.uintAt(index);
            case ConstantKind.DOUBLE: return this.doubleAt(index);
            case ConstantKind.TRUE: return true;
            case ConstantKind.FALSE: return false;
            case ConstantKind.NULL: return null;
            default: return undefined;
        }
    }

    intAt(index) {
        return this.#integers[index];
    }

    uintAt(index) {
        return this.#uintegers[index];
    }

    doubleAt(index) {
        return this.#doubles[index];
    }

    stringAt(index) {
        return this.#strings[index];
    }

    namespaceAt(index) {
        return this.#namespaces[index];
    }

    namespaceSetAt(index) {
        return this.#namespaceSets[index];
    }

    multinameAt(index) {
        return this.#multinames[index];
    }

    static read(reader) {
        const integers = ConstantPool.#readArray(reader, 0, () => reader.readS32());
        const uintegers = ConstantPool.#readArray(reader, 0, () => reader.readU32());
        const doubles = ConstantPool.#readArray(reader, NaN, () => reader.readD64());
        const strings = ConstantPool.#readArray(reader, "", () => reader.readAbcString());
        const namespaces = ConstantPool.#readArray(reader, null, () => NamespaceInfo.read(reader));
        const namespaceSets = ConstantPool.#readArray(reader, null, () => NamespaceSetInfo.read(reader));
        const multinames = ConstantPool.#readArray(reader, null, () => Multiname.read(reader));
        return new ConstantPool(integers, uintegers, doubles, strings, namespaces, namespaceSets, multinames);
    }

    // count is the stored-entry count plus one; index 0 holds zeroValue and is
    // never read from the stream.
    static #readArray(reader, zeroValue, readEntry) {
        const count = reader.readU30();
        const entries = [zeroValue];
        for (let i = 1; i < count; i++) {
            entries.push(readEntry());
        }
        return entries;
    }
}

export default ConstantPool;
