import AbcReader from "../AbcReader.js";
import Opcode from "./Opcode.js";
import OperandKind from "./OperandKind.js";
import InstructionShape from "./InstructionShape.js";
import Instruction from "./Instruction.js";

const U8_OPERAND_KINDS = new Set([
    OperandKind.U8_SCOPE_INDEX,
    OperandKind.U8_DEBUG_TYPE, OperandKind.U8_REGISTER_INDEX
]);

// Decodes a method body's raw code bytes into a flat instruction list. Produces
// no control-flow graph; that is the runtime's job, built from this same list.
class CodeReader {

    static decode(code) {
        const reader = new AbcReader(code);
        const instructions = [];
        while (reader.bytesLeft > 0) {
            const offset = reader.position;
            const opcode = reader.readUI8();
            const operands = opcode === Opcode.LOOKUPSWITCH
                ? CodeReader.#readLookupSwitchOperands(reader)
                : CodeReader.#readOperands(reader, opcode);
            const length = reader.position - offset;
            instructions.push(new Instruction(offset, opcode, operands, length));
        }

        const offsetToIndex = new Map();
        instructions.forEach((instruction, index) => {
            offsetToIndex.set(instruction.offset, index);
        });

        CodeReader.#assertBranchTargetsAreValid(instructions, offsetToIndex);

        return { instructions, offsetToIndex };
    }

    static #readOperands(reader, opcode) {
        const kinds = InstructionShape.operandKindsFor(opcode);
        return kinds.map((kind) => {
            if (U8_OPERAND_KINDS.has(kind)) {
                return reader.readUI8();
            }
            if (kind === OperandKind.S24_BRANCH_OFFSET) {
                return reader.readS24();
            }
            if (kind === OperandKind.S32_RAW_VALUE) {
                // pushshort's operand is a signed 32-bit value; reading it as u30
                // turned -1 into 4294967295 and broke `indexOf(...) == -1`.
                return reader.readS32();
            }
            if (kind === OperandKind.S8_BYTE_VALUE) {
                // pushbyte's operand is an 8-bit value sign-extended to int; reading
                // 0xff as 255 turned the `indexOf(...) == -1` sentinel into 255 and
                // dropped the map's `maps/` prefix.
                return (reader.readUI8() << 24) >> 24;
            }
            return reader.readU30();
        });
    }

    // lookupswitch carries a variable operand count: default_offset (s24), then
    // case_count (u30), then case_count + 1 s24 case offsets. All offsets are
    // relative to the lookupswitch opcode, unlike other branches (relative to the
    // position right after them). Flattened as [defaultOffset, ...caseOffsets].
    static #readLookupSwitchOperands(reader) {
        const defaultOffset = reader.readS24();
        const caseCount = reader.readU30();
        const operands = [defaultOffset];
        for (let i = 0; i < caseCount + 1; i++) {
            operands.push(reader.readS24());
        }
        return operands;
    }

    // Every branch target must land exactly on an instruction boundary. A target
    // landing mid-instruction means InstructionShape is wrong for some opcode and
    // the stream has desynced.
    static #assertBranchTargetsAreValid(instructions, offsetToIndex) {
        for (const instruction of instructions) {
            if (instruction.opcode === Opcode.LOOKUPSWITCH) {
                for (const caseOffset of instruction.operands) {
                    CodeReader.#assertTarget(instruction, instruction.offset + caseOffset, offsetToIndex);
                }
                continue;
            }
            const kinds = InstructionShape.operandKindsFor(instruction.opcode);
            const branchOperandPosition = kinds.indexOf(OperandKind.S24_BRANCH_OFFSET);
            if (branchOperandPosition === -1) continue;
            const branchOffset = instruction.operands[branchOperandPosition];
            const target = instruction.offset + instruction.length + branchOffset;
            CodeReader.#assertTarget(instruction, target, offsetToIndex);
        }
    }

    static #assertTarget(instruction, target, offsetToIndex) {
        if (!offsetToIndex.has(target)) {
            // Obfuscated/dead-code branches can point into the middle of an
            // instruction. The verifier only rejects such a method if the branch is
            // reachable, so throwing here made every method containing one unusable;
            // taking the branch still fails at runtime.
            instruction.invalidTarget = target;
        }
    }
}

export default CodeReader;
