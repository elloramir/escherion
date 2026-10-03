import Opcode from "../abc/code/Opcode.js";
import TraitKind from "../abc/traits/TraitKind.js";
import Names from "./Names.js";
import Expressions from "./Expressions.js";
import MethodTranspiler from "./MethodTranspiler.js";

const O = Opcode;

// Opcodes whose multiname operand names a type (not a member).
const TYPE_OPCODES = new Set([
    O.GETLEX, O.FINDPROPSTRICT, O.FINDPROPERTY,
    O.COERCE, O.ASTYPE, O.ISTYPE, O.CONSTRUCTPROP,
]);

// A class initializer holding only these does nothing.
const EMPTY_INITIALIZER = new Set([
    O.GETLOCAL0, O.PUSHSCOPE, O.RETURNVOID, O.NOP, O.LABEL, O.DEBUG, O.DEBUGLINE, O.DEBUGFILE,
]);

// Emits one ABC class inside the movie factory. The factory closes over
// `domain`; game classes are locals of the factory and flash classes are
// imported, so a simple name resolves both.
class ClassTranspiler {

    #abc;
    #index;
    #pool;
    #linker;
    #closure;
    #bodies = new Map();

    constructor(abcFile, classIndex, linker, closure = null) {
        this.#abc = abcFile;
        this.#index = classIndex;
        this.#pool = abcFile.constantPool;
        this.#linker = linker;
        this.#closure = closure;
        for (const body of abcFile.methodBodies) this.#bodies.set(body.methodIndex, body);
    }

    // Qualified names of the types this class references (its base and the types
    // named by typed opcodes), so the factory can import the flash ones.
    types() {
        const instance = this.#abc.instances[this.#index];
        const classInfo = this.#abc.classes[this.#index];
        const names = new Set();
        if (instance.superNameIndex) {
            names.add(Names.qualifiedNameOf(this.#pool, instance.superNameIndex));
        }
        for (const index of this.#methodIndices(instance, classInfo)) {
            const body = this.#bodies.get(index);
            if (!body) continue;
            for (const instruction of body.instructions) {
                if (!TYPE_OPCODES.has(instruction.opcode)) continue;
                names.add(Names.qualifiedNameOf(this.#pool, instruction.operands[0]));
            }
        }
        return names;
    }

    // Whether the class has a static initializer worth running (`Name.__cinit()`).
    hasInitializer() {
        const body = this.#bodies.get(this.#abc.classes[this.#index].cinitIndex);
        return body !== undefined && body.instructions.some((instruction) => !EMPTY_INITIALIZER.has(instruction.opcode));
    }

    name() {
        return this.#name(this.#abc.instances[this.#index].nameIndex);
    }

    baseName() {
        const instance = this.#abc.instances[this.#index];
        if (!instance.superNameIndex) return null;
        return Names.qualifiedNameOf(this.#pool, instance.superNameIndex);
    }

    writeClass(emitter) {
        const instance = this.#abc.instances[this.#index];
        const classInfo = this.#abc.classes[this.#index];
        const name = this.name();
        const baseQualified = this.baseName();
        const base = baseQualified ? this.#linker.resolve(baseQualified) : null;
        const baseSymbol = base && base.kind !== "native"
            ? base.symbol
            : (base?.expression ?? "Object");

        emitter.class(name, baseSymbol, () => {
            this.#writeFields(emitter, instance.traits, false);
            this.#writeFields(emitter, classInfo.traits, true);
            this.#writeConstructor(emitter, instance.iinitIndex);
            this.#writeMembers(emitter, instance.traits, false);
            this.#writeMembers(emitter, classInfo.traits, true);
            this.#writeInitializer(emitter, classInfo.cinitIndex);
        });
        return emitter;
    }

    #writeFields(emitter, traits, isStatic) {
        for (const trait of traits) {
            if (trait.kind !== TraitKind.SLOT && trait.kind !== TraitKind.CONST) continue;
            // Only initialised slots become JS fields: a field with no value would
            // be set to undefined after `super()` and clobber a timeline child of
            // the same instance name (bound before the constructor body runs).
            const prefix = isStatic ? "static " : "";
            const name = this.#name(trait.nameIndex);
            // A static slot is declared even without a value, so scope lookups find it on the class
            // (its initializer assigns it later).
            if (!trait.vindex) {
                if (isStatic) emitter.line(`${prefix}${name};${this.#typeHint(trait)}`);
                continue;
            }
            const resolved = this.#pool.valueAt(trait.vindex, trait.vkind);
            emitter.line(`${prefix}${name} = ${Expressions.literal(resolved)};${this.#typeHint(trait)}`);
        }
    }

    #writeConstructor(emitter, iinitIndex) {
        const body = this.#bodies.get(iinitIndex);
        if (!body) return;
        try {
            new MethodTranspiler(this.#abc, body, {
                receiver: "this",
                linker: this.#linker,
                closure: this.#closure,
            }).writeInto(emitter, { kind: "constructor" });
        } catch (error) {
            emitter.comment(`constructor unsupported: ${error.message}`);
        }
    }

    // The static initializer (`cinit`) runs once, with the class as `this`, after every class of the
    // movie exists.
    #writeInitializer(emitter, cinitIndex) {
        if (!this.hasInitializer()) return;
        try {
            new MethodTranspiler(this.#abc, this.#bodies.get(cinitIndex), {
                receiver: "this",
                linker: this.#linker,
                closure: this.#closure,
            }).writeInto(emitter, { name: "__cinit", kind: "method", static: true });
        } catch (error) {
            emitter.comment(`static initializer unsupported: ${error.message}`);
        }
    }

    #writeMembers(emitter, traits, isStatic) {
        for (const trait of traits) {
            if (trait.kind === TraitKind.SLOT || trait.kind === TraitKind.CONST) continue;
            const body = this.#bodies.get(trait.methodIndex);
            if (!body) continue;
            const name = this.#name(trait.nameIndex);
            const kind = ClassTranspiler.#memberKind(trait.kind);
            try {
                new MethodTranspiler(this.#abc, body, {
                    // A static method is invoked as `Class.method(...)`, so `this`
                    // is the class: unqualified statics resolve through it, and
                    // global functions still fall back inside __call.
                    receiver: "this",
                    linker: this.#linker,
                    closure: this.#closure,
                }).writeInto(emitter, { name, kind, static: isStatic });
            } catch (error) {
                emitter.comment(`${name} unsupported: ${error.message}`);
            }
        }
    }

    #methodIndices(instance, classInfo) {
        const indices = [instance.iinitIndex, classInfo.cinitIndex];
        for (const trait of instance.traits) if (trait.methodIndex) indices.push(trait.methodIndex);
        for (const trait of classInfo.traits) {
            if (trait.methodIndex) indices.push(trait.methodIndex);
        }
        return indices;
    }

    #name(multinameIndex) {
        return Names.toIdentifier(Names.simpleNameOf(this.#pool, multinameIndex));
    }

    #typeHint(trait) {
        if (!trait.typeNameIndex) return "";
        return ` // :${Names.simpleNameOf(this.#pool, trait.typeNameIndex)}`;
    }

    static #memberKind(kind) {
        switch (kind) {
            case TraitKind.GETTER: return "getter";
            case TraitKind.SETTER: return "setter";
            default: return "method";
        }
    }
}

export default ClassTranspiler;
