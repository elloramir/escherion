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
        // With several exits, prefer the single one that continues into the
        // enclosing code (the others terminate with return/throw): that is where
        // `break` lands, even when the whole loop's post-dominator is the graph
        // exit (an inner loop whose only non-return exit re-enters an outer loop).
        const exits = [...loop.exits];
        const continuing = exits.filter((exit) => (successors[exit]?.length ?? 0) > 0);
        if (exits.length === 1) loop.follow = exits[0];
        else if (continuing.length === 1) loop.follow = continuing[0];
        else loop.follow = immediatePostDominator[header];
    }
}

export default NaturalLoops;
