import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";

const SHAPE_VERSION = 2;

// DefineShape2 tag: extends DefineShape with support for more than 255 styles
// and multiple style lists in one shape (SHAPEWITHSTYLE version 2).
class DefineShape2Tag {

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
        return new DefineShape2Tag(shapeId, shapeBounds, shapes);
    }
}

export default DefineShape2Tag;
