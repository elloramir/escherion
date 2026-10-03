import Event from "./Event.js";

// flash.events.IOErrorEvent.
class IOErrorEvent extends Event {

    static IO_ERROR = "ioError";

    constructor(type, bubbles = false, cancelable = false, text = "") {
        super(type, bubbles, cancelable);
        this.text = text;
    }

    clone() {
        return new IOErrorEvent(this.type, this.bubbles, this.cancelable, this.text);
    }
}

export default IOErrorEvent;
