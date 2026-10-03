// flash.events.Event. A plain JS class. Constants and field defaults match the AS3 class.
const CONSTANTS = {
    ACTIVATE: "activate",
    ADDED: "added",
    ADDED_TO_STAGE: "addedToStage",
    CANCEL: "cancel",
    CHANGE: "change",
    CLOSE: "close",
    COMPLETE: "complete",
    CONNECT: "connect",
    CONTEXT3D_CREATE: "context3DCreate",
    DEACTIVATE: "deactivate",
    DISPLAYING: "displaying",
    ENTER_FRAME: "enterFrame",
    EXIT_FRAME: "exitFrame",
    FRAME_CONSTRUCTED: "frameConstructed",
    FRAME_LABEL: "frameLabel",
    FULLSCREEN: "fullScreen",
    ID3: "id3",
    INIT: "init",
    MOUSE_LEAVE: "mouseLeave",
    OPEN: "open",
    REMOVED: "removed",
    REMOVED_FROM_STAGE: "removedFromStage",
    RENDER: "render",
    RESIZE: "resize",
    SCROLL: "scroll",
    SELECT: "select",
    SOUND_COMPLETE: "soundComplete",
    TAB_CHILDREN_CHANGE: "tabChildrenChange",
    TAB_ENABLED_CHANGE: "tabEnabledChange",
    TAB_INDEX_CHANGE: "tabIndexChange",
    TEXT_INTERACTION_MODE_CHANGE: "textInteractionModeChange",
    UNLOAD: "unload",
};

class Event {

    constructor(type, bubbles = false, cancelable = false) {
        this.type = type ?? null;
        this.bubbles = bubbles;
        this.cancelable = cancelable;
        this.target = null;
        this.currentTarget = null;
        this.eventPhase = 0;
        this.defaultPrevented = false;
        this.cancelBubble = false;
        this.stopImmediate = false;
    }

    preventDefault() {
        this.defaultPrevented = true;
    }

    stopPropagation() {
        this.cancelBubble = true;
    }

    stopImmediatePropagation() {
        this.cancelBubble = true;
        this.stopImmediate = true;
    }

    isDefaultPrevented() {
        return this.defaultPrevented === true;
    }

    clone() {
        return new Event(this.type, this.bubbles, this.cancelable);
    }

    formatToString(className, ...names) {
        const parts = names.map((name) => `${name}=${this[name]}`);
        return `[${className} ${parts.join(" ")}]`;
    }

    toString() {
        return `[Event type="${this.type}" bubbles=${this.bubbles} cancelable=${this.cancelable}]`;
    }
}

Object.assign(Event, CONSTANTS);

export default Event;
