// Natural loops of a control flow graph: every back edge (an edge into a node
// that dominates its source) defines a loop headed by its target.
class NaturalLoops {

    // Returns Map(header block -> { header, nodes, latches, exits, follow }).
    // `follow` is the block control reaches after the loop.
    static find(successors, predecessors, dominators, immediatePostDominator) {
        const loops = new Map();
        for (let node = 0; node < successors.length; node++) {
            for (const successor of successors[node]) {
                if (dominators[node].has(successor)) {
                    NaturalLoops.#add(loops, successor, node, successors, predecessors, immediatePostDominator);
                }
            }
        }
        return loops;
    }

    static #add(loops, header, latch, successors, predecessors, immediatePostDominator) {
        const loop = loops.get(header) ?? {
            header,
            nodes: new Set([header]),
            latches: new Set(),
            exits: new Set(),
        };
        loop.latches.add(latch);
        const stack = [latch];
        while (stack.length > 0) {
            const node = stack.pop();
            if (loop.nodes.has(node)) continue;
            loop.nodes.add(node);
            for (const predecessor of predecessors[node]) stack.push(predecessor);
        }
        loops.set(header, loop);
        loop.exits = new Set();
        for (const node of loop.nodes) {
            for (const successor of successors[node]) {
                if (!loop.nodes.has(successor)) loop.exits.add(successor);
            }
        }
        // The post-dominator of the header can land inside the loop when the
        // exit test is nested; the loop's own exit edge is the real follow.
        loop.follow = loop.exits.size === 1 ? [...loop.exits][0] : immediatePostDominator[header];
    }
}

export default NaturalLoops;
