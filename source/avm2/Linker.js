import Names from "./Names.js";
import SUBPACKAGE_BY_NAME from "./FlashClasses.js";

// AS3 value types that map to JavaScript built-ins or to the movie's domain.
const NATIVE = new Map([
    ["Object", "Object"],
    ["Array", "Array"],
    ["Function", "Function"],
    ["Date", "Date"],
    ["RegExp", "RegExp"],
    ["Error", "Error"],
    ["String", "String"],
    ["Number", "Number"],
    ["Boolean", "Boolean"],
    ["int", "domain.int"],
    ["uint", "domain.uint"],
    ["Vector", "domain.Vector"],
    ["XML", "domain.XML"],
    ["XMLList", "domain.XMLList"],
    ["Math", "Math"],
    ["JSON", "JSON"],
]);

// Flash classes that reach the player through the movie's domain: the movie
// uses `domain.bind(Class)` instead of the class itself.
const SERVICE_CLASSES = new Set(["Loader", "URLLoader", "ApplicationDomain", "Socket"]);

// Resolves an ABC qualified name to what provides it: a hand-written flash
// class under `flash/` (imported by the generated module), a class of the game
// itself, or a JavaScript built-in.
class Linker {

    #pool;
    #gameNames = new Set();
    #gameSimple = new Set();
    #flashBase;

    constructor(abcFile, { flashBase = "../../source/flash" } = {}) {
        this.#pool = abcFile.constantPool;
        this.#flashBase = flashBase;
        for (const instance of abcFile.instances) {
            this.#gameNames.add(Names.qualifiedNameOf(this.#pool, instance.nameIndex));
            this.#gameSimple.add(Names.simpleNameOf(this.#pool, instance.nameIndex));
        }
    }

    resolve(qualifiedName) {
        const spec = this.#resolve(qualifiedName);
        if (spec?.kind === "flash" && SERVICE_CLASSES.has(spec.symbol)) spec.service = true;
        return spec;
    }

    #resolve(qualifiedName) {
        if (!qualifiedName || qualifiedName === "*") return null;
        const separator = qualifiedName.indexOf("::");
        const pkg = separator === -1 ? "" : qualifiedName.slice(0, separator);
        const simple = separator === -1 ? qualifiedName : qualifiedName.slice(separator + 2);

        if (simple === "getDefinitionByName" && (pkg === "flash.utils" || pkg === "")) {
            return { kind: "native", expression: "domain.getDefinitionByName" };
        }
        if (pkg === "flash" || pkg.startsWith("flash.")) {
            const sub = pkg.split(".").slice(1).join("/");
            return {
                kind: "flash",
                specifier: `${this.#flashBase}/${sub}/${simple}.js`,
                symbol: simple,
            };
        }
        if (this.#gameNames.has(qualifiedName)) {
            return { kind: "game", symbol: simple };
        }
        // An unqualified game reference (empty namespace) resolves by simple name.
        if (pkg === "" && this.#gameSimple.has(simple)) {
            return { kind: "game", symbol: simple };
        }
        if (NATIVE.has(simple)) {
            return { kind: "native", expression: NATIVE.get(simple) };
        }
        // An unqualified flash reference (empty namespace) resolves by name.
        const sub = SUBPACKAGE_BY_NAME[simple];
        if (sub !== undefined && pkg === "") {
            const suffix = sub ? `/${sub}` : "";
            return {
                kind: "flash",
                specifier: `${this.#flashBase}${suffix}/${simple}.js`,
                symbol: simple,
            };
        }
        return null;
    }
}

export default Linker;
