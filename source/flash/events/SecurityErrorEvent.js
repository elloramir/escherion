import Event from "./Event.js";

// flash.events.SecurityErrorEvent.
class SecurityErrorEvent extends Event {

    static SECURITY_ERROR = "securityError";

    constructor(type, bubbles = false, cancelable = false, text = "") {
        super(type, bubbles, cancelable);
        this.text = text;
    }
}

export default SecurityErrorEvent;
