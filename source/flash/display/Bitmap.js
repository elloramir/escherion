import DisplayObject from "./DisplayObject.js";

// flash.display.Bitmap.
class Bitmap extends DisplayObject {

    constructor(bitmapData = null, pixelSnapping = "auto", smoothing = false) {
        super();
        this.bitmapData = bitmapData ?? null;
        this.pixelSnapping = pixelSnapping;
        this.smoothing = Boolean(smoothing);
    }

    toString() {
        return "[object Bitmap]";
    }
}

export default Bitmap;
