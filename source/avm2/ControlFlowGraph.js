import Opcode from "../abc/code/Opcode.js";
import Opcodes from "./Opcodes.js";
import Dominators from "./Dominators.js";
import NaturalLoops from "./NaturalLoops.js";

const O = Opcode;

// Basic blocks of one method and the graph between them: successors and
// predecessors, dominators, post-dominators and natural loops.
// The graph is built from instruction offsets; exception targets are block
// leaders because the AST uses them as catch handler entries.
class ControlFlowGraph {

    blocks = [];
    blockOfInstruction = new Map();
    successors = [];
    predecessors = [];
    dominators = [];
    postDominators = [];
    ipdom = [];
    loops = new Map();
    entry = 0;
    exit = 0;

    #instructions;
    #offsetToIndex;
    #exceptions;

    constructor(body) {
        this.#instructions = body.instructions;
        this.#offsetToIndex = new Map(
            this.#instructions.map((instruction, index) => [instruction.offset, index])
        );
        this.#exceptions = body.exceptions;
        this.#buildBlocks();
        this.#buildEdges();
        this.exceptionEdges = this.#exceptionEdges();
        this.exit = this.blocks.length;
        this.#computeDominators();
        this.#computePostDominators();
        this.#findLoops();
    }

    get instructions() {
        return this.#instructions;
    }

    instructionIndexOf(offset) {
        return this.#offsetToIndex.get(offset);
    }

    instructionTarget(instruction, offset, fromStart) {
        const target = fromStart
            ? instruction.offset + offset
            : instruction.offset + instruction.length + offset;
        return this.#offsetToIndex.get(target);
    }

    isTerminal(opcode) {
        return Opcodes.isConditional(opcode) || opcode === O.JUMP || opcode === O.LOOKUPSWITCH
            || Opcodes.isReturn(opcode) || opcode === O.THROW;
    }

    #buildBlocks() {
        const leaders = new Set([0]);
        this.#instructions.forEach((instruction, index) => {
            const code = instruction.opcode;
            if (Opcodes.isConditional(code)) {
                leaders.add(this.instructionTarget(instruction, instruction.operands[0], false));
                leaders.add(index + 1);
            } else if (code === O.JUMP) {
                leaders.add(this.instructionTarget(instruction, instruction.operands[0], false));
                leaders.add(index + 1);
            } else if (code === O.LOOKUPSWITCH) {
                const [defaultOffset, ...caseOffsets] = instruction.operands;
                leaders.add(this.instructionTarget(instruction, defaultOffset, true));
                for (const offset of caseOffsets) {
                    leaders.add(this.instructionTarget(instruction, offset, true));
                }
                leaders.add(index + 1);
            } else if (this.isTerminal(code)) {
                leaders.add(index + 1);
            }
        });
        for (const exception of this.#exceptions) {
            leaders.add(this.#offsetToIndex.get(exception.from));
            leaders.add(this.#offsetToIndex.get(exception.to));
            leaders.add(this.#offsetToIndex.get(exception.target));
        }

        const points = [...leaders]
            .filter((point) => point !== undefined && point <= this.#instructions.length)
            .sort((a, b) => a - b);

        for (let k = 0; k < points.length; k++) {
            const start = points[k];
            const end = k + 1 < points.length ? points[k + 1] : this.#instructions.length;
            if (start >= end) continue;
            const index = this.blocks.length;
            this.blocks.push({ index, start, end });
            const exists = this.blockOfInstruction.has(start);
            if (!exists) for (let i = start; i < end; i++) this.blockOfInstruction.set(i, index);
        }
    }

    #successorsOfBlock(block) {
        const last = this.#instructions[block.end - 1];
        const code = last.opcode;
        const targets = [];
        if (Opcodes.isConditional(code)) {
            targets.push(this.instructionTarget(last, last.operands[0], false));
            targets.push(block.end);
        } else if (code === O.JUMP) {
            targets.push(this.instructionTarget(last, last.operands[0], false));
        } else if (code === O.LOOKUPSWITCH) {
            const [defaultOffset, ...caseOffsets] = last.operands;
            targets.push(this.instructionTarget(last, defaultOffset, true));
            for (const offset of caseOffsets) {
                targets.push(this.instructionTarget(last, offset, true));
            }
        } else if (!Opcodes.isReturn(code) && code !== O.THROW
            && block.end < this.#instructions.length) {
            targets.push(block.end);
        }
        const blocks = targets.map((index) => this.blockOfInstruction.get(index));
        return [...new Set(blocks.filter((index) => index !== undefined))];
    }

    #buildEdges() {
        for (const block of this.blocks) {
            const successors = this.#successorsOfBlock(block);
            this.successors[block.index] = successors;
            this.predecessors[block.index] = [];
        }
        for (const block of this.blocks) {
            for (const successor of this.successors[block.index]) {
                this.predecessors[successor].push(block.index);
            }
        }
    }

    // `from` reaches the handler only when it throws, so the edge is not part of
    // the normal control flow the structurer follows; it only makes handler
    // blocks reachable so dominators and post-dominators are correct.
    #exceptionEdges() {
        const edges = [];
        for (const exception of this.#exceptions) {
            const from = this.blockOfInstruction.get(this.#offsetToIndex.get(exception.from));
            const handler = this.blockOfInstruction.get(this.#offsetToIndex.get(exception.target));
            if (from !== undefined && handler !== undefined) edges.push([from, handler]);
        }
        return edges;
    }

    // Dominators over the normal edges plus the exception edges, which only
    // make handler blocks reachable.
    #computeDominators() {
        const inputs = this.predecessors.map((list) => [...list]);
        const outputs = this.successors.map((list) => [...list]);
        for (const [from, handler] of this.exceptionEdges) {
            inputs[handler].push(from);
            outputs[from].push(handler);
        }
        const reachable = Dominators.reachable(outputs, this.entry);
        this.dominators = Dominators.compute(this.blocks.length, this.entry, inputs, reachable);
    }

    // Post-dominators: dominators of the reversed graph, rooted at a synthetic
    // exit node that every returning or throwing block flows into.
    #computePostDominators() {
        const nodeCount = this.blocks.length + 1;
        const forward = Array.from({ length: nodeCount }, () => []);
        for (const block of this.blocks) {
            forward[block.index] = this.successors[block.index].length > 0
                ? [...this.successors[block.index]]
                : [this.exit];
        }
        for (const [from, handler] of this.exceptionEdges) forward[from].push(handler);

        const back = Array.from({ length: nodeCount }, () => []);
        for (let node = 0; node < nodeCount; node++) {
            for (const successor of forward[node]) back[successor].push(node);
        }
        const canReachExit = Dominators.reachable(back, this.exit);
        this.postDominators = Dominators.compute(nodeCount, this.exit, forward, canReachExit);
        this.ipdom = Dominators.immediate(this.postDominators, this.exit);
    }

    #findLoops() {
        this.loops = NaturalLoops.find(this.successors, this.predecessors, this.dominators, this.ipdom);
    }
}

export default ControlFlowGraph;
