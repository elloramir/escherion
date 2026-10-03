import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";

const SHAPE_VERSION = 4;

// DefineShape4 tag: a vector shape character with edge bounds and LINESTYLE2
// strokes (SHAPEWITHSTYLE version 4).
class DefineShape4Tag {

    #shapeId;
    #shapeBounds;
    #edgeBounds;
    #usesFillWindingRule;
    #usesNonScalingStrokes;
    #usesScalingStrokes;
    #shapes;

    constructor(
        shapeId, shapeBounds, edgeBounds, usesFillWindingRule,
        usesNonScalingStrokes, usesScalingStrokes, shapes
    ) {
        this.#shapeId = shapeId;
        this.#shapeBounds = shapeBounds;
        this.#edgeBounds = edgeBounds;
        this.#usesFillWindingRule = usesFillWindingRule;
        this.#usesNonScalingStrokes = usesNonScalingStrokes;
        this.#usesScalingStrokes = usesScalingStrokes;
        this.#shapes = shapes;
    }

    get shapeId() {
        return this.#shapeId;
    }

    get shapeBounds() {
        return this.#shapeBounds;
    }

    get edgeBounds() {
        return this.#edgeBounds;
    }

    get usesFillWindingRule() {
        return this.#usesFillWindingRule;
    }

    get usesNonScalingStrokes() {
        return this.#usesNonScalingStrokes;
    }

    get usesScalingStrokes() {
        return this.#usesScalingStrokes;
    }

    get shapes() {
        return this.#shapes.value;
    }

    static read(reader, length, bodyStart) {
        const shapeId = reader.readUI16();
        const shapeBounds = Swf.Rect.read(reader);
        const edgeBounds = Swf.Rect.read(reader);
        reader.readUB(5);
        const usesFillWindingRule = Boolean(reader.readUB(1));
        const usesNonScalingStrokes = Boolean(reader.readUB(1));
        const usesScalingStrokes = Boolean(reader.readUB(1));
        const shapes = Shapes.LazyShapes.split(reader, length, bodyStart, SHAPE_VERSION);
        return new DefineShape4Tag(
            shapeId, shapeBounds, edgeBounds, usesFillWindingRule,
            usesNonScalingStrokes, usesScalingStrokes, shapes
        );
    }
}

export default DefineShape4Tag;
