// RECORDHEADER: a tag's type code and body length (short or long form).
class TagHeader {

    #code;
    #length;

    constructor(code, length) {
        this.#code = code;
        this.#length = length;
    }

    get code() {
        return this.#code;
    }

    get length() {
        return this.#length;
    }

    static read(reader) {
        const tagCodeAndLength = reader.readUI16();
        const code = tagCodeAndLength >> 6;
        const shortLength = tagCodeAndLength & 0x3f;
        const length = shortLength === 0x3f ? reader.readUI32() : shortLength;
        return new TagHeader(code, length);
    }
}

export default TagHeader;
