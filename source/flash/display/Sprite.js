import DisplayObjectContainer from "./DisplayObjectContainer.js";
import Graphics from "./Graphics.js";

// flash.display.Sprite.
class Sprite extends DisplayObjectContainer {

    constructor() {
        super();
        this.graphics = new Graphics();
        this.buttonMode = false;
        this.useHandCursor = true;
        this.hitArea = null;
        this.soundTransform = null;
    }

    startDrag(lockCenter = false, bounds = null) {}

    stopDrag() {}

    startTouchDrag(touchPointID, lockCenter = false, bounds = null) {}

    stopTouchDrag(touchPointID) {}
}

export default Sprite;
