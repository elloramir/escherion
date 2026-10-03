import TagHeader from "./TagHeader.js";
import TagFactory from "./TagFactory.js";
import EndTag from "./EndTag.js";

// Reads a sequential list of tags, stopping after the End tag. Used for both the
// main SWF body and DefineSprite's nested tag list.
class TagList {

    static read(reader, swfVersion) {
        const tags = [];
        for (;;) {
            const header = TagHeader.read(reader);
            const bodyStart = reader.position;
            const tag = TagFactory.create(header, reader, swfVersion);
            const bytesConsumed = reader.position - bodyStart;
            if (bytesConsumed < header.length) {
                // Authoring tools sometimes append data a reader does not model
                // (e.g. extra font layout bytes after a device font). The tag
                // length is authoritative, so skip the rest instead of failing
                // the whole movie; a real map SWF failed to load over this.
                reader.readBytes(header.length - bytesConsumed);
            } else if (bytesConsumed !== header.length) {
                throw new Error(
                    `TagList: tag code ${header.code} consumed ${bytesConsumed} bytes, `
                    + `expected ${header.length}`
                );
            }
            tags.push(tag);
            if (tag instanceof EndTag) break;
        }
        return tags;
    }
}

export default TagList;
