import Names from "./Names.js";
import SourceWriter from "./SourceWriter.js";
import ClassTranspiler from "./ClassTranspiler.js";
import Linker from "./Linker.js";

// Turns a parsed `AbcFile` into one movie factory:
//
//     export default function createMovie(domain) { … return DocumentClass; }
//
// Game classes are locals of the factory and flash classes are imported, so the
// whole movie closes over one Domain — no shared state between instances.
class Transpiler {

    #abc;
    #linker;
    #indexByName = new Map();

    constructor(abcFile, options = {}) {
        this.#abc = abcFile;
        this.#linker = new Linker(abcFile, options);
        abcFile.instances.forEach((instance, index) => {
            const qualified = Names.qualifiedNameOf(abcFile.constantPool, instance.nameIndex);
            this.#indexByName.set(qualified, index);
        });
    }

    static transpile(abcFile, documentClass, options = {}) {
        return new Transpiler(abcFile, options).build(documentClass);
    }

    build(documentClass) {
        const order = this.#order();
        const imports = this.#flashImports(order);
        const emitter = new SourceWriter();

        for (const [symbol, { specifier, service }] of imports) {
            emitter.line(`import ${service ? `Flash${symbol}` : symbol} from "${specifier}";`);
        }
        if (imports.size > 0) emitter.blank();

        emitter.line("export default function createMovie(domain) {");
        emitter.indent();
        // Flash classes that need the player's services are used through the domain.
        for (const [symbol, { service }] of imports) {
            if (service) emitter.line(`const ${symbol} = domain.bind(Flash${symbol});`);
        }
        for (const index of order) {
            const body = new SourceWriter();
            new ClassTranspiler(this.#abc, index, this.#linker).writeClass(body);
            emitter.adopt(body);
            emitter.blank();
        }
        // Expose every class to the domain so a SymbolClass can bind a game
        // class to its symbol at load time.
        for (const [qualified, index] of this.#indexByName) {
            const simple = Names.simpleNameOf(this.#abc.constantPool, this.#abc.instances[index].nameIndex);
            emitter.line(`domain.defineClass(${JSON.stringify(qualified)}, ${simple});`);
        }
        // Static initializers run once every class exists, base classes first.
        for (const index of order) {
            const classTranspiler = new ClassTranspiler(this.#abc, index, this.#linker);
            if (!classTranspiler.hasInitializer()) continue;
            const name = classTranspiler.name();
            emitter.line(`try { ${name}.__cinit(); } catch (error) { console.warn("${name} static initializer failed:", error); }`);
        }
        emitter.line(`return ${this.#documentName(documentClass)};`);
        emitter.dedent();
        emitter.line("}");
        return emitter.toString();
    }

    // Base classes first, so `extends` always sees its base declared.
    #order() {
        const instances = this.#abc.instances;
        const visited = new Set();
        const order = [];
        const visit = (index) => {
            if (visited.has(index)) return;
            visited.add(index);
            const superName = instances[index].superNameIndex
                ? Names.qualifiedNameOf(this.#abc.constantPool, instances[index].superNameIndex)
                : null;
            const baseIndex = superName === null ? undefined : this.#indexByName.get(superName);
            if (baseIndex !== undefined) visit(baseIndex);
            order.push(index);
        };
        for (let index = 0; index < instances.length; index++) visit(index);
        return order;
    }

    #flashImports(order) {
        const imports = new Map();
        for (const index of order) {
            for (const qualified of new ClassTranspiler(this.#abc, index, this.#linker).types()) {
                const spec = this.#linker.resolve(qualified);
                if (spec && spec.kind === "flash") {
                    imports.set(spec.symbol, { specifier: spec.specifier, service: spec.service === true });
                }
            }
        }
        return imports;
    }

    #documentName(documentClass) {
        if (documentClass) return documentClass.split(/::|\./).pop();
        const first = this.#abc.instances[0];
        return first ? Names.simpleNameOf(this.#abc.constantPool, first.nameIndex) : "Object";
    }
}

export default Transpiler;
