import * as Swf from "../index.js";
import * as Filters from "../filters/index.js";

// BUTTONRECORD: one character placed in one or more of a DefineButton2's states
// (hit test/down/over/up). Color transform, filter list and blend mode only
// exist within DefineButton2, the only button tag this codebase implements.
class ButtonRecord {

    #stateHitTest;
    #stateDown;
    #stateOver;
    #stateUp;
    #characterId;
    #placeDepth;
    #placeMatrix;
    #colorTransform;
    #filterList;
    #blendMode;

    constructor(
        stateHitTest, stateDown, stateOver, stateUp, characterId, placeDepth,
        placeMatrix, colorTransform, filterList, blendMode
    ) {
        this.#stateHitTest = stateHitTest;
        this.#stateDown = stateDown;
        this.#stateOver = stateOver;
        this.#stateUp = stateUp;
        this.#characterId = characterId;
        this.#placeDepth = placeDepth;
        this.#placeMatrix = placeMatrix;
        this.#colorTransform = colorTransform;
        this.#filterList = filterList;
        this.#blendMode = blendMode;
    }

    get stateHitTest() {
        return this.#stateHitTest;
    }

    get stateDown() {
        return this.#stateDown;
    }

    get stateOver() {
        return this.#stateOver;
    }

    get stateUp() {
        return this.#stateUp;
    }

    get characterId() {
        return this.#characterId;
    }

    get placeDepth() {
        return this.#placeDepth;
    }

    get placeMatrix() {
        return this.#placeMatrix;
    }

    get colorTransform() {
        return this.#colorTransform;
    }

    get filterList() {
        return this.#filterList;
    }

    get blendMode() {
        return this.#blendMode;
    }

    // Returns null at the CharacterEndFlag (a whole zero byte): on a real record
    // at least one state or flag bit is always set.
    static read(reader) {
        reader.readUB(2);
        const hasBlendMode = Boolean(reader.readUB(1));
        const hasFilterList = Boolean(reader.readUB(1));
        const stateHitTest = Boolean(reader.readUB(1));
        const stateDown = Boolean(reader.readUB(1));
        const stateOver = Boolean(reader.readUB(1));
        const stateUp = Boolean(reader.readUB(1));
        if (!hasBlendMode && !hasFilterList && !stateHitTest && !stateDown && !stateOver && !stateUp) {
            return null;
        }
        const characterId = reader.readUI16();
        const placeDepth = reader.readUI16();
        const placeMatrix = Swf.Matrix.read(reader);
        const colorTransform = Swf.ColorTransformWithAlpha.read(reader);
        const filterList = hasFilterList ? Filters.FilterList.read(reader) : null;
        const blendMode = hasBlendMode ? reader.readUI8() : null;
        return new ButtonRecord(
            stateHitTest, stateDown, stateOver, stateUp, characterId, placeDepth,
            placeMatrix, colorTransform, filterList, blendMode
        );
    }

    static readArray(reader) {
        const records = [];
        let record;
        while ((record = ButtonRecord.read(reader)) !== null) {
            records.push(record);
        }
        return records;
    }
}

export default ButtonRecord;
