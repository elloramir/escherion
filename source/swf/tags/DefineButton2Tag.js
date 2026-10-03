import ButtonRecord from "./ButtonRecord.js";

// DefineButton2 tag: a button character with per-state child placements. An
// ActionScript 3.0 SWF must have ActionOffset = 0 and no BUTTONCONDACTION
// records, because AS1/2 button actions and AS3 code cannot coexist in one file.
// A non-zero ActionOffset throws loudly; a BUTTONCONDACTION parser is out of
// scope until a real file needs it.
class DefineButton2Tag {

    #buttonId;
    #trackAsMenu;
    #characters;

    constructor(buttonId, trackAsMenu, characters) {
        this.#buttonId = buttonId;
        this.#trackAsMenu = trackAsMenu;
        this.#characters = characters;
    }

    get buttonId() {
        return this.#buttonId;
    }

    get trackAsMenu() {
        return this.#trackAsMenu;
    }

    get characters() {
        return this.#characters;
    }

    static read(reader) {
        const buttonId = reader.readUI16();
        reader.readUB(7);
        const trackAsMenu = Boolean(reader.readUB(1));
        const actionOffset = reader.readUI16();
        const characters = ButtonRecord.readArray(reader);
        if (actionOffset !== 0) {
            throw new Error(
                "DefineButton2Tag: BUTTONCONDACTION not implemented "
                + "(unexpected in an ActionScript 3.0 SWF, which must have ActionOffset=0)"
            );
        }
        return new DefineButton2Tag(buttonId, trackAsMenu, characters);
    }
}

export default DefineButton2Tag;
