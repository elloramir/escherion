import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";
import KerningRecord from "./KerningRecord.js";

// DefineFont3 tag: a font with glyph coordinates at 20x resolution (SHAPE
// coordinates in the GlyphShapeTable are the EMSquare coordinates times 20).
// NumGlyphs = 0 (a device font with no embedded outlines) is valid and common,
// in which case the code and glyph tables are simply absent.
class DefineFont3Tag {

    #fontId;
    #shiftJis;
    #smallText;
    #ansi;
    #italic;
    #bold;
    #languageCode;
    #fontName;
    #numGlyphs;
    #glyphShapeTable;
    #codeTable;
    #ascent;
    #descent;
    #leading;
    #fontAdvanceTable;
    #kerningTable;

    constructor(
        fontId, shiftJis, smallText, ansi, italic, bold,
        languageCode, fontName, numGlyphs, glyphShapeTable, codeTable,
        ascent, descent, leading, fontAdvanceTable, kerningTable
    ) {
        this.#fontId = fontId;
        this.#shiftJis = shiftJis;
        this.#smallText = smallText;
        this.#ansi = ansi;
        this.#italic = italic;
        this.#bold = bold;
        this.#languageCode = languageCode;
        this.#fontName = fontName;
        this.#numGlyphs = numGlyphs;
        this.#glyphShapeTable = glyphShapeTable;
        this.#codeTable = codeTable;
        this.#ascent = ascent;
        this.#descent = descent;
        this.#leading = leading;
        this.#fontAdvanceTable = fontAdvanceTable;
        this.#kerningTable = kerningTable;
    }

    get fontId() {
        return this.#fontId;
    }

    get shiftJis() {
        return this.#shiftJis;
    }

    get smallText() {
        return this.#smallText;
    }

    get ansi() {
        return this.#ansi;
    }

    get italic() {
        return this.#italic;
    }

    get bold() {
        return this.#bold;
    }

    get languageCode() {
        return this.#languageCode;
    }

    get fontName() {
        return this.#fontName;
    }

    get numGlyphs() {
        return this.#numGlyphs;
    }

    get glyphShapeTable() {
        return this.#glyphShapeTable;
    }

    get codeTable() {
        return this.#codeTable;
    }

    get ascent() {
        return this.#ascent;
    }

    get descent() {
        return this.#descent;
    }

    get leading() {
        return this.#leading;
    }

    // Per-glyph advance width, index-aligned with codeTable/glyphShapeTable and
    // in EM-square x20 units: divide by 20480 and multiply by a real fontHeight
    // in twips to get a real advance width in twips.
    get fontAdvanceTable() {
        return this.#fontAdvanceTable;
    }

    get kerningTable() {
        return this.#kerningTable;
    }

    static read(reader) {
        const fontId = reader.readUI16();
        const hasLayout = reader.readUB(1);
        const shiftJis = Boolean(reader.readUB(1));
        const smallText = Boolean(reader.readUB(1));
        const ansi = Boolean(reader.readUB(1));
        const wideOffsets = reader.readUB(1);
        reader.readUB(1);
        const italic = Boolean(reader.readUB(1));
        const bold = Boolean(reader.readUB(1));
        const languageCode = reader.readUI8();
        const fontNameLen = reader.readUI8();
        const fontName = new TextDecoder("utf-8").decode(reader.readBytes(fontNameLen));
        const numGlyphs = reader.readUI16();
        let glyphShapeTable = [];
        let codeTable = [];
        if (numGlyphs > 0) {
            // OffsetTable and CodeTableOffset are only needed for random access
            // into the tables below. This reader parses sequentially and the
            // GlyphShapeTable immediately follows them, so their values are
            // discarded and only their byte width is consumed to stay aligned.
            for (let i = 0; i < numGlyphs; i++) {
                wideOffsets ? reader.readUI32() : reader.readUI16();
            }
            wideOffsets ? reader.readUI32() : reader.readUI16();
            for (let i = 0; i < numGlyphs; i++) {
                glyphShapeTable.push(Shapes.Shape.read(reader));
            }
            for (let i = 0; i < numGlyphs; i++) {
                codeTable.push(reader.readUI16());
            }
        }
        let ascent = null;
        let descent = null;
        let leading = null;
        let fontAdvanceTable = [];
        let kerningTable = [];
        if (hasLayout) {
            ascent = reader.readUI16();
            descent = reader.readUI16();
            leading = reader.readSI16();
            for (let i = 0; i < numGlyphs; i++) {
                fontAdvanceTable.push(reader.readSI16());
            }
            // FontBoundsTable is unused through SWF 7 but must be present. No
            // consumer names it, so it is read only to stay byte-aligned for
            // the KerningCount that follows.
            for (let i = 0; i < numGlyphs; i++) {
                Swf.Rect.read(reader);
            }
            const kerningCount = reader.readUI16();
            kerningTable = KerningRecord.readArray(reader, kerningCount);
        }
        return new DefineFont3Tag(
            fontId, shiftJis, smallText, ansi, italic, bold,
            languageCode, fontName, numGlyphs, glyphShapeTable, codeTable,
            ascent, descent, leading, fontAdvanceTable, kerningTable
        );
    }
}

export default DefineFont3Tag;
