import Opcode from "../abc/code/Opcode.js";
import Names from "./Names.js";
import Opcodes from "./Opcodes.js";
import Expressions from "./Expressions.js";
import ExpressionStack from "./ExpressionStack.js";
import OperatorTranslator from "./OperatorTranslator.js";
import PropertyTranslator from "./PropertyTranslator.js";

const O = Opcode;

// Turns AVM2 instructions into JavaScript by running them against an operand
// stack of expressions. Each call returns the statement lines the instruction
// produces ("" when it only pushed or popped), and leaves its result, if any,
// on the stack for a later instruction to consume.
class InstructionTranslator {

    #abc;
    #pool;
    #locals;
    #linker;
    #receiver;
    #hoistSuper;
    #stack = new ExpressionStack();
    #operators = new OperatorTranslator(this.#stack);
    #properties;
    #temporaries = 0;
    #usesScope = false;
    // The hoisted `super(...)` call of a constructor, recorded when its
    // CONSTRUCTSUPER is translated so the caller can emit it first.
    superCall = null;

    constructor(abcFile, locals, linker, { receiver, hoistSuper, closure = null }) {
        this.#abc = abcFile;
        this.#pool = abcFile.constantPool;
        this.#locals = locals;
        this.#linker = linker;
        this.#receiver = receiver;
        this.#hoistSuper = hoistSuper;
        this.#closure = closure;
        this.#properties = new PropertyTranslator(this.#pool, this.#stack, linker, { receiver });
    }

    #closure;

    get stack() {
        return this.#stack;
    }

    get operators() {
        return this.#operators;
    }

    // Whether the method uses the AVM2 scope stack (`_scope`), e.g. for activation objects.
    get usesScope() {
        return this.#usesScope;
    }

    get temporaryCount() {
        return this.#temporaries;
    }

    // Starts a basic block with the expressions its predecessors left on the stack.
    begin(seed = []) {
        while (this.#stack.depth > 0) this.#stack.pop();
        for (const expression of seed) this.#stack.push(expression);
    }

    translate(instruction) {
        const code = instruction.opcode;
        const operands = instruction.operands;
        const stack = this.#stack;
        const properties = this.#properties;
        const operators = this.#operators;

        switch (code) {
            case O.NOP: case O.LABEL: case O.DEBUG: case O.DEBUGLINE: case O.DEBUGFILE:
            case O.DXNS: case O.COERCE_A: case O.CONVERT_O:
                return "";
            case O.PUSHSCOPE:
                this.#usesScope = true;
                return `_scope.push(${stack.pop()});`;
            case O.POPSCOPE:
                this.#usesScope = true;
                return "_scope.pop();";
            case O.PUSHWITH: case O.DXNSLATE:
                stack.pop();
                return "";

            case O.PUSHBYTE: case O.PUSHSHORT: return this.#push(String(operands[0]));
            case O.PUSHINT: return this.#push(Expressions.number(this.#pool.intAt(operands[0])));
            case O.PUSHUINT: return this.#push(Expressions.number(this.#pool.uintAt(operands[0])));
            case O.PUSHDOUBLE: return this.#push(Expressions.number(this.#pool.doubleAt(operands[0])));
            case O.PUSHSTRING: return this.#push(JSON.stringify(this.#pool.stringAt(operands[0])));
            case O.PUSHTRUE: return this.#push("true");
            case O.PUSHFALSE: return this.#push("false");
            case O.PUSHNULL: return this.#push("null");
            case O.PUSHUNDEFINED: return this.#push("undefined");
            case O.PUSHNAN: return this.#push("NaN");
            case O.PUSHNAMESPACE: return this.#push(JSON.stringify(this.#pool.stringAt(operands[0])));

            case O.POP: stack.pop(); return "";
            case O.DUP: return this.#dup();
            case O.SWAP: return this.#swap();

            case O.GETLOCAL: return this.#push(this.#locals.name(operands[0]));
            case O.GETLOCAL0: case O.GETLOCAL1: case O.GETLOCAL2: case O.GETLOCAL3:
                return this.#push(this.#locals.name(code - O.GETLOCAL0));
            case O.SETLOCAL: return `${this.#locals.name(operands[0])} = ${stack.pop()};`;
            case O.SETLOCAL0: case O.SETLOCAL1: case O.SETLOCAL2: case O.SETLOCAL3:
                return `${this.#locals.name(code - O.SETLOCAL0)} = ${stack.pop()};`;
            case O.KILL: return operands[0] === 0 ? "" : `${this.#locals.name(operands[0])} = undefined;`;

            case O.GETPROPERTY: return properties.getProperty(operands[0]);
            case O.SETPROPERTY: case O.INITPROPERTY: return properties.setProperty(operands[0]);
            case O.GETSUPER: return properties.getSuper(operands[0]);
            case O.SETSUPER: return properties.setSuper(operands[0]);
            case O.GETLEX: return properties.getLex(operands[0]);
            case O.FINDPROPSTRICT: case O.FINDPROPERTY: return properties.findProperty(operands[0]);
            case O.DELETEPROPERTY: return properties.deleteProperty(operands[0]);
            case O.GETGLOBALSCOPE: return this.#push("domain");
            case O.GETSCOPEOBJECT:
                this.#usesScope = true;
                return this.#push(`_scope[${operands[0]}]`);
            case O.GETSLOT: return this.#push(`domain.__getSlot(${stack.pop()}, ${operands[0]})`);
            case O.SETSLOT: {
                const value = stack.pop();
                const object = stack.pop();
                return `domain.__setSlot(${object}, ${operands[0]}, ${value});`;
            }

            case O.CALL: return properties.call(operands[0]);
            case O.CONSTRUCT: case O.CONSTRUCTGENERICTYPE: return properties.construct(operands[0]);
            case O.CALLPROPERTY: case O.CALLPROPVOID: case O.CALLPROPLEX:
                return properties.callProperty(instruction);
            case O.CONSTRUCTPROP: return properties.constructProperty(instruction);
            case O.CALLSUPER: case O.CALLSUPERVOID: return properties.callSuper(instruction);
            case O.CONSTRUCTSUPER: {
                const args = stack.popMany(operands[0]);
                stack.pop();
                // `super(...)` is hoisted to the first line of the constructor,
                // before any `this` access (the AVM2 prologue's pushscope).
                if (this.#hoistSuper) {
                    this.superCall = `super(${args.join(", ")});`;
                    return "";
                }
                return `super(${args.join(", ")});`;
            }

            case O.NEWCLASS: return this.#push(this.#className(operands[0]));
            case O.NEWFUNCTION: {
                const index = operands[0];
                return this.#push(this.#closure ? this.#closure(index) : `domain.__function(${index})`);
            }
            case O.NEWACTIVATION: case O.NEWCATCH: return this.#push("{}");

            case O.HASNEXT: return this.#iterate("domain.__hasNext");
            case O.HASNEXT2: return this.#hasNext2(operands);
            case O.NEXTNAME: return this.#iterate("domain.__nextName");
            case O.NEXTVALUE: return this.#iterate("domain.__nextValue");

            case O.RETURNVOID: return "return;";
            case O.RETURNVALUE: return `return ${stack.pop()};`;
            case O.THROW: return `throw ${stack.pop()};`;

            case O.ADD: return operators.binary("+");
            case O.SUBTRACT: return operators.binary("-");
            case O.MULTIPLY: return operators.binary("*");
            case O.DIVIDE: return operators.binary("/");
            case O.MODULO: return operators.binary("%");
            case O.BITAND: return operators.binary("&", true);
            case O.BITOR: return operators.binary("|", true);
            case O.BITXOR: return operators.binary("^", true);
            case O.LSHIFT: return operators.binary("<<", true);
            case O.RSHIFT: return operators.binary(">>", true);
            case O.URSHIFT: return operators.binary(">>>", true);
            case O.ADD_I: return operators.binary("+", true);
            case O.SUBTRACT_I: return operators.binary("-", true);
            case O.MULTIPLY_I: return operators.binary("*", true);
            case O.BITNOT: return this.#push(`(~(${stack.pop()}))`);
            case O.NEGATE: case O.NEGATE_I: return this.#push(`(-(${stack.pop()}))`);
            case O.INCREMENT: case O.INCREMENT_I: return this.#push(`(${stack.pop()} + 1)`);
            case O.DECREMENT: case O.DECREMENT_I: return this.#push(`(${stack.pop()} - 1)`);
            case O.INCLOCAL: return `${this.#locals.name(operands[0])} += 1;`;
            case O.DECLOCAL: return `${this.#locals.name(operands[0])} -= 1;`;
            case O.INCLOCAL_I: return this.#integerStep(operands[0], "+");
            case O.DECLOCAL_I: return this.#integerStep(operands[0], "-");

            case O.EQUALS: return operators.binary("==");
            case O.STRICTEQUALS: return operators.binary("===");
            case O.LESSTHAN: return operators.binary("<");
            case O.LESSEQUALS: return operators.binary("<=");
            case O.GREATERTHAN: return operators.binary(">");
            case O.GREATEREQUALS: return operators.binary(">=");
            case O.NOT: return this.#push(`!(${stack.pop()})`);
            case O.IN: return operators.binary("in");
            case O.INSTANCEOF: case O.ISTYPELATE: return operators.binary("instanceof");
            case O.TYPEOF: return this.#push(`typeof (${stack.pop()})`);

            case O.COERCE: return this.#push(`domain.__coerce(${stack.pop()}, ${this.#typeName(operands[0])})`);
            case O.COERCE_S: case O.CONVERT_S: return this.#push(`domain.__toString(${stack.pop()})`);
            case O.CONVERT_I: return this.#push(`(${stack.pop()} | 0)`);
            case O.CONVERT_U: return this.#push(`(${stack.pop()} >>> 0)`);
            case O.CONVERT_D: return this.#push(`Number(${stack.pop()})`);
            case O.CONVERT_B: return this.#push(`Boolean(${stack.pop()})`);
            case O.ASTYPE: return this.#push(`domain.__as(${stack.pop()}, ${this.#typeName(operands[0])})`);
            case O.ASTYPELATE: {
                const type = stack.pop();
                return this.#push(`domain.__as(${stack.pop()}, ${type})`);
            }
            case O.ISTYPE: return this.#push(`domain.__is(${stack.pop()}, ${this.#typeName(operands[0])})`);

            case O.NEWARRAY: return this.#push(`[${stack.popMany(operands[0]).join(", ")}]`);
            case O.NEWOBJECT: return this.#newObject(operands[0]);

            default:
                throw new Error(
                    `MethodTranspiler: unsupported ${Opcodes.mnemonicFor(code)} `
                    + `(0x${code.toString(16)}) at offset ${instruction.offset}`
                );
        }
    }

    #push(expression) {
        this.#stack.push(expression);
        return "";
    }

    #typeName(multinameIndex) {
        return JSON.stringify(Names.simpleNameOf(this.#pool, multinameIndex));
    }

    #className(classIndex) {
        const instance = this.#abc.instances[classIndex];
        return Names.toIdentifier(Names.simpleNameOf(this.#pool, instance.nameIndex));
    }

    #dup() {
        const expression = this.#stack.pop();
        const temporary = `_t${this.#temporaries++}`;
        this.#stack.push(temporary);
        this.#stack.push(temporary);
        return `${temporary} = ${expression};`;
    }

    #swap() {
        const top = this.#stack.pop();
        const under = this.#stack.pop();
        this.#stack.push(top);
        this.#stack.push(under);
        return "";
    }

    #integerStep(local, operator) {
        const name = this.#locals.name(local);
        return `${name} = ((${name} | 0) ${operator} 1) | 0;`;
    }

    // `hasnext2` also updates the index register, so it goes through a temporary.
    #hasNext2([objectRegister, indexRegister]) {
        const state = `_t${this.#temporaries++}`;
        const object = this.#locals.name(objectRegister);
        const index = this.#locals.name(indexRegister);
        this.#stack.push(`${state}[1]`);
        return `${state} = domain.__hasNext2(${object}, ${index});\n${index} = ${state}[0];`;
    }

    // hasnext, nextname, nextvalue: (object, index) -> value.
    #iterate(helper) {
        const index = this.#stack.pop();
        const object = this.#stack.pop();
        return this.#push(`${helper}(${object}, ${index})`);
    }

    #newObject(count) {
        const entries = [];
        for (let index = 0; index < count; index++) {
            const value = this.#stack.pop();
            const key = this.#stack.pop();
            // AS3 allows any expression as a key; a plain `key: value` only
            // survives when the key is an identifier or a literal string.
            const readable = /^[A-Za-z_$][\w$]*$|^"[^"\\]*"$|^'[^'\\]*'$/.test(key);
            entries.unshift(`${readable ? key : `[${key}]`}: ${value}`);
        }
        return this.#push(`{ ${entries.join(", ")} }`);
    }
}

export default InstructionTranslator;
