import Opcode from "../abc/code/Opcode.js";
import Opcodes from "./Opcodes.js";

const O = Opcode;

// Operand-stack depth at the start of every instruction, found by walking the
// control flow from the entry (depth 0) and from each exception handler
// (depth 1: the caught value). Every path into an instruction must agree.
class StackDepths {

    // Returns an array indexed by instruction; unreachable instructions are undefined.
    static of(body, pool, offsetToIndex) {
        const instructions = body.instructions;
        const depths = new Array(instructions.length).fill(undefined);
        const work = [];
        const visit = (index, depth) => {
            if (index === undefined || index < 0 || index >= instructions.length) return;
            if (depths[index] === undefined) {
                depths[index] = depth;
                work.push(index);
            } else if (depths[index] !== depth) {
                throw new Error(`MethodTranspiler: inconsistent depth at ${index}`);
            }
        };
        const targetOf = (instruction, offset, fromStart) => offsetToIndex.get(
            fromStart ? instruction.offset + offset : instruction.offset + instruction.length + offset
        );

        visit(0, 0);
        for (const exception of body.exceptions) {
            visit(offsetToIndex.get(exception.target), 1);
        }
        while (work.length > 0) {
            const index = work.pop();
            const instruction = instructions[index];
            const effect = Opcodes.effectFor(instruction, pool);
            if (!effect) throw new Error(`MethodTranspiler: no effect for ${instruction.mnemonic}`);
            if (depths[index] < effect.pops) {
                throw new Error(`MethodTranspiler: underflow at ${index}`);
            }
            const depth = depths[index] - effect.pops + effect.pushes;
            const code = instruction.opcode;
            if (Opcodes.isReturn(code) || code === O.THROW) continue;
            if (code === O.LOOKUPSWITCH) {
                const [defaultOffset, ...caseOffsets] = instruction.operands;
                visit(targetOf(instruction, defaultOffset, true), depth);
                for (const offset of caseOffsets) visit(targetOf(instruction, offset, true), depth);
                continue;
            }
            if (Opcodes.isConditional(code)) {
                visit(targetOf(instruction, instruction.operands[0], false), depth);
            }
            if (code === O.JUMP) {
                visit(targetOf(instruction, instruction.operands[0], false), depth);
                continue;
            }
            visit(index + 1, depth);
        }
        return depths;
    }
}

export default StackDepths;
