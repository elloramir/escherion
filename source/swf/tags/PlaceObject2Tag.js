import * as Swf from "../index.js";
import ClipActionList from "./ClipActionList.js";

// PlaceObject2 tag: adds a character to the display list, or modifies one
// already placed at the same depth.
class PlaceObject2Tag {

    #isMove;
    #depth;
    #characterId;
    #matrix;
    #colorTransform;
    #ratio;
    #name;
    #clipDepth;
    #clipActions;

    constructor(isMove, depth, characterId, matrix, colorTransform, ratio, name, clipDepth, clipActions) {
        this.#isMove = isMove;
        this.#depth = depth;
        this.#characterId = characterId;
        this.#matrix = matrix;
        this.#colorTransform = colorTransform;
        this.#ratio = ratio;
        this.#name = name;
        this.#clipDepth = clipDepth;
        this.#clipActions = clipActions;
    }

    get isMove() {
        return this.#isMove;
    }

    get depth() {
        return this.#depth;
    }

    get characterId() {
        return this.#characterId;
    }

    get matrix() {
        return this.#matrix;
    }

    get colorTransform() {
        return this.#colorTransform;
    }

    get ratio() {
        return this.#ratio;
    }

    get name() {
        return this.#name;
    }

    get clipDepth() {
        return this.#clipDepth;
    }

    get clipActions() {
        return this.#clipActions;
    }

    static read(reader, length, bodyStart, swfVersion) {
        const hasClipActions = reader.readUB(1);
        const hasClipDepth = reader.readUB(1);
        const hasName = reader.readUB(1);
        const hasRatio = reader.readUB(1);
        const hasColorTransform = reader.readUB(1);
        const hasMatrix = reader.readUB(1);
        const hasCharacter = reader.readUB(1);
        const isMove = Boolean(reader.readUB(1));
        const depth = reader.readUI16();
        const characterId = hasCharacter ? reader.readUI16() : null;
        const matrix = hasMatrix ? Swf.Matrix.read(reader) : null;
        const colorTransform = hasColorTransform ? Swf.ColorTransformWithAlpha.read(reader) : null;
        const ratio = hasRatio ? reader.readUI16() : null;
        const name = hasName ? reader.readString() : null;
        const clipDepth = hasClipDepth ? reader.readUI16() : null;
        const clipActions = hasClipActions ? ClipActionList.read(reader, swfVersion) : null;
        return new PlaceObject2Tag(
            isMove, depth, characterId, matrix, colorTransform, ratio, name, clipDepth, clipActions
        );
    }
}

export default PlaceObject2Tag;
