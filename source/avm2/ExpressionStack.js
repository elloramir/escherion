// The AVM2 operand stack, replayed symbolically. Instead of runtime values it
// holds JavaScript expression strings, so a stack instruction sequence becomes
// a tree of expressions rather than slots in an array.
class ExpressionStack {

    #items = [];

    get depth() {
        return this.#items.length;
    }

    push(expression) {
        this.#items.push(expression);
    }

    pop() {
        if (this.#items.length === 0) {
            throw new Error("ExpressionStack: pop on an empty stack");
        }
        return this.#items.pop();
    }

    // Removes and returns the top `count` items in stack order (deepest first).
    popMany(count) {
        const values = new Array(count);
        for (let i = count - 1; i >= 0; i--) values[i] = this.pop();
        return values;
    }

    // A copy of the whole stack, deepest first, for materializing it into slots.
    toArray() {
        return [...this.#items];
    }
}

export default ExpressionStack;
