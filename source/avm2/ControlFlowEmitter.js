import Opcodes from "./Opcodes.js";

// Rebuilds structured statements from a control-flow graph, the way a
// decompiler does: a conditional block becomes `if/else` between its two
// successors and their immediate post-dominator (the join), a back edge becomes a
// `while`, a switch dispatches to its cases, and an exception range becomes
// `try/catch`. Edges that leave the region become `break`/`continue`.
//
// Operand-stack values that are live across a join (the shape of `&&`, `||` and
// the ternary operator) cannot be named by either branch, so they are written
// into numbered slots on each incoming path and read back at the join.
class ControlFlowEmitter {

    #graph;
    #translate;
    #entryDepth;
    #emitter;
    #exceptions;
    #active = new Set();
    #activeLoops = new Set();
    #depth = 0;

    constructor(graph, translate, exceptions, entryDepth) {
        this.#graph = graph;
        this.#translate = translate;
        this.#exceptions = exceptions;
        this.#entryDepth = entryDepth;
    }

    emit(emitter) {
        this.#emitter = emitter;
        this.#region(this.#graph.entry, this.#graph.exit, null);
    }

    // Emits the region from `entry` up to `follow`, returning the operand-stack
    // expressions live at `follow`, or null when control left the region.
    #region(entry, follow, loop, seed = []) {
        if (this.#depth++ > 300) throw new Error("ControlFlowEmitter: recursion limit (irreducible)");
        try {
            return this.#regionBody(entry, follow, loop, seed);
        } finally {
            this.#depth--;
        }
    }

    #regionBody(entry, follow, loop, seed) {
        const exit = this.#graph.exit;
        const seen = new Set();
        let block = entry;
        let stack = seed;
        while (block !== undefined && block !== null && block !== follow && block !== exit) {
            if (seen.has(block)) throw new Error("ControlFlowEmitter: irreducible control flow");
            seen.add(block);
            const exception = this.#exceptionStartingAt(block);
            if (exception) {
                this.#emitTry(exception, loop, stack);
                block = this.#transfer(exception.handlerEnd, follow, loop);
                if (block === null) return null;
                stack = this.#materialize(block, []);
                continue;
            }
            const loopHere = this.#graph.loops.get(block);
            if (loopHere && !this.#activeLoops.has(loopHere)) {
                this.#emitLoop(loopHere, loop, stack);
                block = this.#transfer(loopHere.follow, follow, loop);
                if (block === null) return null;
                stack = this.#materialize(block, []);
                continue;
            }

            const result = this.#translate(block, stack);
            for (const line of result.lines) this.#emitter.line(line);
            stack = result.stack;

            const term = result.term;
            if (term.type === "return") {
                this.#emitter.line(term.value === undefined ? "return;" : `return ${term.value};`);
                return null;
            }
            if (term.type === "throw") {
                this.#emitter.line(`throw ${term.value};`);
                return null;
            }
            if (term.type === "branch") {
                return this.#emitBranch(block, term, follow, loop, stack);
            }
            if (term.type === "switch") {
                return this.#emitSwitch(term, follow, loop, stack);
            }

            const target = term.target;
            if (target === follow || target === undefined) return stack;
            const redirected = this.#transfer(target, follow, loop);
            if (redirected === null) return null;
            stack = this.#materialize(redirected, stack);
            block = redirected;
        }
        return stack;
    }

    #emitBranch(block, term, follow, loop, stack) {
        const join = this.#graph.ipdom[block];
        const target = join === undefined ? follow : join;
        // Values the branch carries to its join were produced before the branch
        // (a shared receiver like `findpropstrict`), so write them to their slots
        // once here; otherwise only one arm would assign them and the join could
        // read a slot left undefined by the other arm.
        const seed = this.#carry(target, stack);
        const arm = (armBlock) => this.#arm(armBlock, target, loop, seed);

        if (term.taken === join) {
            this.#emitter.line(`if (${term.negated}) {`);
            this.#emitter.indent();
            arm(term.other);
            this.#emitter.dedent();
            this.#emitter.line("}");
        } else if (term.other === join) {
            this.#emitter.line(`if (${term.cond}) {`);
            this.#emitter.indent();
            arm(term.taken);
            this.#emitter.dedent();
            this.#emitter.line("}");
        } else {
            this.#emitter.line(`if (${term.cond}) {`);
            this.#emitter.indent();
            arm(term.taken);
            this.#emitter.dedent();
            this.#emitter.line("} else {");
            this.#emitter.indent();
            arm(term.other);
            this.#emitter.dedent();
            this.#emitter.line("}");
        }

        // With one arm inlined, the other path falls through to the join. Inside a
        // `while (true)` that join is the loop's exit, so the fall-through would
        // wrongly loop again: it has to be a `break`.
        const implicitToJoin = term.taken === join || term.other === join;
        if (implicitToJoin && loop && (target === loop.follow || loop.exits.has(target))) {
            this.#emitter.line("break;");
        }

        if (target === follow || target === this.#graph.exit) return this.#slots(target);
        const next = this.#transfer(target, follow, loop);
        if (next === null) return null;
        return this.#region(next, follow, loop, this.#slots(target));
    }

    #emitSwitch(term, follow, loop, stack) {
        const join = this.#graph.ipdom[term.block] ?? follow;
        this.#emitter.line(`switch (${term.key}) {`);
        this.#emitter.indent();
        term.cases.forEach((target, value) => {
            this.#emitter.line(`case ${value}:`);
            this.#emitter.indent();
            this.#arm(target, join, loop, stack);
            this.#emitter.line("break;");
            this.#emitter.dedent();
        });
        this.#emitter.line("default:");
        this.#emitter.indent();
        this.#arm(term.defaultTarget, join, loop, stack);
        this.#emitter.line("break;");
        this.#emitter.dedent();
        this.#emitter.dedent();
        this.#emitter.line("}");

        if (join === follow || join === this.#graph.exit) return this.#slots(join);
        const next = this.#transfer(join, follow, loop);
        if (next === null) return null;
        return this.#region(next, follow, loop, this.#slots(join));
    }

    #emitLoop(loop, outerLoop, stack) {
        if (stack.length !== 0) throw new Error("loop carries an operand stack");
        const graph = this.#graph;
        const header = graph.blocks[loop.header];
        const last = graph.instructions[header.end - 1];
        const follow = loop.follow;

        if (Opcodes.isConditional(last.opcode)) {
            const { lines, term } = this.#translate(loop.header, []);
            const takenOut = this.#leaves(loop, term.taken, follow);
            const otherOut = this.#leaves(loop, term.other, follow);
            const body = takenOut ? term.other : term.taken;
            const stay = takenOut ? term.negated : term.cond;
            if (lines.length === 0 && takenOut !== otherOut && loop.nodes.has(body)) {
                this.#emitter.line(`while (${stay}) {`);
                this.#emitter.indent();
                this.#activeLoops.add(loop);
                this.#region(body, follow, loop, []);
                this.#activeLoops.delete(loop);
                this.#emitter.dedent();
                this.#emitter.line("}");
                return;
            }
        }

        this.#emitter.line("while (true) {");
        this.#emitter.indent();
        this.#activeLoops.add(loop);
        this.#region(loop.header, follow, loop, []);
        this.#activeLoops.delete(loop);
        this.#emitter.dedent();
        this.#emitter.line("}");
    }

    #emitTry(exception, loop, stack) {
        this.#emitter.line("try {");
        this.#emitter.indent();
        this.#active.add(exception);
        this.#region(exception.tryStart, exception.tryEnd, loop, stack);
        this.#active.delete(exception);
        this.#emitter.dedent();
        this.#emitter.line(`} catch (${exception.variable}) {`);
        this.#emitter.indent();
        this.#region(exception.handlerStart, exception.handlerEnd, loop, [exception.variable]);
        this.#emitter.dedent();
        this.#emitter.line("}");
    }

    // Emits one branch arm. An arm that is the loop header or a loop exit is a
    // `continue`/`break`, not a nested region, which is what keeps loops finite.
    #arm(block, target, loop, stack) {
        if (loop && block === loop.header) {
            this.#emitter.line("continue;");
            return;
        }
        if (loop && loop.exits.has(block)) {
            this.#emitter.line("break;");
            return;
        }
        const result = this.#region(block, target, loop, stack);
        if (result !== null && result !== undefined && target !== this.#graph.exit) {
            this.#materialize(target, result);
        }
    }

    // Writes the bottom `depth` values a branch carries to its join into slot
    // names before the branch is emitted; any values above `depth` are consumed
    // inside the arms and stay as their expressions.
    #carry(block, stack) {
        const depth = block === undefined ? 0 : this.#entryDepth(block);
        for (let index = depth - 1; index >= 0; index--) {
            const expression = stack[index];
            const slot = `_s${index}`;
            if (expression !== undefined && expression !== slot) {
                this.#emitter.line(`${slot} = ${expression};`);
            }
        }
        const seed = [];
        for (let index = 0; index < stack.length; index++) {
            seed.push(index < depth ? `_s${index}` : stack[index]);
        }
        return seed;
    }

    // Writes `stack` into the slot names of the block that is entered next. A
    // block with a single predecessor keeps the expressions; a join reads slots.
    #materialize(block, stack) {
        const depth = this.#entryDepth(block);
        if (depth === 0) {
            if (stack.length > 0) {
                throw new Error(`ControlFlowEmitter: stack carried into block ${block}`);
            }
            return [];
        }
        const slots = this.#slots(block);
        for (let index = depth - 1; index >= 0; index--) {
            const expression = stack[index];
            if (expression !== undefined && expression !== slots[index]) {
                this.#emitter.line(`${slots[index]} = ${expression};`);
            }
        }
        return slots;
    }

    #slots(block) {
        const depth = block === undefined ? 0 : this.#entryDepth(block);
        const slots = [];
        for (let index = 0; index < depth; index++) slots.push(`_s${index}`);
        return slots;
    }

    #transfer(block, follow, loop) {
        if (block === undefined || block === null) return null;
        if (block === follow || block === this.#graph.exit) return null;
        if (loop && block === loop.header) {
            this.#emitter.line("continue;");
            return null;
        }
        if (loop && loop.exits.has(block)) {
            this.#emitter.line("break;");
            return null;
        }
        return block;
    }

    #leaves(loop, block, follow) {
        return block === follow || block === this.#graph.exit || loop.exits.has(block);
    }

    #exceptionStartingAt(block) {
        const match = this.#exceptions.find((exception) => exception.tryStart === block);
        return match && !this.#active.has(match) ? match : null;
    }
}

export default ControlFlowEmitter;
