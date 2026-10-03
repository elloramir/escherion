import Opcode from "./Opcode.js";

// One decoded AVM2 instruction. Byte offset and length are kept even though the
// interpreter mostly wants instruction indices, because ffdec's p-code output
// (the M2 verification oracle) is offset-addressed.
class Instruction {

    // Execution handler cached by the interpreter; undefined until first run.
    handler = undefined;

    #offset;
    #opcode;
    #operands;
    #length;

    constructor(offset, opcode, operands, length) {
        this.#offset = offset;
        this.#opcode = opcode;
        this.#operands = operands;
        this.#length = length;
    }

    get offset() {
        return this.#offset;
    }

    get opcode() {
        return this.#opcode;
    }

    get operands() {
        return this.#operands;
    }

    get length() {
        return this.#length;
    }

    get mnemonic() {
        return Opcode.mnemonicFor(this.#opcode);
    }
}

export default Instruction;
