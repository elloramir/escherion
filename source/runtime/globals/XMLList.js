import XML from "./XML.js";
import XMLNodes from "./XMLNodes.js";

// E4X-lite XMLList: an ordered collection of XML nodes. AS3 indexes it
// (`list[i]`) and measures it with the `length()` method, so the items are also
// exposed as numeric own properties.
class XMLList {

    #items;

    constructor(items = []) {
        this.#items = items.map((item) => (item && item.nodeType && !(item instanceof XML) ? new XML(item) : item));
        for (let index = 0; index < this.#items.length; index++) {
            Object.defineProperty(this, index, { value: this.#items[index], enumerable: true, configurable: true });
        }
        // E4X reads attributes of every item through a subscript (`list["@name"]`).
        const attributes = new Map();
        for (const item of this.#items) {
            const node = item?.__node;
            for (const attribute of node?.attributes ? [...node.attributes] : []) {
                const key = `@${attribute.name}`;
                if (!attributes.has(key)) attributes.set(key, []);
                attributes.get(key).push(attribute.value);
            }
        }
        for (const [key, values] of attributes) {
            if (key in this) continue;
            Object.defineProperty(this, key, { get: () => new XMLList(values), configurable: true });
        }
        // E4X reads a child of every item by name (`list.uLs`), which yields a
        // flattened list of those children.
        const groups = new Map();
        for (const item of this.#items) {
            const node = item.__node;
            for (const child of node?.children ? [...node.children] : []) {
                if (!groups.has(child.nodeName)) groups.set(child.nodeName, []);
                groups.get(child.nodeName).push(child);
            }
        }
        for (const [name, children] of groups) {
            if (name in this) continue;
            Object.defineProperty(this, name, { get: () => new XMLList(children), configurable: true });
        }
    }

    length() {
        return this.#items.length;
    }

    item(index) {
        return this.#items[index] ?? null;
    }

    toString() {
        return this.#items.map((item) => (item instanceof XML ? item.toString() : String(item))).join("");
    }

    child(name) {
        return new XMLList(this.#items.flatMap((item) => XMLNodes.childElements(item.__node, name)));
    }

    children() {
        return new XMLList(this.#items.flatMap((item) => XMLNodes.childElements(item.__node)));
    }

    attribute(name) {
        return this.#items[0]?.attribute?.(name) ?? "";
    }

    text() {
        return new XMLList(this.#items.map((item) => item.__node?.textContent ?? ""));
    }
}

export default XMLList;
