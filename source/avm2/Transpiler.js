import Names from "./Names.js";
import SourceWriter from "./SourceWriter.js";
import ClassTranspiler from "./ClassTranspiler.js";
import MethodTranspiler from "./MethodTranspiler.js";
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
    #bodies = new Map();
    #closures = new Map();

    constructor(abcFile, options = {}) {
        this.#abc = abcFile;
        this.#linker = new Linker(abcFile, options);
        abcFile.instances.forEach((instance, index) => {
            const qualified = Names.qualifiedNameOf(abcFile.constantPool, instance.nameIndex);
            this.#indexByName.set(qualified, index);
        });
        for (const body of abcFile.methodBodies) this.#bodies.set(body.methodIndex, body);
    }

    // Transpiles a `newfunction` method body into an inline arrow function. The
    // arrow keeps the creating method's `this` (AS3 closures are bound), and its
    // own `_scope`/params.
    #closure(index) {
        const cached = this.#closures.get(index);
        if (cached !== undefined) return cached;
        const body = this.#bodies.get(index);
        if (!body) return `domain.__function(${index})`;
        const writer = new SourceWriter();
        try {
            new MethodTranspiler(this.#abc, body, {
                receiver: "this",
                linker: this.#linker,
                closure: (inner) => this.#closure(inner),
            }).writeInto(writer, { kind: "closure" });
        } catch (error) {
            console.warn(`[transpiler] closure ${index} unsupported: ${error.message}`);
            return `domain.__function(${index})`;
        }
        const source = writer.toString().trim();
        this.#closures.set(index, source);
        return source;
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
        const closure = (index) => this.#closure(index);
        for (const index of order) {
            const body = new SourceWriter();
            new ClassTranspiler(this.#abc, index, this.#linker, closure).writeClass(body);
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
        // A movie with no document class returns null so the loader mounts a
        // plain MovieClip for its timeline (the ABC classes are still registered).
        const documentName = documentClass ? documentClass.split(/::|\./).pop() : null;
        emitter.line(documentName ? `return ${documentName};` : "return null;");
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
