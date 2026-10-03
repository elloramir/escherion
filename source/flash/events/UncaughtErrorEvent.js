import Event from "./Event.js";

// flash.events.UncaughtErrorEvent.
class UncaughtErrorEvent extends Event {

    static UNCAUGHT_ERROR = "uncaughtError";

    constructor(type, bubbles = true, cancelable = true, error = null) {
        super(type, bubbles, cancelable);
        this.error = error;
    }
}

export default UncaughtErrorEvent;
