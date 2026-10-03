import XML from "./XML.js";
import XMLNodes from "./XMLNodes.js";

class XMLList {

    constructor(items = []) {
        this.__items = items;
    }

    get length() {
        return this.__items.length;
    }

    toString() {
        return this.__items.map((item) => (item instanceof XML ? item.toString() : String(item))).join("");
    }

    child(name) {
        return new XMLList(this.__items.flatMap((item) => XMLNodes.childElements(item.__node, name)));
    }

    attribute(name) {
        return this.__items[0]?.attribute?.(name);
    }

    text() {
        return new XMLList(this.__items.map((item) => item.__node?.textContent ?? ""));
    }
}

export default XMLList;
