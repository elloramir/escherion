// flash.system.System.
class System {
    static totalMemory = 0;
    static freeMemory = 0;
    static privateMemory = 0;
    static useCodePage = false;
    static vmVersion = "AVM2";
    static ime = null;

    static setClipboard(text) {
        globalThis.navigator?.clipboard?.writeText?.(String(text));
    }

    static disposeXML(node) {
        void node;
    }

    static setLoopBack(state) {
        void state;
    }

    static pause() {}

    static resume() {}

    static exit(code = 0) {
        void code;
    }

    static gc() {}
}

export default System;
