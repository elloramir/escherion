import TextEvent from "../flash/events/TextEvent.js";
import Event from "../flash/events/Event.js";

const BACKSPACE = 8;
const ENTER = 13;
const DELETE = 46;

// Turns a key press into an edit of a focused input TextField, dispatching the
// textInput and change events Flash does.
class TextEditor {

    #dispatch;

    // `dispatch(target, EventClass, type, fields)` delivers an event to a display object.
    constructor(dispatch) {
        this.#dispatch = dispatch;
    }

    edit(field, event, charCode) {
        const text = String(field.text ?? "");
        const caret = Number(field.selectionEndIndex);
        const position = Number.isFinite(caret) && caret >= 0 && caret <= text.length ? caret : text.length;
        const keyCode = Number(event.keyCode) || 0;
        if (keyCode === BACKSPACE) {
            if (position <= 0) return;
            this.#writeField(field, text.slice(0, position - 1) + text.slice(position), position - 1);
            this.#dispatch(field, Event, "change");
            return;
        }
        if (keyCode === DELETE) {
            if (position >= text.length) return;
            this.#writeField(field, text.slice(0, position) + text.slice(position + 1), position);
            this.#dispatch(field, Event, "change");
            return;
        }
        if (keyCode === ENTER) {
            if (field.multiline === true) this.#insertField(field, "\n", position);
            return;
        }
        if (charCode > 31 && charCode !== 127) {
            const character = String.fromCharCode(charCode);
            if (passesRestrict(field.restrict, character)) this.#insertField(field, character, position);
        }
    }

    #insertField(field, character, position) {
        const maxChars = field.maxChars;
        const text = String(field.text ?? "");
        if (maxChars !== null && maxChars !== undefined && text.length + character.length > Number(maxChars)) return;
        this.#writeField(field, text.slice(0, position) + character + text.slice(position), position + character.length);
        this.#dispatch(field, TextEvent, "textInput", { text: character });
        this.#dispatch(field, Event, "change");
    }

    #writeField(field, text, caret) {
        field.text = text;
        field.setSelection(caret, caret);
    }
}

function passesRestrict(restrict, character) {
    if (restrict === null || restrict === undefined || restrict === "") return true;
    const pattern = String(restrict);
    const negated = pattern.startsWith("^");
    const body = negated ? pattern.slice(1) : pattern;
    const allowed = new Set();
    for (let index = 0; index < body.length; index++) {
        if (body[index + 1] === "-" && index + 2 < body.length) {
            const end = body.charCodeAt(index + 2);
            for (let code = body.charCodeAt(index); code <= end; code++) allowed.add(String.fromCharCode(code));
            index += 2;
        } else {
            allowed.add(body[index]);
        }
    }
    return negated ? !allowed.has(character) : allowed.has(character);
}

export default TextEditor;
