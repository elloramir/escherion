import * as Swf from "../index.js";
import TextRecord from "./TextRecord.js";

const HAS_ALPHA = false;

// DefineText tag (code 11): a block of static text: font, size, color and the
// exact glyph position of every character, referenced by glyph index into a
// previously-defined font.
class DefineTextTag {

    #characterId;
    #textBounds;
    #textMatrix;
    #textRecords;

    constructor(characterId, textBounds, textMatrix, textRecords) {
        this.#characterId = characterId;
        this.#textBounds = textBounds;
        this.#textMatrix = textMatrix;
        this.#textRecords = textRecords;
    }

    get characterId() {
        return this.#characterId;
    }

    get textBounds() {
        return this.#textBounds;
    }

    get textMatrix() {
        return this.#textMatrix;
    }

    get textRecords() {
        return this.#textRecords;
    }

    static read(reader) {
        const characterId = reader.readUI16();
        const textBounds = Swf.Rect.read(reader);
        const textMatrix = Swf.Matrix.read(reader);
        const glyphBits = reader.readUI8();
        const advanceBits = reader.readUI8();
        const textRecords = TextRecord.readArray(reader, glyphBits, advanceBits, HAS_ALPHA);
        return new DefineTextTag(characterId, textBounds, textMatrix, textRecords);
    }
}

export default DefineTextTag;
