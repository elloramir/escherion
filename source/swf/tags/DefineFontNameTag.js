// DefineFontName tag (code 88): name and copyright metadata for an embedded
// font. Purely informational, no display or behavior effect.
class DefineFontNameTag {

    #fontId;
    #fontName;
    #fontCopyright;

    constructor(fontId, fontName, fontCopyright) {
        this.#fontId = fontId;
        this.#fontName = fontName;
        this.#fontCopyright = fontCopyright;
    }

    get fontId() {
        return this.#fontId;
    }

    get fontName() {
        return this.#fontName;
    }

    get fontCopyright() {
        return this.#fontCopyright;
    }

    static read(reader) {
        const fontId = reader.readUI16();
        const fontName = reader.readString();
        const fontCopyright = reader.readString();
        return new DefineFontNameTag(fontId, fontName, fontCopyright);
    }
}

export default DefineFontNameTag;
