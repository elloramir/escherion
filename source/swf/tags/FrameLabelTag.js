// FrameLabel tag (code 43): gives the current frame a name, used by
// ActionGoToLabel. In SWF 6+ a trailing non-null byte also marks it as a named
// HTML anchor. This is detected from whatever body bytes remain after the name
// rather than assumed from the version, since not every SWF 6+ frame label is
// an anchor.
class FrameLabelTag {

    #name;
    #isNamedAnchor;

    constructor(name, isNamedAnchor) {
        this.#name = name;
        this.#isNamedAnchor = isNamedAnchor;
    }

    get name() {
        return this.#name;
    }

    get isNamedAnchor() {
        return this.#isNamedAnchor;
    }

    static read(reader, length, bodyStart) {
        const name = reader.readString();
        const isNamedAnchor = length - (reader.position - bodyStart) > 0 && reader.readUI8() === 1;
        return new FrameLabelTag(name, isNamedAnchor);
    }
}

export default FrameLabelTag;
