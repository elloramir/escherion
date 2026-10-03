// DefineFontAlignZones tag: pixel-snapping alignment zones for a DefineFont3's glyphs.
class DefineFontAlignZonesTag {

    #fontId;
    #csmTableHint;
    #zoneTable;

    constructor(fontId, csmTableHint, zoneTable) {
        this.#fontId = fontId;
        this.#csmTableHint = csmTableHint;
        this.#zoneTable = zoneTable;
    }

    get fontId() {
        return this.#fontId;
    }

    get csmTableHint() {
        return this.#csmTableHint;
    }

    get zoneTable() {
        return this.#zoneTable;
    }

    static read(reader, length, bodyStart) {
        const fontId = reader.readUI16();
        const csmTableHint = reader.readUB(2);
        reader.readUB(6);
        const zoneTable = [];
        while (reader.position - bodyStart < length) {
            const numZoneData = reader.readUI8();
            const zoneData = [];
            for (let i = 0; i < numZoneData; i++) {
                const coordinate = reader.readFloat16();
                const range = reader.readFloat16();
                zoneData.push({ coordinate, range });
            }
            reader.readUB(6);
            const maskY = Boolean(reader.readUB(1));
            const maskX = Boolean(reader.readUB(1));
            zoneTable.push({ zoneData, maskX, maskY });
        }
        return new DefineFontAlignZonesTag(fontId, csmTableHint, zoneTable);
    }
}

export default DefineFontAlignZonesTag;
