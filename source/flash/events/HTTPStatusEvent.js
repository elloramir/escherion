import Event from "./Event.js";

// flash.events.HTTPStatusEvent.
class HTTPStatusEvent extends Event {

    static HTTP_STATUS = "httpStatus";
    static HTTP_RESPONSE_STATUS = "httpResponseStatus";

    constructor(type, bubbles = false, cancelable = false, status = 0, responseURL = "", responseHeaders = null) {
        super(type, bubbles, cancelable);
        this.status = status;
        this.responseURL = responseURL;
        this.responseHeaders = responseHeaders ?? [];
    }
}

export default HTTPStatusEvent;
