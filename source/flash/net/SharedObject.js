import EventDispatcher from "../events/EventDispatcher.js";

// flash.net.SharedObject — localStorage-backed persistence.
class SharedObject extends EventDispatcher {

    #name;

    constructor(name = "") {
        super();
        this.#name = name;
        this.data = {};
        this.client = null;
        this.fps = 0;
    }

    get name() {
        return this.#name;
    }

    static getLocal(name, localPath = null, secure = false) {
        void localPath;
        void secure;
        const shared = new SharedObject(null, name);
        const raw = SharedObject.#storage()?.getItem(`so:${name}`);
        if (raw) {
            try {
                shared.data = JSON.parse(raw);
            } catch {
                shared.data = {};
            }
        }
        return shared;
    }

    static getDiskUsage(name) {
        const raw = SharedObject.#storage()?.getItem(`so:${name}`);
        return raw ? raw.length : 0;
    }

    static deleteAll() {
        const store = SharedObject.#storage();
        if (!store) return;
        for (const key of Object.keys(store)) {
            if (key.startsWith("so:")) store.removeItem(key);
        }
    }

    flush(minDiskSpace = 0) {
        void minDiskSpace;
        const store = SharedObject.#storage();
        if (!store) return;
        try {
            store.setItem(`so:${this.#name}`, JSON.stringify(this.data));
        } catch {
            console.warn("[flash.net] SharedObject.flush: storage is full");
        }
    }

    setDirty() {}

    setProperty(name, value) {
        this.data[name] = value;
    }

    static #storage() {
        try {
            return globalThis.localStorage ?? null;
        } catch {
            return null;
        }
    }
}

export default SharedObject;
