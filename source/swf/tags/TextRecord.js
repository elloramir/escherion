import * as Swf from "../index.js";
import GlyphEntry from "./GlyphEntry.js";

// TEXTRECORD: sets the font/color/position style for a run of glyphs within a
// DefineText/DefineText2, then lists those glyphs. Style fields not carried by a
// record stay whatever the previous record (or the tag defaults, for the first)
// left them, so a consumer walking these has to track that itself; this class
// only reports what was actually present on the wire.
class TextRecord {

    #fontId;
    #textColor;
    #xOffset;
    #yOffset;
    #textHeight;
    #glyphEntries;

    constructor(fontId, textColor, xOffset, yOffset, textHeight, glyphEntries) {
        this.#fontId = fontId;
        this.#textColor = textColor;
        this.#xOffset = xOffset;
        this.#yOffset = yOffset;
        this.#textHeight = textHeight;
        this.#glyphEntries = glyphEntries;
    }

    get fontId() {
        return this.#fontId;
    }

    get textColor() {
        return this.#textColor;
    }

    get xOffset() {
        return this.#xOffset;
    }

    get yOffset() {
        return this.#yOffset;
    }

    get textHeight() {
        return this.#textHeight;
    }

    get glyphEntries() {
        return this.#glyphEntries;
    }

    // Returns null at the EndOfRecordsFlag (a whole zero byte), since
    // TextRecordType is always 1 on a real record.
    static read(reader, glyphBits, advanceBits, hasAlpha) {
        reader.align();
        const textRecordType = reader.readUB(1);
        reader.readUB(3);
        const hasFont = reader.readUB(1);
        const hasColor = reader.readUB(1);
        const hasYOffset = reader.readUB(1);
        const hasXOffset = reader.readUB(1);
        if (!textRecordType && !hasFont && !hasColor && !hasYOffset && !hasXOffset) {
            return null;
        }
        const fontId = hasFont ? reader.readUI16() : null;
        const textColor = hasColor
            ? (hasAlpha ? Swf.Color.readRgba(reader) : Swf.Color.readRgb(reader))
            : null;
        const xOffset = hasXOffset ? reader.readSI16() : null;
        const yOffset = hasYOffset ? reader.readSI16() : null;
        const textHeight = hasFont ? reader.readUI16() : null;
        const glyphCount = reader.readUI8();
        const glyphEntries = [];
        for (let i = 0; i < glyphCount; i++) {
            glyphEntries.push(GlyphEntry.read(reader, glyphBits, advanceBits));
        }
        return new TextRecord(fontId, textColor, xOffset, yOffset, textHeight, glyphEntries);
    }

    static readArray(reader, glyphBits, advanceBits, hasAlpha) {
        const records = [];
        let record;
        while ((record = TextRecord.read(reader, glyphBits, advanceBits, hasAlpha)) !== null) {
            records.push(record);
        }
        return records;
    }
}

export default TextRecord;
