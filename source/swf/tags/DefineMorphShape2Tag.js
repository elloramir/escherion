import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";

// DefineMorphShape2 tag (code 84): the start and end states of a morph sequence,
// displayed via PlaceObject2/3's ratio field. Extends DefineMorphShape with edge
// bounds and MORPHLINESTYLE2 strokes, mirroring how DefineShape4 extends
// DefineShape2/3.
class DefineMorphShape2Tag {

    #characterId;
    #startBounds;
    #endBounds;
    #startEdgeBounds;
    #endEdgeBounds;
    #usesNonScalingStrokes;
    #usesScalingStrokes;
    #morphFillStyles;
    #morphLineStyles;
    #startEdges;
    #endEdges;

    constructor(
        characterId, startBounds, endBounds, startEdgeBounds, endEdgeBounds,
        usesNonScalingStrokes, usesScalingStrokes, morphFillStyles, morphLineStyles, startEdges, endEdges
    ) {
        this.#characterId = characterId;
        this.#startBounds = startBounds;
        this.#endBounds = endBounds;
        this.#startEdgeBounds = startEdgeBounds;
        this.#endEdgeBounds = endEdgeBounds;
        this.#usesNonScalingStrokes = usesNonScalingStrokes;
        this.#usesScalingStrokes = usesScalingStrokes;
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

    get startEdgeBounds() {
        return this.#startEdgeBounds;
    }

    get endEdgeBounds() {
        return this.#endEdgeBounds;
    }

    get usesNonScalingStrokes() {
        return this.#usesNonScalingStrokes;
    }

    get usesScalingStrokes() {
        return this.#usesScalingStrokes;
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
        const startEdgeBounds = Swf.Rect.read(reader);
        const endEdgeBounds = Swf.Rect.read(reader);
        reader.readUB(6);
        const usesNonScalingStrokes = Boolean(reader.readUB(1));
        const usesScalingStrokes = Boolean(reader.readUB(1));
        // Offset (byte count from here to EndEdges) is only needed for random
        // access; sequential parsing reaches EndEdges regardless.
        reader.readUI32();
        const morphFillStyles = Shapes.MorphFillStyle.readArray(reader);
        const morphLineStyles = Shapes.MorphLineStyle2.readArray(reader);
        const startEdges = Shapes.Shape.read(reader);
        const endEdges = Shapes.Shape.read(reader);
        return new DefineMorphShape2Tag(
            characterId, startBounds, endBounds, startEdgeBounds, endEdgeBounds,
            usesNonScalingStrokes, usesScalingStrokes, morphFillStyles, morphLineStyles, startEdges, endEdges
        );
    }
}

export default DefineMorphShape2Tag;
