import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";

const SHAPE_VERSION = 1;

// DefineShape tag: defines a vector shape character (SHAPEWITHSTYLE version 1).
class DefineShapeTag {

    #shapeId;
    #shapeBounds;
    #shapes;

    constructor(shapeId, shapeBounds, shapes) {
        this.#shapeId = shapeId;
        this.#shapeBounds = shapeBounds;
        this.#shapes = shapes;
    }

    get shapeId() {
        return this.#shapeId;
    }

    get shapeBounds() {
        return this.#shapeBounds;
    }

    get shapes() {
        return this.#shapes.value;
    }

    static read(reader, length, bodyStart) {
        const shapeId = reader.readUI16();
        const shapeBounds = Swf.Rect.read(reader);
        const shapes = Shapes.LazyShapes.split(reader, length, bodyStart, SHAPE_VERSION);
        return new DefineShapeTag(shapeId, shapeBounds, shapes);
    }
}

export default DefineShapeTag;
