import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";

// DefineMorphShape tag (code 46): the start and end states of a morph sequence,
// displayed via PlaceObject2/3's ratio field. See DefineMorphShape2Tag for the
// version with edge bounds and MORPHLINESTYLE2 strokes.
class DefineMorphShapeTag {

    #characterId;
    #startBounds;
    #endBounds;
    #morphFillStyles;
    #morphLineStyles;
    #startEdges;
    #endEdges;

    constructor(characterId, startBounds, endBounds, morphFillStyles, morphLineStyles, startEdges, endEdges) {
        this.#characterId = characterId;
        this.#startBounds = startBounds;
        this.#endBounds = endBounds;
        this.#morphFillStyles = morphFillStyles;
        this.#morphLineStyles = morphLineStyles;
        this.#startEdges = startEdges;
        this.#endEdges = endEdges;
    }

    get characterId() {
        return this.#characterId;
    }

    get startBounds() {
        return this.#startBounds;
    }

    get endBounds() {
        return this.#endBounds;
    }

    get morphFillStyles() {
        return this.#morphFillStyles;
    }

    get morphLineStyles() {
        return this.#morphLineStyles;
    }

    get startEdges() {
        return this.#startEdges;
    }

    get endEdges() {
        return this.#endEdges;
    }

    static read(reader) {
        const characterId = reader.readUI16();
        const startBounds = Swf.Rect.read(reader);
        const endBounds = Swf.Rect.read(reader);
        // Offset (byte count from here to EndEdges) is only needed for random
        // access; sequential parsing reaches EndEdges regardless.
        reader.readUI32();
        const morphFillStyles = Shapes.MorphFillStyle.readArray(reader);
        const morphLineStyles = Shapes.MorphLineStyle.readArray(reader);
        const startEdges = Shapes.Shape.read(reader);
        const endEdges = Shapes.Shape.read(reader);
        return new DefineMorphShapeTag(
            characterId, startBounds, endBounds, morphFillStyles, morphLineStyles, startEdges, endEdges
        );
    }
}

export default DefineMorphShapeTag;
