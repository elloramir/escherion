import Event from "./Event.js";

// flash.events.KeyboardEvent.
class KeyboardEvent extends Event {

    static KEY_DOWN = "keyDown";
    static KEY_UP = "keyUp";

    constructor(
        type,
        bubbles = true, cancelable = false,
        charCode = 0, keyCode = 0, keyLocation = 0,
        ctrlKey = false, altKey = false, shiftKey = false,
    ) {
        super(type, bubbles, cancelable);
        this.charCode = charCode;
        this.keyCode = keyCode;
        this.keyLocation = keyLocation;
        this.ctrlKey = ctrlKey;
        this.altKey = altKey;
        this.shiftKey = shiftKey;
    }

    updateAfterEvent() {}
}

export default KeyboardEvent;
