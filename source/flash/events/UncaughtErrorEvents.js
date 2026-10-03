import EventDispatcher from "./EventDispatcher.js";

// flash.events.UncaughtErrorEvents — the dispatcher Loader/LoaderInfo expose.
class UncaughtErrorEvents extends EventDispatcher {

    constructor() {
        super();
    }
}

export default UncaughtErrorEvents;
