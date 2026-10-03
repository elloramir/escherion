// Dominator sets by the classic iterative data-flow algorithm. A node's set is
// itself plus the intersection of its inputs' sets, repeated until stable.
// Post-dominators are the same computation on the reversed graph, so both use
// `compute` and differ only in which edges they feed in.
class Dominators {

    // `inputs[node]` lists the nodes that flow into `node` in the direction
    // being analysed. Inputs that `reachable` rejects are ignored, so dead
    // blocks do not constrain the intersection. Returns one Set per node.
    static compute(nodeCount, root, inputs, reachable) {
        const all = new Set(Array.from({ length: nodeCount }, (_, index) => index));
        const dominators = Array.from({ length: nodeCount }, () => new Set(all));
        dominators[root] = new Set([root]);
        let changed = true;
        while (changed) {
            changed = false;
            for (let node = 0; node < nodeCount; node++) {
                if (node === root) continue;
                let next = null;
                for (const input of inputs[node] ?? []) {
                    if (!reachable.has(input)) continue;
                    const set = dominators[input];
                    next = next === null
                        ? new Set(set)
                        : new Set([...next].filter((entry) => set.has(entry)));
                }
                next = next ?? new Set();
                next.add(node);
                if (!Dominators.#same(next, dominators[node])) {
                    dominators[node] = next;
                    changed = true;
                }
            }
        }
        return dominators;
    }

    // The closest strict dominator of each node, or undefined for the root.
    static immediate(dominators, root) {
        const immediate = new Array(dominators.length).fill(undefined);
        for (let node = 0; node < dominators.length; node++) {
            if (node === root) continue;
            let candidate = null;
            for (const entry of dominators[node]) {
                if (entry === node) continue;
                // `entry` dominates `candidate` -> `entry` is the closer one.
                if (candidate === null || dominators[entry].has(candidate)) candidate = entry;
            }
            immediate[node] = candidate ?? undefined;
        }
        return immediate;
    }

    // Nodes reachable from `root` by following `edges[node]`.
    static reachable(edges, root) {
        const seen = new Set([root]);
        const stack = [root];
        while (stack.length > 0) {
            for (const next of edges[stack.pop()] ?? []) {
                if (!seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            }
        }
        return seen;
    }

    static #same(a, b) {
        if (a.size !== b.size) return false;
        for (const value of a) if (!b.has(value)) return false;
        return true;
    }
}

export default Dominators;
