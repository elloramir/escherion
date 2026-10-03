import ClipActionRecord from "./ClipActionRecord.js";

const MIN_VERSION_FOR_WIDE_FLAGS = 6;

// CLIPACTIONS: event handlers attached to a placed sprite, as used by
// PlaceObject2/PlaceObject3's ClipActions field.
class ClipActionList {

    #allEventFlags;
    #records;

    constructor(allEventFlags, records) {
        this.#allEventFlags = allEventFlags;
        this.#records = records;
    }

    get allEventFlags() {
        return this.#allEventFlags;
    }

    get records() {
        return this.#records;
    }

    static read(reader, swfVersion) {
        if (swfVersion < MIN_VERSION_FOR_WIDE_FLAGS) {
            throw new Error("ClipActionList: SWF version < 6 clip actions not implemented");
        }
        reader.readUI16();
        const allEventFlags = reader.readUI32();
        const records = [];
        for (;;) {
            const eventFlags = reader.readUI32();
            if (eventFlags === 0) break;
            records.push(ClipActionRecord.read(reader, eventFlags));
        }
        return new ClipActionList(allEventFlags, records);
    }
}

export default ClipActionList;
