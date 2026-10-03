// DOM access shared by XML and XMLList: the E4X engine is not ported, so both
// hold a DOM node (or a text stand-in) and answer queries through it.
class XMLNodes {

    static parse(value) {
        if (value && value.__node) return value.__node;
        if (value && value.nodeType) return value;
        const text = String(value ?? "");
        if (typeof DOMParser === "undefined") {
            return { textContent: text, getAttribute: () => undefined };
        }
        const document = new DOMParser().parseFromString(text, "application/xml");
        return document.documentElement ?? null;
    }

    static childElements(node, name = "*") {
        if (!node?.children) return [];
        const list = [...node.children];
        return name === "*" ? list : list.filter((child) => child.nodeName === name);
    }

    static firstChild(node, name) {
        return XMLNodes.childElements(node, name)[0] ?? null;
    }

    static descendants(node, name = "*") {
        if (typeof node?.querySelectorAll !== "function") return [];
        return [...node.querySelectorAll(name === "*" ? "*" : name)];
    }
}

export default XMLNodes;
