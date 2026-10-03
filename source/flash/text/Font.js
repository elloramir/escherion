// flash.text.Font. Embedded fonts are owned by the renderer's dictionary; this
// class exposes the AS3 surface the game queries.
class Font {

    static #registered = new Set();

    constructor() {
        this.fontName = null;
        this.fontStyle = "regular";
        this.fontType = "embedded";
    }

    static enumerateFonts() {
        return [...Font.#registered];
    }

    static registerFont(font) {
        Font.#registered.add(font);
    }
}

export default Font;
