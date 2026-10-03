import Event from "./Event.js";

// flash.events.TextEvent.
class TextEvent extends Event {

    static TEXT_INPUT = "textInput";
    static LINK = "link";

    constructor(type, bubbles = false, cancelable = false, text = "") {
        super(type, bubbles, cancelable);
        this.text = text;
    }
}

export default TextEvent;
