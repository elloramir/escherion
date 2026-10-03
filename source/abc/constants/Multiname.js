import MultinameKind from "./MultinameKind.js";

// multiname_info, per AVM2 Overview 4.4.3. Which fields are meaningful depends
// on kind; unused fields are null. Indices stay raw and resolve via ConstantPool.
class Multiname {

    #kind;
    #namespaceIndex;
    #nameIndex;
    #namespaceSetIndex;
    #typeBaseIndex;
    #typeParameterIndices;

    constructor(kind, namespaceIndex, nameIndex, namespaceSetIndex, typeBaseIndex = null, typeParameterIndices = null) {
        this.#kind = kind;
        this.#namespaceIndex = namespaceIndex;
        this.#nameIndex = nameIndex;
        this.#namespaceSetIndex = namespaceSetIndex;
        this.#typeBaseIndex = typeBaseIndex;
        this.#typeParameterIndices = typeParameterIndices;
    }

    get kind() {
        return this.#kind;
    }

    get namespaceIndex() {
        return this.#namespaceIndex;
    }

    get nameIndex() {
        return this.#nameIndex;
    }

    get namespaceSetIndex() {
        return this.#namespaceSetIndex;
    }

    // TypeName only: base type, e.g. Vector.
    get typeBaseIndex() {
        return this.#typeBaseIndex;
    }

    // TypeName only: one entry per type parameter, e.g. [int] for Vector.<int>.
    get typeParameterIndices() {
        return this.#typeParameterIndices;
    }

    static read(reader) {
        const kind = reader.readUI8();
        if (kind === MultinameKind.Q_NAME || kind === MultinameKind.Q_NAME_A) {
            const namespaceIndex = reader.readU30();
            const nameIndex = reader.readU30();
            return new Multiname(kind, namespaceIndex, nameIndex, null);
        }
        if (kind === MultinameKind.RTQ_NAME || kind === MultinameKind.RTQ_NAME_A) {
            const nameIndex = reader.readU30();
            return new Multiname(kind, null, nameIndex, null);
        }
        if (kind === MultinameKind.RTQ_NAME_L || kind === MultinameKind.RTQ_NAME_LA) {
            return new Multiname(kind, null, null, null);
        }
        if (kind === MultinameKind.MULTINAME || kind === MultinameKind.MULTINAME_A) {
            const nameIndex = reader.readU30();
            const namespaceSetIndex = reader.readU30();
            return new Multiname(kind, null, nameIndex, namespaceSetIndex);
        }
        if (kind === MultinameKind.MULTINAME_L || kind === MultinameKind.MULTINAME_LA) {
            const namespaceSetIndex = reader.readU30();
            return new Multiname(kind, null, null, namespaceSetIndex);
        }
        if (kind === MultinameKind.TYPE_NAME) {
            const typeBaseIndex = reader.readU30();
            const paramCount = reader.readU30();
            const typeParameterIndices = [];
            for (let i = 0; i < paramCount; i++) {
                typeParameterIndices.push(reader.readU30());
            }
            return new Multiname(kind, null, null, null, typeBaseIndex, typeParameterIndices);
        }
        throw new Error(`Multiname: unknown kind 0x${kind.toString(16)}`);
    }
}

export default Multiname;
