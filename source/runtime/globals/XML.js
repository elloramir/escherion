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
        XML.#index(this);
    }

    // E4X reads a child element by name (`xml.body`) and an attribute by
    // subscript (`xml["@t"]`); expose both as properties so those plain
    // accesses resolve without a full E4X engine.
    static #index(xml) {
        const node = xml.__node;
        if (!node) return;
        const groups = new Map();
        for (const child of node.children ? [...node.children] : []) {
            if (!groups.has(child.nodeName)) groups.set(child.nodeName, []);
            groups.get(child.nodeName).push(child);
        }
        for (const [name, elements] of groups) {
            if (name in xml) continue;
            Object.defineProperty(xml, name, {
                get: () => new XMLList(elements.map((element) => new XML(element))),
                configurable: true,
            });
        }
        for (const attribute of node.attributes ? [...node.attributes] : []) {
            const key = `@${attribute.name}`;
            if (!(key in xml)) Object.defineProperty(xml, key, { value: attribute.value, configurable: true });
        }
    }

    // E4X's string value: the text of simple content, the markup when the
    // object holds element children (and "" when it holds none).
    toString() {
        const node = this.__node;
        if (!node) return "";
        if (node.nodeType !== 1) return node.textContent ?? "";
        if (!node.children || node.children.length === 0) return node.textContent ?? "";
        const serializer = typeof XMLSerializer !== "undefined" ? new XMLSerializer() : null;
        if (serializer) return serializer.serializeToString(node);
        return this.#serialize(node);
    }

    #serialize(node) {
        if (node.nodeType !== 1) return node.textContent ?? "";
        const attributes = Object.entries(node.attributes ?? {})
            .map(([name, value]) => ` ${name}="${value}"`).join("");
        const children = [...(node.children ?? [])].map((child) => this.#serialize(child)).join("");
        return `<${node.nodeName}${attributes}>${children}</${node.nodeName}>`;
    }

    length() {
        return this.__node ? 1 : 0;
    }

    child(name) {
        const node = XMLNodes.firstChild(this.__node, name);
        return node ? new XML(node) : new XML("");
    }

    children() {
        return new XMLList(XMLNodes.childElements(this.__node).map((node) => new XML(node)));
    }

    elements(name = "*") {
        return new XMLList(XMLNodes.childElements(this.__node, name).map((node) => new XML(node)));
    }

    // AS3's `attribute()` returns an XMLList whose `toString()` is "" when the
    // attribute is absent; a plain string covers every use the game makes.
    attribute(name) {
        return this.__node?.getAttribute?.(name) ?? "";
    }

    attributes() {
        return new XMLList([]);
    }

    descendants(name = "*") {
        return new XMLList(XMLNodes.descendants(this.__node, name).map((node) => new XML(node)));
    }

    text() {
        return new XMLList([this.__node?.textContent ?? ""]);
    }

    valueOf() {
        return this.toString();
    }
}

export default XML;
