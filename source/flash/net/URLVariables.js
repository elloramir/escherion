// flash.net.URLVariables — URL-encoded name/value pairs.
class URLVariables {

    constructor(source = null) {
        if (typeof source === "string" && source.length > 0) this.decode(source);
    }

    decode(source) {
        for (const pair of String(source).split("&")) {
            if (pair.length === 0) continue;
            const index = pair.indexOf("=");
            const name = decodeURIComponent(index === -1 ? pair : pair.slice(0, index));
            const value = index === -1 ? "" : decodeURIComponent(pair.slice(index + 1));
            this[name] = value;
        }
    }

    toString() {
        const parts = [];
        for (const [name, value] of Object.entries(this)) {
            parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
        }
        return parts.join("&");
    }
}

export default URLVariables;
