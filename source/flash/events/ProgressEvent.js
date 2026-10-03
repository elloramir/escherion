import Event from "./Event.js";

// flash.events.ProgressEvent.
class ProgressEvent extends Event {

    static PROGRESS = "progress";
    static SOCKET_DATA = "socketData";

    constructor(type, bubbles = false, cancelable = false, bytesLoaded = 0, bytesTotal = 0) {
        super(type, bubbles, cancelable);
        this.bytesLoaded = bytesLoaded;
        this.bytesTotal = bytesTotal;
    }

    clone() {
        return new ProgressEvent(this.type, this.bubbles, this.cancelable,
            this.bytesLoaded, this.bytesTotal,
        );
    }
}

export default ProgressEvent;
