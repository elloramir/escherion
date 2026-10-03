// Metadata tag (code 77): XML (RDF/XMP) metadata describing the SWF to an
// external process. Flash Player always ignores it; parsed only so the tag
// stream can be read past it.
class MetadataTag {

    #xml;

    constructor(xml) {
        this.#xml = xml;
    }

    get xml() {
        return this.#xml;
    }

    static read(reader) {
        return new MetadataTag(reader.readString());
    }
}

export default MetadataTag;
