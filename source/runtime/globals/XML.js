import XMLList from "./XMLList.js";
import XMLNodes from "./XMLNodes.js";

// E4X-lite: enough to hold and traverse XML. Queries go through the underlying DOM.
class XML {

    static ignoreWhitespace = true;
    static ignoreComments = true;
    static ignoreProcessingInstructions = true;
    static prettyPrinting = true;
    static prettyIndent = 2;

    constructor(value = "") {
        this.__node = XMLNodes.parse(value);
    }

    toString() {
        const serializer = typeof XMLSerializer !== "undefined" ? new XMLSerializer() : null;
        if (this.__node && serializer) return serializer.serializeToString(this.__node);
        return this.__node?.textContent ?? String(this.__node ?? "");
    }

    get length() {
        return this.__node ? 1 : 0;
    }

    child(name) {
        return new XML(XMLNodes.firstChild(this.__node, name) ?? "");
    }

    children() {
        return new XMLList(XMLNodes.childElements(this.__node));
    }

    elements(name = "*") {
        return new XMLList(XMLNodes.childElements(this.__node, name));
    }

    attribute(name) {
        return this.__node?.getAttribute?.(name) ?? undefined;
    }

    attributes() {
        return new XMLList([]);
    }

    descendants(name = "*") {
        return new XMLList(XMLNodes.descendants(this.__node, name));
    }

    text() {
        return new XMLList([this.__node?.textContent ?? ""]);
    }

    valueOf() {
        return this.toString();
    }
}

export default XML;
