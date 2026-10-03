// flash.external.ExternalInterface — the bridge to the embedding page. Nothing
// embeds this movie, so the bridge is permanently unavailable and every call
// reports that (the game branches on `available` before it calls).
class ExternalInterface {

    static available = false;
    static objectID = "";

    static addCallback(functionName, closure) {
        void functionName;
        void closure;
        return false;
    }

    static call(functionName, ...args) {
        void functionName;
        void args;
        return undefined;
    }
}

export default ExternalInterface;
