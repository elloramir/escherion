// Codepoint to glyph-index lookup over a DefineFont3's own codeTable. The SWF
// spec guarantees codeTable is sorted ascending, so binary search is correct,
// not merely fast.
class GlyphCodeTableLookup {

    static indexOfCode(codeTable, code) {
        let low = 0;
        let high = codeTable.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const value = codeTable[mid];
            if (value === code) return mid;
            if (value < code) low = mid + 1;
            else high = mid - 1;
        }
        // -1 means the font's embedded subset does not cover this codepoint.
        return -1;
    }

    static indicesForString(codeTable, text) {
        const indices = new Array(text.length);
        for (let i = 0; i < text.length; i++) {
            indices[i] = GlyphCodeTableLookup.indexOfCode(codeTable, text.charCodeAt(i));
        }
        return indices;
    }
}

export default GlyphCodeTableLookup;
