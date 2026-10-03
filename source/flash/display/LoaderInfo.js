import EventDispatcher from "../events/EventDispatcher.js";
import UncaughtErrorEvents from "../events/UncaughtErrorEvents.js";

// flash.display.LoaderInfo.
class LoaderInfo extends EventDispatcher {

    constructor(loader = null) {
        super();
        this.loader = loader;
        this.uncaughtErrorEvents = new UncaughtErrorEvents();
        this.content = null;
        this.url = null;
        this.loaderURL = null;
        this.bytesLoaded = 0;
        this.bytesTotal = 0;
        this.width = 0;
        this.height = 0;
        this.parameters = {};
        this.applicationDomain = null;
        this.securityDomain = null;
        this.sharedEvents = null;
        this.contentType = "application/x-shockwave-flash";
        this.actionScriptVersion = { major: 3, minor: 0 };
        this.sameDomain = true;
        this.parentAllowsChild = true;
        this.childAllowsParent = true;
    }
}

export default LoaderInfo;
