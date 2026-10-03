import Opcode from "../abc/code/Opcode.js";
import Names from "./Names.js";

const O = Opcode;

const CONDITIONALS = new Set([
    O.IFTRUE, O.IFFALSE, O.IFEQ, O.IFNE, O.IFLT, O.IFLE, O.IFGT, O.IFGE,
    O.IFSTRICTEQ, O.IFSTRICTNE, O.IFNLT, O.IFNLE, O.IFNGT, O.IFNGE,
]);
const RETURNS = new Set([O.RETURNVOID, O.RETURNVALUE]);

// One table per opcode shape, so each opcode's name, operand layout and stack
// effect live in a single place. `InstructionShape` (the parser) stays the
// authority for operand encoding; everything the VM-side needs is derived here.
//
// `CALLS` and `NAMED` are parameterized effects: their pop count depends on an
// operand (arg count / multiname) rather than a constant.
const STACK_EFFECTS = new Map([
    // no effect
    [O.NOP, [0, 0]], [O.LABEL, [0, 0]], [O.DEBUG, [0, 0]], [O.DEBUGLINE, [0, 0]],
    [O.DEBUGFILE, [0, 0]], [O.DXNS, [0, 0]], [O.POPSCOPE, [0, 0]],
    [O.INCLOCAL, [0, 0]], [O.INCLOCAL_I, [0, 0]], [O.DECLOCAL, [0, 0]], [O.DECLOCAL_I, [0, 0]],
    // constants and literals
    [O.PUSHBYTE, [0, 1]], [O.PUSHSHORT, [0, 1]], [O.PUSHINT, [0, 1]], [O.PUSHUINT, [0, 1]],
    [O.PUSHDOUBLE, [0, 1]], [O.PUSHSTRING, [0, 1]], [O.PUSHTRUE, [0, 1]], [O.PUSHFALSE, [0, 1]],
    [O.PUSHNULL, [0, 1]], [O.PUSHUNDEFINED, [0, 1]], [O.PUSHNAN, [0, 1]], [O.PUSHNAMESPACE, [0, 1]],
    // operand stack
    [O.POP, [1, 0]], [O.DUP, [1, 2]], [O.SWAP, [2, 2]],
    // locals
    [O.GETLOCAL, [0, 1]], [O.SETLOCAL, [1, 0]],
    [O.GETLOCAL0, [0, 1]], [O.GETLOCAL1, [0, 1]], [O.GETLOCAL2, [0, 1]], [O.GETLOCAL3, [0, 1]],
    [O.SETLOCAL0, [1, 0]], [O.SETLOCAL1, [1, 0]], [O.SETLOCAL2, [1, 0]], [O.SETLOCAL3, [1, 0]],
    [O.KILL, [0, 0]],
    // arithmetic and bitwise (binary then unary)
    [O.ADD, [2, 1]], [O.SUBTRACT, [2, 1]], [O.MULTIPLY, [2, 1]],
    [O.DIVIDE, [2, 1]], [O.MODULO, [2, 1]],
    [O.ADD_I, [2, 1]], [O.SUBTRACT_I, [2, 1]], [O.MULTIPLY_I, [2, 1]],
    [O.LSHIFT, [2, 1]], [O.RSHIFT, [2, 1]], [O.URSHIFT, [2, 1]],
    [O.BITAND, [2, 1]], [O.BITOR, [2, 1]], [O.BITXOR, [2, 1]],
    [O.BITNOT, [1, 1]], [O.NEGATE, [1, 1]], [O.NEGATE_I, [1, 1]],
    [O.INCREMENT, [1, 1]], [O.INCREMENT_I, [1, 1]], [O.DECREMENT, [1, 1]], [O.DECREMENT_I, [1, 1]],
    // comparison
    [O.EQUALS, [2, 1]], [O.STRICTEQUALS, [2, 1]], [O.LESSTHAN, [2, 1]], [O.LESSEQUALS, [2, 1]],
    [O.GREATERTHAN, [2, 1]], [O.GREATEREQUALS, [2, 1]], [O.NOT, [1, 1]], [O.IN, [2, 1]],
    [O.INSTANCEOF, [2, 1]], [O.ISTYPE, [1, 1]], [O.ISTYPELATE, [2, 1]],
    // branches and returns
    [O.JUMP, [0, 0]], [O.IFTRUE, [1, 0]], [O.IFFALSE, [1, 0]], [O.LOOKUPSWITCH, [1, 0]],
    [O.IFEQ, [2, 0]], [O.IFNE, [2, 0]], [O.IFLT, [2, 0]], [O.IFLE, [2, 0]],
    [O.IFGT, [2, 0]], [O.IFGE, [2, 0]], [O.IFSTRICTEQ, [2, 0]], [O.IFSTRICTNE, [2, 0]],
    [O.IFNLT, [2, 0]], [O.IFNLE, [2, 0]], [O.IFNGT, [2, 0]], [O.IFNGE, [2, 0]],
    [O.RETURNVOID, [0, 0]], [O.RETURNVALUE, [1, 0]], [O.THROW, [1, 0]],
    // conversion and coercion
    [O.COERCE, [1, 1]], [O.COERCE_A, [1, 1]], [O.COERCE_S, [1, 1]],
    [O.CONVERT_I, [1, 1]], [O.CONVERT_U, [1, 1]], [O.CONVERT_D, [1, 1]], [O.CONVERT_B, [1, 1]],
    [O.CONVERT_S, [1, 1]], [O.CONVERT_O, [1, 1]],
    [O.ASTYPE, [1, 1]], [O.ASTYPELATE, [2, 1]], [O.TYPEOF, [1, 1]],
    [O.ESC_XELEM, [1, 1]], [O.ESC_XATTR, [1, 1]], [O.CHECKFILTER, [1, 1]],
    // scope
    [O.PUSHSCOPE, [1, 0]], [O.PUSHWITH, [1, 0]], [O.GETSCOPEOBJECT, [0, 1]],
    [O.GETGLOBALSCOPE, [0, 1]], [O.DXNSLATE, [1, 0]],
    [O.NEXTNAME, [2, 1]], [O.NEXTVALUE, [2, 1]], [O.HASNEXT, [2, 1]], [O.HASNEXT2, [0, 1]],
    // multiname lookups and slots
    [O.FINDPROPERTY, [0, 1]], [O.FINDPROPSTRICT, [0, 1]], [O.GETLEX, [0, 1]],
    [O.GETSLOT, [1, 1]], [O.SETSLOT, [2, 0]], [O.GETGLOBALSLOT, [0, 1]], [O.SETGLOBALSLOT, [1, 0]],
    // object construction (fixed arity)
    [O.NEWCLASS, [1, 1]], [O.NEWFUNCTION, [0, 1]], [O.NEWACTIVATION, [0, 1]], [O.NEWCATCH, [0, 1]],
]);

// [argc operand index, pushes, extra pops besides args and receiver]
const CALLS = new Map([
    [O.CALL, [0, 1, 1]], [O.CONSTRUCT, [0, 1, 0]], [O.CONSTRUCTSUPER, [0, 0, 0]],
    [O.CONSTRUCTGENERICTYPE, [0, 1, 0]], [O.CALLMETHOD, [1, 1, 0]], [O.CALLSTATIC, [1, 1, 0]],
    [O.CALLPROPERTY, [1, 1, 0]], [O.CALLPROPLEX, [1, 1, 0]], [O.CALLPROPVOID, [1, 0, 0]],
    [O.CALLSUPER, [1, 1, 0]], [O.CALLSUPERVOID, [1, 0, 0]], [O.CONSTRUCTPROP, [1, 1, 0]],
]);

// [multiname operand index, extra pops, pushes]; a runtime name/namespace adds pops.
const NAMED = new Map([
    [O.GETPROPERTY, [0, 1, 1]], [O.SETPROPERTY, [0, 2, 0]], [O.INITPROPERTY, [0, 2, 0]],
    [O.DELETEPROPERTY, [0, 1, 1]], [O.GETSUPER, [0, 1, 1]], [O.SETSUPER, [0, 2, 0]],
    [O.GETDESCENDANTS, [0, 1, 1]],
]);

// What the transpiler knows about each AVM2 opcode: its mnemonic and its
// operand-stack effect, plus the control-flow opcode groups.
class Opcodes {

    static isConditional(code) {
        return CONDITIONALS.has(code);
    }

    static isReturn(code) {
        return RETURNS.has(code);
    }

    static mnemonicFor(code) {
        return Opcode.mnemonicFor(code);
    }

    // Real pops/pushes for one instruction, resolving the variable-arity calls
    // and the runtime name/namespace pops of property opcodes. Returns null for
    // an opcode this table does not model.
    static effectFor(instruction, constantPool) {
        const code = instruction.opcode;
        const fixed = STACK_EFFECTS.get(code);
        if (fixed) {
            return { pops: fixed[0], pushes: fixed[1] };
        }
        const call = CALLS.get(code);
        if (call) {
            const argc = instruction.operands[call[0]];
            const runtime = call[0] === 1 && code !== O.CALLMETHOD && code !== O.CALLSTATIC
                ? Opcodes.#runtimePops(instruction.operands[0], constantPool)
                : 0;
            return { pops: argc + 1 + call[2] + runtime, pushes: call[1] };
        }
        const named = NAMED.get(code);
        if (named) {
            const runtime = Opcodes.#runtimePops(instruction.operands[named[0]], constantPool);
            return { pops: named[1] + runtime, pushes: named[2] };
        }
        if (code === O.NEWOBJECT) {
            return { pops: instruction.operands[0] * 2, pushes: 1 };
        }
        if (code === O.NEWARRAY) {
            return { pops: instruction.operands[0], pushes: 1 };
        }
        return null;
    }

    static #runtimePops(multinameIndex, constantPool) {
        let pops = 0;
        if (Names.hasRuntimeName(constantPool, multinameIndex)) pops++;
        if (Names.hasRuntimeNamespace(constantPool, multinameIndex)) pops++;
        return pops;
    }
}

export default Opcodes;
