import * as Swf from "../index.js";
import * as Shapes from "../shapes/index.js";

const SHAPE_VERSION = 3;

// DefineShape3 tag: extends DefineShape2 with 32-bit (RGBA) color fields
// throughout its style lists (SHAPEWITHSTYLE version 3).
class DefineShape3Tag {

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
        return new DefineShape3Tag(shapeId, shapeBounds, shapes);
    }
}

export default DefineShape3Tag;
