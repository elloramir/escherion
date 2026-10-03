import InteractiveObject from "./InteractiveObject.js";
import Event from "../events/Event.js";

const CHILD_ERROR = "ArgumentError: The supplied DisplayObject must be a child of the caller.";

// flash.display.DisplayObjectContainer. The
// child list is the scene graph the WebGL renderer walks; lifecycle events are
// dispatched exactly as Flash does.
class DisplayObjectContainer extends InteractiveObject {

    constructor() {
        super();
        this.children = [];
        this.mouseChildren = true;
        this.tabChildren = true;
    }

    get numChildren() {
        return this.children.length;
    }

    addChild(child) {
        return this.#addChildAt(child, this.children.length);
    }

    addChildAt(child, index) {
        return this.#addChildAt(child, index);
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index < 0) throw new Error(CHILD_ERROR);
        return this.#removeChildAt(index);
    }

    removeChildAt(index) {
        return this.#removeChildAt(index);
    }

    getChildAt(index) {
        return this.children[index] ?? null;
    }

    getChildIndex(child) {
        const index = this.children.indexOf(child);
        if (index < 0) throw new Error(CHILD_ERROR);
        return index;
    }

    setChildIndex(child, index) {
        const current = this.children.indexOf(child);
        if (current < 0) throw new Error(CHILD_ERROR);
        if (index < 0 || index >= this.children.length) {
            throw new RangeError(`RangeError: index ${index} out of range.`);
        }
        if (current === index) return;
        this.children.splice(current, 1);
        this.children.splice(index, 0, child);
    }

    getChildByName(name) {
        return this.children.find((child) => child.name === name) ?? null;
    }

    contains(child) {
        let node = child;
        while (node) {
            if (node === this) return true;
            node = node.parent;
        }
        return false;
    }

    swapChildren(child1, child2) {
        const index1 = this.children.indexOf(child1);
        const index2 = this.children.indexOf(child2);
        if (index1 < 0 || index2 < 0) {
            throw new Error(CHILD_ERROR);
        }
        this.children[index1] = child2;
        this.children[index2] = child1;
    }

    swapChildrenAt(index1, index2) {
        const count = this.children.length;
        if (index1 < 0 || index1 >= count || index2 < 0 || index2 >= count) {
            throw new RangeError("RangeError: A supplied index is out of range.");
        }
        const first = this.children[index1];
        this.children[index1] = this.children[index2];
        this.children[index2] = first;
    }

    // AQW patches MovieClip.prototype.removeAllChildren and calls it.
    removeAllChildren() {
        for (let index = this.children.length - 1; index >= 0; index--) this.#removeChildAt(index);
    }

    removeChildren(beginIndex = 0, endIndex = 2147483647) {
        const end = Math.min(endIndex, this.children.length - 1);
        const removed = this.children.splice(beginIndex, end - beginIndex + 1);
        for (const child of removed) {
            const wasOnStage = DisplayObjectContainer.isOnStage(child);
            this.#dispatchTree(child, Event.REMOVED, true);
            child.parent = null;
            if (wasOnStage) this.#dispatchTree(child, Event.REMOVED_FROM_STAGE, false);
        }
    }

    getObjectsUnderPoint() {
        return [];
    }

    areInaccessibleObjectsUnderPoint() {
        return false;
    }

    toString() {
        return "[object DisplayObjectContainer]";
    }

    static isOnStage(node) {
        let current = node;
        while (current) {
            if (current.isStage === true) return true;
            current = current.parent;
        }
        return false;
    }

    #addChildAt(child, index) {
        if (!child) throw new Error("TypeError: Parameter child must be non-null.");
        if (index < 0 || index > this.children.length) {
            throw new RangeError(`RangeError: index ${index} out of range.`);
        }
        const oldParent = child.parent;
        if (oldParent) {
            const oldIndex = oldParent.children.indexOf(child);
            if (oldIndex !== -1) oldParent.children.splice(oldIndex, 1);
        }
        this.children.splice(index, 0, child);
        child.parent = this;
        this.#dispatchTree(child, Event.ADDED, true);
        if (DisplayObjectContainer.isOnStage(this)) {
            this.#dispatchTree(child, Event.ADDED_TO_STAGE, false);
        }
        return child;
    }

    #removeChildAt(index) {
        if (index < 0 || index >= this.children.length) {
            throw new RangeError(`RangeError: index ${index} out of range.`);
        }
        const [removed] = this.children.splice(index, 1);
        const wasOnStage = DisplayObjectContainer.isOnStage(removed);
        this.#dispatchTree(removed, Event.REMOVED, true);
        removed.parent = null;
        if (wasOnStage) this.#dispatchTree(removed, Event.REMOVED_FROM_STAGE, false);
        return removed;
    }

    // Depth-first dispatch of one lifecycle event over a whole subtree.
    #dispatchTree(node, type, bubbles) {
        if (!node) return;
        if (typeof node.dispatchEvent === "function") {
            try {
                node.dispatchEvent(new Event(type, bubbles));
            } catch (error) {
                const reason = error?.message ?? error;
                console.warn(`[flash.display] '${type}' listener failed: ${reason}`);
            }
        }
        if (Array.isArray(node.children)) {
            for (const child of [...node.children]) this.#dispatchTree(child, type, bubbles);
        }
    }
}

export default DisplayObjectContainer;
