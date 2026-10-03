import DisplayObject from "./DisplayObject.js";
import Graphics from "./Graphics.js";

// flash.display.Shape.
class Shape extends DisplayObject {

    constructor() {
        super();
        this.graphics = new Graphics();
    }
}

export default Shape;
