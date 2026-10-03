import XML from "./XML.js";
import XMLNodes from "./XMLNodes.js";

class XMLList {

    #items;

    constructor(items = []) {
        this.#items = items;
    }

    get length() {
        return this.#items.length;
    }

    toString() {
        return this.#items.map((item) => (item instanceof XML ? item.toString() : String(item))).join("");
    }

    child(name) {
        return new XMLList(this.#items.flatMap((item) => XMLNodes.childElements(item.__node, name)));
    }

    attribute(name) {
        return this.#items[0]?.attribute?.(name);
    }

    text() {
        return new XMLList(this.#items.map((item) => item.__node?.textContent ?? ""));
    }
}

export default XMLList;
