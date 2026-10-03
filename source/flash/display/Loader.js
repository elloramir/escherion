import DisplayObjectContainer from "./DisplayObjectContainer.js";
import LoaderInfo from "./LoaderInfo.js";
import UncaughtErrorEvents from "../events/UncaughtErrorEvents.js";
import Event from "../events/Event.js";
import IOErrorEvent from "../events/IOErrorEvent.js";
import ProgressEvent from "../events/ProgressEvent.js";

// flash.display.Loader. Fetching and mounting the nested SWF is the host's job;
// a movie reaches this class through `domain.bind(Loader)`, which supplies
// `static domain`, and the loader dispatches the events the game listens for on
// `contentLoaderInfo`.
class Loader extends DisplayObjectContainer {

    static domain = null;

    constructor() {
        super();
        this.content = null;
        this.contentLoaderInfo = new LoaderInfo(this);
        this.uncaughtErrorEvents = new UncaughtErrorEvents();
    }

    load(request, context = null) {
        void context;
        const host = this.constructor.domain.host;
        const info = this.contentLoaderInfo;
        const url = host.resolve(request?.url ?? request);
        info.url = url;
        info.dispatchEvent(new Event(Event.OPEN));

        Promise.resolve(host.loadNested({ loader: this, url }))
            .then(() => {
                info.dispatchEvent(new ProgressEvent(ProgressEvent.PROGRESS));
                info.dispatchEvent(new Event(Event.COMPLETE));
            })
            .catch((error) => {
                console.error(`[flash.display] Loader.load(${url}) failed:`, error);
                const event = new IOErrorEvent(IOErrorEvent.IO_ERROR);
                event.text = String(error?.message ?? error);
                info.dispatchEvent(event);
            });
    }

    unload() {
        if (this.content) this.removeChild(this.content);
        this.content = null;
    }

    unloadAndStop(gc = true) {
        void gc;
        this.unload();
    }

    close() {}
}

export default Loader;
