import MouseEvent from "../flash/events/MouseEvent.js";
import KeyboardEvent from "../flash/events/KeyboardEvent.js";
import FocusEvent from "../flash/events/FocusEvent.js";
import TextEvent from "../flash/events/TextEvent.js";
import Event from "../flash/events/Event.js";
import TextField from "../flash/text/TextField.js";
import DisplayObject from "../flash/display/DisplayObject.js";
import HitTest from "./HitTest.js";
import TextEditor from "./TextEditor.js";

const TAB = 9;

// Routes DOM pointer/keyboard input onto the live display tree: hit-tests the
// cursor, dispatches MouseEvent/FocusEvent/KeyboardEvent/TextEvent, drives
// SimpleButton states and turns typing into TextField edits.
class Input {

    #stage;
    #canvas;
    #hitTest;
    #editor = new TextEditor((target, Class, type, fields) => this.#dispatch(target, Class, type, fields));
    #pressed = null;
    #hovered = null;
    #focus = null;
    #mouse = { x: 0, y: 0 };
    #down = false;
    #bound = false;
    #handlers = {};

    constructor(stage, canvas, renderer) {
        this.#stage = stage;
        this.#canvas = canvas;
        this.#hitTest = new HitTest(stage, renderer);
    }

    attach() {
        const canvas = this.#canvas;
        if (!canvas || this.#bound) return this;
        const win = typeof window !== "undefined" ? window : canvas;
        const on = (target, type, handler) => target.addEventListener(type, handler);
        this.#handlers = {
            move: (event) => this.#onMove(this.#localPoint(event)),
            down: (event) => this.#onDown(this.#localPoint(event), event),
            up: (event) => this.#onUp(this.#localPoint(event)),
            leave: () => this.#setHover(null),
            keydown: (event) => this.#onKeyDown(event),
            keyup: (event) => this.#onKeyUp(event),
        };
        on(canvas, "mousemove", this.#handlers.move);
        on(canvas, "mousedown", this.#handlers.down);
        on(win, "mouseup", this.#handlers.up);
        on(canvas, "mouseleave", this.#handlers.leave);
        on(win, "keydown", this.#handlers.keydown);
        on(win, "keyup", this.#handlers.keyup);
        this.#bound = true;
        return this;
    }

    detach() {
        if (!this.#bound) return;
        const canvas = this.#canvas;
        const win = typeof window !== "undefined" ? window : canvas;
        canvas.removeEventListener("mousemove", this.#handlers.move);
        canvas.removeEventListener("mousedown", this.#handlers.down);
        win.removeEventListener("mouseup", this.#handlers.up);
        canvas.removeEventListener("mouseleave", this.#handlers.leave);
        win.removeEventListener("keydown", this.#handlers.keydown);
        win.removeEventListener("keyup", this.#handlers.keyup);
        this.#bound = false;
    }

    // Re-picks the hover target so UI appearing under a still pointer reacts.
    refreshHover() {
        if (!this.#stage || this.#down) return;
        this.#setHover(this.#hitTest.pick(this.#mouse.x, this.#mouse.y));
    }


    #localPoint(event) {
        const canvas = this.#canvas;
        if (!canvas?.getBoundingClientRect) return { x: event.clientX ?? 0, y: event.clientY ?? 0 };
        const rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        if (rect.width > 0) x *= canvas.width / rect.width;
        if (rect.height > 0) y *= canvas.height / rect.height;
        return { x, y };
    }

    #setPointer(point) {
        this.#mouse = point;
        this.#stage.pointer = point;
    }


    #onMove(point) {
        this.#setPointer(point);
        const target = this.#hitTest.pick(point.x, point.y);
        this.#dispatch(target, MouseEvent, "mouseMove", this.#fields(target));
        this.#setHover(target);
    }

    #onDown(point, event) {
        this.#setPointer(point);
        this.#down = true;
        const target = this.#hitTest.pick(point.x, point.y);
        this.#pressed = target;
        this.#dispatch(target, MouseEvent, "mouseDown", this.#fields(target, true));
        this.#applyButtonState(target, "down");
        if (target instanceof TextField && target.type === "input" && target.selectable !== false) {
            this.#setFocus(target);
            const end = String(target.text ?? "").length;
            target.setSelection(end, end);
        } else if (this.#focus && this.#focus !== target) {
            this.#setFocus(null);
        }
        if (event?.preventDefault && target instanceof TextField) event.preventDefault();
    }

    #onUp(point) {
        this.#setPointer(point);
        this.#down = false;
        const target = this.#hitTest.pick(point.x, point.y);
        this.#dispatch(target, MouseEvent, "mouseUp", this.#fields(target));
        if (this.#pressed && this.#pressed === target) {
            this.#dispatch(target, MouseEvent, "click", this.#fields(target));
        }
        this.#pressed = null;
        this.#setHover(target);
    }

    #setHover(target) {
        if (target === this.#hovered) {
            this.#applyButtonState(target, this.#down ? "down" : "over");
            return;
        }
        const previous = this.#hovered;
        this.#hovered = target;
        // A button the pointer left goes back to its up state.
        const left = this.#buttonFor(previous);
        if (left && left !== this.#buttonFor(target)) left.__setState("up");
        const previousChain = this.#ancestry(previous);
        const targetChain = this.#ancestry(target);
        if (previous) {
            this.#dispatch(previous, MouseEvent, "mouseOut", this.#fields(previous));
            for (const node of previousChain) {
                if (!targetChain.includes(node)) {
                    this.#dispatch(node, MouseEvent, "rollOut", this.#fields(node, false, false));
                }
            }
        }
        if (target) {
            this.#dispatch(target, MouseEvent, "mouseOver", this.#fields(target));
            for (let index = targetChain.length - 1; index >= 0; index--) {
                const node = targetChain[index];
                if (!previousChain.includes(node)) {
                    this.#dispatch(node, MouseEvent, "rollOver", this.#fields(node, false, false));
                }
            }
        }
        this.#applyButtonState(target, this.#down ? "down" : "over");
        this.#updateCursor(target);
    }

    #updateCursor(target) {
        if (!this.#canvas?.style) return;
        const button = this.#buttonFor(target);
        if (button) {
            this.#canvas.style.cursor = button.useHandCursor !== false ? "pointer" : "default";
            return;
        }
        this.#canvas.style.cursor = this.#textFieldFor(target) ? "text" : "default";
    }

    // The editable text field under the target (a field is its own hit object).
    #textFieldFor(target) {
        for (let node = target, guard = 0; node && guard < 256; guard++) {
            if (node instanceof TextField && node.selectable !== false && node.type === "input") return node;
            node = node.parent;
        }
        return null;
    }


    #buttonFor(target) {
        for (let node = target, guard = 0; node && guard < 256; guard++) {
            if (typeof node.__setState === "function" && node.upState !== undefined) return node;
            node = node.parent;
        }
        return null;
    }

    #applyButtonState(target, state) {
        if (state === "over" && this.#down) state = "down";
        const from = this.#buttonFor(target);
        if (from && typeof from.__setState === "function") from.__setState(state);
    }

    #ancestry(node) {
        const chain = [];
        for (let guard = 0; node && guard < 256; guard++) {
            chain.push(node);
            node = node.parent;
        }
        return chain;
    }


    #onKeyDown(event) {
        if (!this.#stage) return;
        const target = this.#focus ?? this.#stage;
        const charCode = charCodeOf(event);
        this.#dispatch(target, KeyboardEvent, "keyDown", {
            charCode,
            keyCode: event.keyCode ?? 0,
            ctrlKey: event.ctrlKey === true,
            altKey: event.altKey === true,
            shiftKey: event.shiftKey === true,
        });
        const field = this.#focus;
        if (field instanceof TextField && field.type === "input" && field.selectable !== false) {
            if (event.keyCode === TAB || (event.key === "Tab")) {
                // let the browser move focus on; nothing to edit
            } else {
                if (event.preventDefault) event.preventDefault();
                this.#editor.edit(field, event, charCode);
            }
        }
    }

    #onKeyUp(event) {
        if (!this.#stage) return;
        const target = this.#focus ?? this.#stage;
        this.#dispatch(target, KeyboardEvent, "keyUp", {
            charCode: charCodeOf(event),
            keyCode: event.keyCode ?? 0,
            ctrlKey: event.ctrlKey === true,
            altKey: event.altKey === true,
            shiftKey: event.shiftKey === true,
        });
    }

    #setFocus(target) {
        const next = target ?? null;
        if (next === this.#focus) {
            if (this.#stage) this.#stage.focus = next;
            return next;
        }
        const previous = this.#focus;
        this.#focus = next;
        if (this.#stage) this.#stage.focus = next;
        if (previous) this.#dispatch(previous, FocusEvent, "focusOut", { relatedObject: next });
        if (next) this.#dispatch(next, FocusEvent, "focusIn", { relatedObject: previous });
        return next;
    }


    #fields(target, buttonDown = this.#down, bubbles = true) {
        const x = this.#mouse.x;
        const y = this.#mouse.y;
        let localX = x;
        let localY = y;
        if (target) {
            const inverse = DisplayObject.invertMatrix(DisplayObject.worldMatrix(target));
            localX = x * inverse.a + y * inverse.c + inverse.tx;
            localY = x * inverse.b + y * inverse.d + inverse.ty;
        }
        return { localX, localY, stageX: x, stageY: y, bubbles, buttonDown: Boolean(buttonDown) };
    }

    #dispatch(target, Class, type, fields = {}) {
        if (!target) return null;
        const event = Class === MouseEvent
            ? new MouseEvent(type, fields.bubbles !== false, false, fields.localX ?? 0, fields.localY ?? 0, fields.relatedObject ?? null, fields.ctrlKey === true, fields.altKey === true, fields.shiftKey === true, fields.buttonDown === true, fields.delta ?? 0)
            : Class === KeyboardEvent
                ? new KeyboardEvent(type, true, false, fields.charCode ?? 0, fields.keyCode ?? 0, 0, fields.ctrlKey === true, fields.altKey === true, fields.shiftKey === true)
                : Class === FocusEvent
                    ? new FocusEvent(type, true, false, fields.relatedObject ?? null, false, 0)
                    : Class === TextEvent
                        ? new TextEvent(type, true, false, fields.text ?? "")
                        : new Event(type, true, false);
        try {
            target.dispatchEvent(event);
        } catch (error) {
            console.warn(`[input] '${type}' listener failed:`, error?.message ?? error);
        }
        return event;
    }
}



function charCodeOf(event) {
    if (typeof event.key === "string" && event.key.length === 1) return event.key.charCodeAt(0);
    const keyCode = Number(event.keyCode) || 0;
    return keyCode >= 32 && keyCode <= 126 ? keyCode : 0;
}


export default Input;
