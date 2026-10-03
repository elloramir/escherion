// flash.events.EventDispatcher. Listeners are
// stored per instance and invoked synchronously; display objects additionally
// walk `parent` for the capture and bubble phases.
class EventDispatcher {

    #listeners = new Map();

    constructor() {
    }

    addEventListener(type, listener, useCapture = false, priority = 0, useWeakReference = false) {
        if (typeof listener !== "function") return;
        let list = this.#listeners.get(type);
        if (!list) {
            list = [];
            this.#listeners.set(type, list);
        }
        const capture = Boolean(useCapture);
        const matches = (entry) => entry.listener === listener && entry.useCapture === capture;
        if (list.some(matches)) return;
        list.push({ listener, useCapture: capture, priority });
    }

    removeEventListener(type, listener, useCapture = false) {
        const list = this.#listeners.get(type);
        if (!list) return;
        const capture = Boolean(useCapture);
        const matches = (entry) => entry.listener === listener && entry.useCapture === capture;
        const index = list.findIndex(matches);
        if (index !== -1) list.splice(index, 1);
    }

    hasEventListener(type) {
        const list = this.#listeners.get(type);
        return Boolean(list && list.length > 0);
    }

    willTrigger(type) {
        return this.hasEventListener(type);
    }

    // Fast probes for the frame loop.
    hasNativeListener(type) {
        const list = this.#listeners.get(type);
        return list !== undefined && list.length > 0;
    }

    hasAnyNativeListener() {
        return this.#listeners.size > 0;
    }

    dispatchEvent(event) {
        if (!event) return true;

        // Capture walks root -> target, bubble target -> root.
        const path = [];
        let node = this;
        while (node) {
            path.push(node);
            node = node.parent ?? null;
        }
        path.reverse();

        event.target = this;
        event.cancelBubble = false;
        event.stopImmediate = false;

        event.eventPhase = 1;
        for (let index = 0; index < path.length - 1; index++) {
            this.#dispatchTo(path[index], event, true);
            if (event.cancelBubble === true) break;
        }

        if (event.cancelBubble !== true) {
            event.eventPhase = 2;
            this.#dispatchTo(this, event, null);
        }

        if (event.bubbles === true && event.cancelBubble !== true) {
            event.eventPhase = 3;
            for (let index = path.length - 2; index >= 0; index--) {
                this.#dispatchTo(path[index], event, false);
                if (event.cancelBubble === true) break;
            }
        }

        event.eventPhase = 0;
        return event.defaultPrevented !== true;
    }

    // `capture` is true for the capture phase, false for bubble, null for the target phase.
    #dispatchTo(node, event, capture) {
        if (!(node instanceof EventDispatcher)) return;
        const list = node.#listeners.get(event.type);
        if (!list || list.length === 0) return;

        event.currentTarget = node;
        for (const entry of [...list]) {
            if (capture !== null && entry.useCapture !== capture) continue;
            try {
                entry.listener.call(node, event);
            } catch (error) {
                const reason = error?.message ?? error;
                console.warn(`[flash.events] '${event.type}' listener failed: ${reason}`);
                if (error?.stack) console.warn(error.stack);
            }
            if (event.stopImmediate === true) break;
        }
    }
}

export default EventDispatcher;
