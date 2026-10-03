// flash.system.Capabilities — reported from the browser.
class Capabilities {

    static get playerType() {
        return "PlugIn";
    }

    static get version() {
        return "WIN 11,0,0,0";
    }

    static get isDebugger() {
        return false;
    }

    static get language() {
        return globalThis.navigator?.language ?? "en";
    }

    static get os() {
        return "Linux";
    }

    static get screenResolutionX() {
        return globalThis.screen?.width ?? 0;
    }

    static get screenResolutionY() {
        return globalThis.screen?.height ?? 0;
    }
}

export default Capabilities;
