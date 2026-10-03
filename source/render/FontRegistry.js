// Embedded fonts are global in Flash: a text field can use a font embedded by
// any loaded SWF, by face name.
class FontRegistry {

    static #fonts = new Map();
    static #registered = new WeakSet();

    static register(tags) {
        if (FontRegistry.#registered.has(tags)) return;
        FontRegistry.#registered.add(tags);
        for (const tag of tags) {
            const isFont = typeof tag.fontName === "string"
                && Array.isArray(tag.glyphShapeTable) && tag.numGlyphs > 0;
            if (isFont) FontRegistry.#add(tag);
        }
    }

    static find(face, bold, italic) {
        if (typeof face !== "string" || face.length === 0) return null;
        const name = face.toLowerCase().trim();
        const plain = name.replace(/\s+(bold|italic|regular|bold italic)$/, "");
        const style = `${bold ? 1 : 0}|${italic ? 1 : 0}`;
        return FontRegistry.#fonts.get(`${name}|${style}`)
            ?? FontRegistry.#fonts.get(`${plain}|${style}`)
            ?? FontRegistry.#fonts.get(name)
            ?? FontRegistry.#fonts.get(plain)
            ?? null;
    }

    static #add(font) {
        // Face names are NUL-terminated in the SWF.
        const name = font.fontName.replace(/\0+$/, "").trim().toLowerCase();
        const key = `${name}|${font.bold ? 1 : 0}|${font.italic ? 1 : 0}`;
        if (!FontRegistry.#fonts.has(key)) FontRegistry.#fonts.set(key, font);
        if (!FontRegistry.#fonts.has(name)) FontRegistry.#fonts.set(name, font);
    }
}

export default FontRegistry;
