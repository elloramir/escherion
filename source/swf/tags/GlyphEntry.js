// GLYPHENTRY: one character within a TEXTRECORD: an index into the current
// font's glyph table plus the horizontal advance to the next character.
class GlyphEntry {

    #glyphIndex;
    #glyphAdvance;

    constructor(glyphIndex, glyphAdvance) {
        this.#glyphIndex = glyphIndex;
        this.#glyphAdvance = glyphAdvance;
    }

    get glyphIndex() {
        return this.#glyphIndex;
    }

    get glyphAdvance() {
        return this.#glyphAdvance;
    }

    static read(reader, glyphBits, advanceBits) {
        const glyphIndex = reader.readUB(glyphBits);
        const glyphAdvance = reader.readSB(advanceBits);
        return new GlyphEntry(glyphIndex, glyphAdvance);
    }
}

export default GlyphEntry;
