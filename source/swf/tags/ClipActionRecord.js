const KEY_PRESS_BIT = 1 << 9;

// CLIPACTIONRECORD: one event handler within a CLIPACTIONS block. The action
// bytecode belongs to the legacy AVM1 ACTIONRECORD format and is kept opaque,
// since this loader only targets ActionScript 3.0 content.
class ClipActionRecord {

    #eventFlags;
    #keyCode;
    #actions;

    constructor(eventFlags, keyCode, actions) {
        this.#eventFlags = eventFlags;
        this.#keyCode = keyCode;
        this.#actions = actions;
    }

    get eventFlags() {
        return this.#eventFlags;
    }

    get keyCode() {
        return this.#keyCode;
    }

    get actions() {
        return this.#actions;
    }

    static read(reader, eventFlags) {
        const actionRecordSize = reader.readUI32();
        const hasKeyCode = Boolean(eventFlags & KEY_PRESS_BIT);
        const keyCode = hasKeyCode ? reader.readUI8() : null;
        const actionsLength = actionRecordSize - (hasKeyCode ? 1 : 0);
        const actions = reader.readBytes(actionsLength);
        return new ClipActionRecord(eventFlags, keyCode, actions);
    }
}

export default ClipActionRecord;
