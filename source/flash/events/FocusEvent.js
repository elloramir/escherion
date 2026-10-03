import Event from "./Event.js";

// flash.events.FocusEvent.
class FocusEvent extends Event {

    static FOCUS_IN = "focusIn";
    static FOCUS_OUT = "focusOut";
    static KEY_FOCUS_CHANGE = "keyFocusChange";
    static MOUSE_FOCUS_CHANGE = "mouseFocusChange";

    constructor(type, bubbles = true, cancelable = false, relatedObject = null, shiftKey = false, keyCode = 0) {
        super(type, bubbles, cancelable);
        this.relatedObject = relatedObject;
        this.shiftKey = shiftKey;
        this.keyCode = keyCode;
    }
}

export default FocusEvent;
