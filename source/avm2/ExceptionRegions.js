import Opcode from "../abc/code/Opcode.js";
import Names from "./Names.js";

// The try/catch regions of a method as block ranges of its control flow graph:
// where the protected code starts and ends, and where its handler starts and ends.
class ExceptionRegions {

    static of(body, graph, pool) {
        return body.exceptions.map((exception) => {
            const blockOf = (offset) => graph.blockOfInstruction.get(graph.instructionIndexOf(offset));
            const tryStart = blockOf(exception.from);
            const tryEnd = blockOf(exception.to) ?? graph.exit;
            const handlerStart = blockOf(exception.target);

            // A handler ends where the jump closing the protected range lands.
            const closing = body.instructions[graph.instructionIndexOf(exception.to)];
            let handlerEnd = graph.exit;
            if (closing && closing.opcode === Opcode.JUMP) {
                const index = graph.instructionTarget(closing, closing.operands[0], false);
                handlerEnd = graph.blockOfInstruction.get(index) ?? graph.exit;
            }

            const name = exception.varNameIndex ? Names.simpleNameOf(pool, exception.varNameIndex) : "e";
            return { tryStart, tryEnd, handlerStart, handlerEnd, variable: Names.toIdentifier(name) };
        });
    }
}

export default ExceptionRegions;
