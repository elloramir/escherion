// KERNINGRECORD: a distance adjustment between one pair of glyphs, by character
// code. DefineFont3's FontFlagsWideCodes is always 1, so its codes are always
// UI16 and this class only supports that case.
class KerningRecord {

    #code1;
    #code2;
    #adjustment;

    constructor(code1, code2, adjustment) {
        this.#code1 = code1;
        this.#code2 = code2;
        this.#adjustment = adjustment;
    }

    get code1() {
        return this.#code1;
    }

    get code2() {
        return this.#code2;
    }

    get adjustment() {
        return this.#adjustment;
    }

    static read(reader) {
        const code1 = reader.readUI16();
        const code2 = reader.readUI16();
        const adjustment = reader.readSI16();
        return new KerningRecord(code1, code2, adjustment);
    }

    static readArray(reader, count) {
        const records = [];
        for (let i = 0; i < count; i++) {
            records.push(KerningRecord.read(reader));
        }
        return records;
    }
}

export default KerningRecord;
