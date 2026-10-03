// RemoveObject2 tag (code 28): removes the character at the given depth from the
// display list. Unlike RemoveObject (code 5) it identifies the character by
// depth alone.
class RemoveObject2Tag {

    #depth;

    constructor(depth) {
        this.#depth = depth;
    }

    get depth() {
        return this.#depth;
    }

    static read(reader) {
        const depth = reader.readUI16();
        return new RemoveObject2Tag(depth);
    }
}

export default RemoveObject2Tag;
