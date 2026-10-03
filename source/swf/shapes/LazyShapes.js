import ShapeWithStyle from "./ShapeWithStyle.js";

// A SHAPEWITHSTYLE parsed on first use: large movies define thousands of shapes
// and show only a few, and parsing is the load-time cost.
class LazyShapes {

    #reader;
    #version;
    #value = null;

    constructor(reader, version) {
        this.#reader = reader;
        this.#version = version;
    }

    // Carves the rest of the current tag body into a lazily parsed shape.
    static split(reader, bodyLength, bodyStart, version) {
        reader.align();
        return new LazyShapes(reader.split(bodyStart + bodyLength - reader.position), version);
    }

    get value() {
        if (this.#value === null) {
            this.#value = ShapeWithStyle.read(this.#reader, this.#version);
            this.#reader = null;
        }
        return this.#value;
    }
}

export default LazyShapes;
