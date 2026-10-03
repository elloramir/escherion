import * as Abc from "../abc/index.js";

const RUNTIME_NAMESPACE_KINDS = new Set([
    Abc.MultinameKind.RTQ_NAME, Abc.MultinameKind.RTQ_NAME_A,
    Abc.MultinameKind.RTQ_NAME_L, Abc.MultinameKind.RTQ_NAME_LA
]);

const RUNTIME_NAME_ONLY_KINDS = new Set([
    Abc.MultinameKind.MULTINAME_L, Abc.MultinameKind.MULTINAME_LA,
    Abc.MultinameKind.RTQ_NAME_L, Abc.MultinameKind.RTQ_NAME_LA
]);

const ATTRIBUTE_KINDS = new Set([
    Abc.MultinameKind.Q_NAME_A, Abc.MultinameKind.RTQ_NAME_A,
    Abc.MultinameKind.RTQ_NAME_LA, Abc.MultinameKind.MULTINAME_A, Abc.MultinameKind.MULTINAME_LA
]);

// Constant pools are immutable once parsed, and every property opcode resolves
// the same few multinames over and over: memoize per (pool, index) so the hot
// path does array reads instead of rebuilding strings each time.
const POOL_CACHES = new WeakMap();

// Resolution helpers that turn ABC multinames (constant-pool indices) into the
// simple/qualified names the generated code uses, per AVM2 Overview 2.3.6
// "Resolving multinames". Every read is guarded so a wildcard `*` and index 0
// stay distinct from a real name.
class Names {

    // A JavaScript identifier for an AS3 name (`*` and empty become `undefined`).
    static toIdentifier(name) {
        if (name === "*" || name === "") return "undefined";
        return name.replace(/[^A-Za-z0-9_$]/g, "_");
    }

    static simpleNameOf(constantPool, multinameIndex) {
        const cache = Names.#cacheFor(constantPool).simple;
        const hit = cache[multinameIndex];
        if (hit !== undefined) return hit;
        return (cache[multinameIndex] = Names.#simpleNameUncached(constantPool, multinameIndex));
    }

    static #simpleNameUncached(constantPool, multinameIndex) {
        const multiname = constantPool.multinameAt(multinameIndex);
        if (!multiname) return "*";
        if (multiname.kind === Abc.MultinameKind.TYPE_NAME) {
            const base = Names.qualifiedNameOf(constantPool, multiname.typeBaseIndex);
            const params = (multiname.typeParameterIndices ?? [])
                .map((index) => Names.qualifiedNameOf(constantPool, index).split("::").pop());
            return params.length > 0 ? `${base}${params.map((p) => `<${p}>`).join("")}` : base;
        }
        return multiname.nameIndex ? constantPool.stringAt(multiname.nameIndex) : "*";
    }

    static qualifiedNameOf(constantPool, multinameIndex) {
        const cache = Names.#cacheFor(constantPool).qualified;
        const hit = cache[multinameIndex];
        if (hit !== undefined) return hit;
        return (cache[multinameIndex] = Names.#qualifiedNameUncached(constantPool, multinameIndex));
    }

    static #qualifiedNameUncached(constantPool, multinameIndex) {
        const multiname = constantPool.multinameAt(multinameIndex);
        if (!multiname) return "*";
        if (multiname.kind === Abc.MultinameKind.TYPE_NAME) {
            const base = Names.qualifiedNameOf(constantPool, multiname.typeBaseIndex);
            const params = (multiname.typeParameterIndices ?? [])
                .map((index) => Names.qualifiedNameOf(constantPool, index).split("::").pop());
            return params.length > 0 ? `${base}<${params.join(",")}>` : base;
        }
        const name = multiname.nameIndex ? constantPool.stringAt(multiname.nameIndex) : "*";
        return `${Names.#namespaceUri(constantPool, multiname)}::${name}`;
    }

    // The URI of a multiname's namespace, or "" when it has none.
    static #namespaceUri(constantPool, multiname) {
        if (multiname.namespaceIndex === null || multiname.namespaceIndex === undefined) return "";
        const info = constantPool.namespaceAt(multiname.namespaceIndex);
        return info ? constantPool.stringAt(info.nameIndex) : "";
    }

    static isAttribute(constantPool, multinameIndex) {
        const cache = Names.#cacheFor(constantPool).attribute;
        const hit = cache[multinameIndex];
        if (hit !== undefined) return hit;
        return (cache[multinameIndex] = ATTRIBUTE_KINDS.has(constantPool.multinameAt(multinameIndex)?.kind));
    }

    static hasRuntimeName(constantPool, multinameIndex) {
        const cache = Names.#cacheFor(constantPool).runtimeName;
        const hit = cache[multinameIndex];
        if (hit !== undefined) return hit;
        return (cache[multinameIndex] = RUNTIME_NAME_ONLY_KINDS.has(constantPool.multinameAt(multinameIndex)?.kind));
    }

    static hasRuntimeNamespace(constantPool, multinameIndex) {
        const cache = Names.#cacheFor(constantPool).runtimeNamespace;
        const hit = cache[multinameIndex];
        if (hit !== undefined) return hit;
        return (cache[multinameIndex] = RUNTIME_NAMESPACE_KINDS.has(constantPool.multinameAt(multinameIndex)?.kind));
    }

    static #cacheFor(pool) {
        let cache = POOL_CACHES.get(pool);
        if (!cache) {
            cache = {
                simple: [],
                qualified: [],
                attribute: [],
                runtimeName: [],
                runtimeNamespace: []
            };
            POOL_CACHES.set(pool, cache);
        }
        return cache;
    }

}

export default Names;
