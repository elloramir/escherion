// The SWF dictionary: every character definition of one tag list, by character
// id. Ids are unique within a file, so a nested SWF always gets its own
// dictionary; a loaded movie routinely reuses an id the root defines as
// something else. A tag list is immutable once parsed, so the index is built
// once per list.
class Dictionary {

    static #byTags = new WeakMap();
    static empty = new Dictionary([]);

    #characters = new Map();
    #scalingGrids = new Map();

    constructor(tags) {
        this.#add(tags);
    }

    static of(tags) {
        let dictionary = Dictionary.#byTags.get(tags);
        if (!dictionary) {
            dictionary = new Dictionary(tags);
            Dictionary.#byTags.set(tags, dictionary);
        }
        return dictionary;
    }

    // The id a definition tag registers under, or null for any other tag.
    static idOf(tag) {
        for (const key of ["shapeId", "characterId", "spriteId", "fontId", "buttonId"]) {
            if (tag[key] !== undefined && tag[key] !== null) return tag[key];
        }
        return null;
    }

    get(id) {
        return this.#characters.get(id) ?? null;
    }

    scalingGrid(id) {
        return this.#scalingGrids.get(id) ?? null;
    }

    #add(tags) {
        for (const tag of tags) {
            if (tag.constructor.name === "DefineScalingGridTag" && tag.splitter) {
                this.#scalingGrids.set(tag.characterId, tag.splitter);
            }
            const id = Dictionary.idOf(tag);
            if (id !== null && !this.#characters.has(id)) this.#characters.set(id, tag);
            if (Array.isArray(tag.controlTags)) this.#add(tag.controlTags);
        }
    }
}

export default Dictionary;
