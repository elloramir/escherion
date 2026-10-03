import Event from "../events/Event.js";
import EventDispatcher from "../events/EventDispatcher.js";
import IOErrorEvent from "../events/IOErrorEvent.js";
import ProgressEvent from "../events/ProgressEvent.js";

// flash.net.URLLoader — fetches through the host and dispatches the same events
// the game expects. Relative URLs resolve against the player's base URL.
// A movie reaches it through `domain.bind(URLLoader)`, which supplies `static domain`.
class URLLoader extends EventDispatcher {

    static domain = null;

    constructor(request = null) {
        super();
        this.data = undefined;
        this.dataFormat = "text";
        this.bytesLoaded = 0;
        this.bytesTotal = 0;
        if (request) this.load(request);
    }

    load(request) {
        const url = this.constructor.domain.host.resolve(request?.url ?? request);
        const options = { method: request?.method ?? "GET", body: request?.data ?? undefined };
        fetch(url, options)
            .then(async (response) => {
                if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
                const text = await response.text();
                this.data = this.dataFormat === "text" ? text : text;
                this.bytesLoaded = text.length;
                this.bytesTotal = text.length;
                this.dispatchEvent(new Event(Event.COMPLETE));
            })
            .catch((error) => {
                const event = new IOErrorEvent(IOErrorEvent.IO_ERROR);
                event.text = error.message;
                this.dispatchEvent(event);
            });

        const progress = new ProgressEvent(ProgressEvent.PROGRESS);
        this.dispatchEvent(progress);
    }

    close() {}
}

export default URLLoader;
