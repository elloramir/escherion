import Opcode from "../abc/code/Opcode.js";
import Names from "./Names.js";
import Expressions from "./Expressions.js";

const O = Opcode;

// Property access, calls and construction: the opcodes that name a member
// through a multiname. A name that resolves to a flash/game class, a JS
// built-in or a scope member (instance or global) is emitted accordingly.
class PropertyTranslator {

    #pool;
    #stack;
    #linker;
    #receiver;

    constructor(pool, stack, linker, { receiver }) {
        this.#pool = pool;
        this.#stack = stack;
        this.#linker = linker;
        this.#receiver = receiver;
    }

    getLex(multinameIndex) {
        const kind = this.#scopeKind(multinameIndex);
        // A non-class getlex is a scope read (an instance member or a global),
        // not a bare identifier. A scope name read as a value (an event listener,
        // a callback) must keep its `this`, hence the bound reference.
        if (kind === "scope") {
            return this.#push(`domain.__methodRef(${this.#receiver}, ${JSON.stringify(this.#identifier(multinameIndex))})`);
        }
        if (kind === "native") {
            return this.#push(this.#linker.resolve(Names.qualifiedNameOf(this.#pool, multinameIndex)).expression);
        }
        return this.#push(this.#identifier(multinameIndex));
    }

    // A scope name resolves to the object owning it (the instance for a member,
    // the global otherwise) so it stays usable if the value is materialised into
    // a register before the matching get/call/set.
    findProperty(multinameIndex) {
        if (this.#scopeKind(multinameIndex) === "scope") {
            return this.#push(`domain.__ref(${this.#receiver}, ${JSON.stringify(this.#identifier(multinameIndex))})`);
        }
        return this.#push(this.#identifier(multinameIndex));
    }

    deleteProperty(multinameIndex) {
        if (Names.hasRuntimeName(this.#pool, multinameIndex)) {
            const key = this.#stack.pop();
            const object = this.#stack.pop();
            return this.#push(`delete ${Expressions.paren(object)}[${key}]`);
        }
        const object = this.#stack.pop();
        return this.#push(`delete ${this.#member(object, multinameIndex)}`);
    }

    getProperty(multinameIndex) {
        if (Names.hasRuntimeName(this.#pool, multinameIndex)) {
            const key = this.#stack.pop();
            const object = this.#stack.pop();
            return this.#push(`${Expressions.paren(object)}[${key}]`);
        }
        const object = this.#stack.pop();
        const name = Names.simpleNameOf(this.#pool, multinameIndex);
        const identifier = Names.toIdentifier(name);
        // `findpropstrict X; getproperty X` on a non-class is a scope read: the
        // instance member if present, otherwise the global.
        if (this.#isRef(object, multinameIndex)) {
            return this.#push(`domain.__methodRef(${this.#receiver}, ${JSON.stringify(identifier)})`);
        }
        // A native reached through `findpropstrict X; getproperty X` (e.g. Vector)
        // is the JS-backed class, not a bare identifier.
        if ((object === name || object === identifier) && !this.#isClass(multinameIndex)) {
            const spec = this.#linker?.resolve(Names.qualifiedNameOf(this.#pool, multinameIndex));
            if (spec?.kind === "native") return this.#push(spec.expression);
        }
        // AS3 method references are bound; a receiver read goes through __method
        // so `this.someMethod` passed as a value keeps `this`.
        if (object === this.#receiver) {
            return this.#push(`domain.__method(${this.#receiver}, ${JSON.stringify(identifier)})`);
        }
        return this.#push(this.#member(object, multinameIndex));
    }

    setProperty(multinameIndex) {
        if (Names.hasRuntimeName(this.#pool, multinameIndex)) {
            // Stack is [object, name, value] with the value on top.
            const value = this.#stack.pop();
            const key = this.#stack.pop();
            const object = this.#stack.pop();
            return `${Expressions.paren(object)}[${key}] = ${value};`;
        }
        const value = this.#stack.pop();
        const object = this.#stack.pop();
        const identifier = Names.toIdentifier(Names.simpleNameOf(this.#pool, multinameIndex));
        // `findproperty X; initproperty X` on a non-class is a scope write.
        if (this.#isRef(object, multinameIndex)) {
            return `domain.__set(${this.#receiver}, ${JSON.stringify(identifier)}, ${value});`;
        }
        return `${this.#member(object, multinameIndex)} = ${value};`;
    }

    getSuper(multinameIndex) {
        if (Names.hasRuntimeName(this.#pool, multinameIndex)) {
            const key = this.#stack.pop();
            this.#stack.pop();
            return this.#push(`super[${key}]`);
        }
        this.#stack.pop();
        return this.#push(`super.${this.#identifier(multinameIndex)}`);
    }

    setSuper(multinameIndex) {
        if (Names.hasRuntimeName(this.#pool, multinameIndex)) {
            // Stack is [name, value] with the value on top.
            const value = this.#stack.pop();
            const key = this.#stack.pop();
            return `super[${key}] = ${value};`;
        }
        const value = this.#stack.pop();
        this.#stack.pop();
        return `super.${this.#identifier(multinameIndex)} = ${value};`;
    }

    call(argc) {
        const args = this.#stack.popMany(argc);
        const receiver = this.#stack.pop();
        const func = this.#stack.pop();
        const tail = args.length ? `, ${args.join(", ")}` : "";
        return this.#push(`${Expressions.paren(func)}.call(${receiver}${tail})`);
    }

    construct(argc) {
        const args = this.#stack.popMany(argc);
        const cls = this.#stack.pop();
        return this.#push(`new ${Expressions.paren(this.#native(cls))}(${args.join(", ")})`);
    }

    // A native class reached through `findpropstrict` is a bare identifier; use
    // its JS expression (e.g. `XML` -> `domain.XML`).
    #native(expression) {
        if (typeof expression !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expression)) return expression;
        const spec = this.#linker?.resolve(`::${expression}`);
        return spec?.kind === "native" ? spec.expression : expression;
    }

    callProperty(instruction) {
        const multinameIndex = instruction.operands[0];
        const argc = instruction.operands[1];
        let key = null;
        if (Names.hasRuntimeName(this.#pool, multinameIndex)) key = this.#stack.pop();
        const args = this.#stack.popMany(argc);
        const receiver = this.#stack.pop();
        const name = Names.simpleNameOf(this.#pool, multinameIndex);
        // `findpropstrict X; callproperty X` on a non-class looks the name up in
        // scope: an instance method if present, otherwise a global function.
        const identifier = Names.toIdentifier(name);
        const isScopeName = receiver === name || receiver === identifier;
        // `Type(x)` is a cast, not a constructor call: emit it through __cast.
        if (key === null && isScopeName && this.#isClass(multinameIndex)) {
            const cast = args.length > 0
                ? `domain.__cast(${identifier}, ${args[0]})`
                : `domain.__cast(${identifier})`;
            if (instruction.opcode === O.CALLPROPVOID) return `${cast};`;
            return this.#push(cast);
        }
        const isScopeCall = key === null && !this.#isClass(multinameIndex)
            && (isScopeName || this.#isRef(receiver, multinameIndex));
        if (isScopeCall) {
            const list = args.join(", ");
            let call;
            if (identifier === "int" && args.length === 1) call = `(${args[0]} | 0)`;
            else if (identifier === "uint" && args.length === 1) call = `(${args[0]} >>> 0)`;
            else if (this.#scopeKind(multinameIndex) === "native") {
                const spec = this.#linker.resolve(Names.qualifiedNameOf(this.#pool, multinameIndex));
                call = `${spec.expression}(${list})`;
            } else {
                call = `domain.__call(${this.#receiver}, ${JSON.stringify(identifier)}, [${list}])`;
            }
            if (instruction.opcode === O.CALLPROPVOID) return `${call};`;
            return this.#push(call);
        }
        const callee = key === null
            ? this.#member(receiver, multinameIndex)
            : `${Expressions.paren(receiver)}[${key}]`;
        const call = `${callee}(${args.join(", ")})`;
        if (instruction.opcode === O.CALLPROPVOID) return `${call};`;
        return this.#push(call);
    }

    constructProperty(instruction) {
        const args = this.#stack.popMany(instruction.operands[1]);
        const receiver = this.#stack.pop();
        const member = this.#native(this.#member(receiver, instruction.operands[0]));
        return this.#push(`new ${member}(${args.join(", ")})`);
    }

    callSuper(instruction) {
        const args = this.#stack.popMany(instruction.operands[1]);
        this.#stack.pop();
        const call = `super.${this.#identifier(instruction.operands[0])}(${args.join(", ")})`;
        if (instruction.opcode === O.CALLSUPERVOID) return `${call};`;
        return this.#push(call);
    }

    #push(expression) {
        this.#stack.push(expression);
        return "";
    }

    #identifier(multinameIndex) {
        return Names.toIdentifier(Names.simpleNameOf(this.#pool, multinameIndex));
    }

    #member(objectExpression, multinameIndex) {
        const name = Names.simpleNameOf(this.#pool, multinameIndex);
        const attribute = Names.isAttribute(this.#pool, multinameIndex) ? "@" : "";
        const full = attribute + name;
        // `findpropstrict X; getproperty X` (the usual way a global is reached)
        // resolves to X itself; collapsing it avoids `trace.trace`/`Loader.Loader`.
        const identifier = Names.toIdentifier(full);
        if (objectExpression === full || objectExpression === identifier) return identifier;
        if (Expressions.isIdentifier(full)) return `${Expressions.paren(objectExpression)}.${full}`;
        return `${Expressions.paren(objectExpression)}[${JSON.stringify(full)}]`;
    }

    #isClass(multinameIndex) {
        return this.#scopeKind(multinameIndex) === "class";
    }

    // Matches the `domain.__ref(receiver, "X")` a preceding findpropstrict left
    // on the stack, so the matching get/set/call can take the scope path.
    #isRef(objectExpression, multinameIndex) {
        if (this.#scopeKind(multinameIndex) !== "scope") return false;
        const name = this.#identifier(multinameIndex);
        return objectExpression === `domain.__ref(${this.#receiver}, ${JSON.stringify(name)})`;
    }

    // "class" (flash/game), "native" (JS built-in) or "scope" (instance/global).
    #scopeKind(multinameIndex) {
        if (!this.#linker) return "scope";
        const spec = this.#linker.resolve(Names.qualifiedNameOf(this.#pool, multinameIndex));
        if (spec && (spec.kind === "flash" || spec.kind === "game")) return "class";
        if (spec && spec.kind === "native") return "native";
        return "scope";
    }
}

export default PropertyTranslator;
