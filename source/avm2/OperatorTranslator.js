import Opcode from "../abc/code/Opcode.js";

const O = Opcode;

const COMPARISONS = new Map([
    [O.IFEQ, "=="], [O.IFNE, "!="], [O.IFLT, "<"], [O.IFLE, "<="],
    [O.IFGT, ">"], [O.IFGE, ">="], [O.IFSTRICTEQ, "==="], [O.IFSTRICTNE, "!=="],
]);
const INVERSES = new Map([
    ["==", "!="], ["!=", "=="], ["<", ">="], ["<=", ">"], [">", "<="], [">=", "<"],
    ["===", "!=="], ["!==", "==="],
]);
// `ifnlt` and friends: branch when the comparison does not hold.
const NEGATED_COMPARISONS = new Map([
    [O.IFNLT, "<"], [O.IFNLE, "<="], [O.IFNGT, ">"], [O.IFNGE, ">="],
]);

// Operators on the expression stack: binary operators and the conditions of
// the conditional branch opcodes.
class OperatorTranslator {

    #stack;

    constructor(stack) {
        this.#stack = stack;
    }

    // `integer` forces both operands through `| 0`, as AVM2's int operators do.
    binary(symbol, integer = false) {
        const right = this.#stack.pop();
        const left = this.#stack.pop();
        const a = integer ? `(${left} | 0)` : left;
        const b = integer ? `(${right} | 0)` : right;
        this.#stack.push(`(${a} ${symbol} ${b})`);
        return "";
    }

    // The condition of a conditional branch, and its negation, as JS expressions.
    condition(instruction) {
        const code = instruction.opcode;
        if (code === O.IFTRUE) {
            const value = this.#stack.pop();
            return { cond: value, negated: `!(${value})` };
        }
        if (code === O.IFFALSE) {
            const value = this.#stack.pop();
            return { cond: `!(${value})`, negated: value };
        }
        const right = this.#stack.pop();
        const left = this.#stack.pop();
        if (COMPARISONS.has(code)) {
            const operator = COMPARISONS.get(code);
            const inverse = INVERSES.get(operator);
            return { cond: `(${left} ${operator} ${right})`, negated: `(${left} ${inverse} ${right})` };
        }
        if (NEGATED_COMPARISONS.has(code)) {
            const positive = `(${left} ${NEGATED_COMPARISONS.get(code)} ${right})`;
            return { cond: `!${positive}`, negated: positive };
        }
        throw new Error(`MethodTranspiler: no condition for ${instruction.mnemonic}`);
    }
}

export default OperatorTranslator;
