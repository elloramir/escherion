import Opcode from "../abc/code/Opcode.js";
import Opcodes from "./Opcodes.js";
import SourceWriter from "./SourceWriter.js";
import ControlFlowGraph from "./ControlFlowGraph.js";
import ControlFlowEmitter from "./ControlFlowEmitter.js";
import ExceptionRegions from "./ExceptionRegions.js";
import InstructionTranslator from "./InstructionTranslator.js";
import Locals from "./Locals.js";
import StackDepths from "./StackDepths.js";

const O = Opcode;

// Translates one AVM2 method body to JavaScript. A body without branches keeps
// the natural expression form; a body with control flow is rebuilt as structured
// statements by ControlFlowEmitter, which asks this class for the statements and
// terminator of each basic block.
class MethodTranspiler {

    #abc;
    #body;
    #linker;
    #pool;
    #locals;
    #translator;
    #receiver;
    #hoistSuper = false;
    #constructorMode = false;
    #graph = null;

    constructor(abcFile, methodBody, options = {}) {
        this.#body = methodBody;
        this.#pool = abcFile.constantPool;
        this.#locals = new Locals(abcFile.methods[methodBody.methodIndex] ?? null, methodBody, abcFile.constantPool);
        this.#receiver = options.receiver ?? "this";
        this.#abc = abcFile;
        this.#linker = options.linker ?? null;
    }

    writeInto(writer, options = {}) {
        const { name, kind } = options;
        const isStatic = options.static ?? false;
        const parameters = this.#locals.parameterNames();

        this.#constructorMode = kind === "constructor";
        this.#hoistSuper = this.#constructorMode
            && this.#body.instructions.some((i) => i.opcode === O.CONSTRUCTSUPER && i.operands[0] === 0);
        this.#translator = new InstructionTranslator(this.#abc, this.#locals, this.#linker, {
            receiver: this.#receiver,
            hoistSuper: this.#hoistSuper,
        });

        // Build into a scratch writer so an unsupported method never leaves a
        // half-written block in the caller; on success it is adopted in place.
        const scratch = new SourceWriter();
        if (this.#hasControlFlow()) {
            const body = () => {
                if (this.#constructorMode) scratch.line("super();");
                this.#writeStructured(scratch);
            };
            this.#open(scratch, name, kind, isStatic, parameters, body);
        } else {
            const lines = this.#translateLinear();
            if (this.#hoistSuper) lines.unshift("super();");
            const body = () => {
                this.#declare(scratch, 0);
                for (const line of lines) scratch.line(line);
            };
            this.#open(scratch, name, kind, isStatic, parameters, body);
        }
        writer.adopt(scratch);
        return writer;
    }

    #open(writer, name, kind, isStatic, parameters, body) {
        switch (kind) {
            case "getter": return writer.getter(name, body, isStatic);
            case "setter": return writer.setter(name, parameters, body, isStatic);
            case "constructor": return writer.constructorMethod(parameters, body);
            default: return writer.method(name, parameters, body, isStatic);
        }
    }

    #hasControlFlow() {
        if (this.#body.exceptions.length > 0) return true;
        return this.#body.instructions.some((instruction) => {
            const code = instruction.opcode;
            return Opcodes.isConditional(code) || code === O.JUMP || code === O.LOOKUPSWITCH;
        });
    }

    #declare(writer, slotCount) {
        if (this.#translator.usesScope) writer.line("const _scope = [];");
        const line = this.#locals.declaration(slotCount, this.#translator.temporaryCount);
        if (line) writer.line(line);
    }

    #translateLinear() {
        const lines = [];
        for (const instruction of this.#body.instructions) {
            for (const line of this.#translator.translate(instruction).split("\n")) {
                if (line) lines.push(line);
            }
        }
        return lines;
    }

    #writeStructured(writer) {
        const instructions = this.#body.instructions;
        const graph = new ControlFlowGraph(this.#body);
        this.#graph = graph;
        const offsetToIndex = new Map(instructions.map((instruction, index) => [instruction.offset, index]));
        const depths = StackDepths.of(this.#body, this.#pool, offsetToIndex);
        const exceptions = ExceptionRegions.of(this.#body, graph, this.#pool);
        const entryDepth = (block) => {
            const data = graph.blocks[block];
            return data ? depths[data.start] ?? 0 : 0;
        };

        // Emit the body first so the temporaries it created are known, then
        // declare locals, temporaries and stack slots above it.
        const body = new SourceWriter();
        new ControlFlowEmitter(graph, (block, incoming) => this.#translateBlock(block, incoming), exceptions, entryDepth)
            .emit(body);
        this.#declare(writer, Math.max(0, ...depths.filter((depth) => depth !== undefined)));
        writer.adopt(body);
    }

    // Turns one basic block into statement lines plus its terminator, rebuilding
    // the operand stack from the seed expressions its predecessors leave.
    #translateBlock(blockIndex, incoming) {
        const graph = this.#graph;
        const block = graph.blocks[blockIndex];
        if (!block) throw new Error(`MethodTranspiler: bad block index ${blockIndex}`);

        const translator = this.#translator;
        translator.begin(incoming);

        const instructions = this.#body.instructions;
        const last = instructions[block.end - 1];
        const endsWithTerminator = graph.isTerminal(last.opcode);
        const limit = endsWithTerminator ? block.end - 1 : block.end;
        const lines = [];
        for (let index = block.start; index < limit; index++) {
            for (const line of translator.translate(instructions[index]).split("\n")) {
                if (line) lines.push(line);
            }
        }

        const term = endsWithTerminator
            ? this.#terminator(last, block)
            : { type: "fallthrough", target: graph.blockOfInstruction.get(block.end) };
        return { lines, term, stack: translator.stack.toArray() };
    }

    #terminator(instruction, block) {
        const graph = this.#graph;
        const stack = this.#translator.stack;
        const code = instruction.opcode;
        const blockAt = (offset, fromStart) => graph.blockOfInstruction.get(
            graph.instructionTarget(instruction, offset, fromStart)
        );
        if (code === O.JUMP) {
            return { type: "jump", target: blockAt(instruction.operands[0], false) };
        }
        if (Opcodes.isConditional(code)) {
            const { cond, negated } = this.#translator.operators.condition(instruction);
            return {
                type: "branch",
                cond,
                negated,
                taken: blockAt(instruction.operands[0], false),
                other: graph.blockOfInstruction.get(block.end),
            };
        }
        if (code === O.LOOKUPSWITCH) {
            const key = stack.pop();
            const [defaultOffset, ...caseOffsets] = instruction.operands;
            return {
                type: "switch",
                block: block.index,
                key,
                defaultTarget: blockAt(defaultOffset, true),
                cases: caseOffsets.map((offset) => blockAt(offset, true)),
            };
        }
        if (code === O.RETURNVOID) return { type: "return" };
        if (code === O.RETURNVALUE) return { type: "return", value: stack.pop() };
        if (code === O.THROW) return { type: "throw", value: stack.pop() };
        return { type: "fallthrough", target: graph.blockOfInstruction.get(block.end) };
    }
}

export default MethodTranspiler;
