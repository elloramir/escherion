import DisplayObjectContainer from "./DisplayObjectContainer.js";

// flash.display.Stage. The WebGL engine owns the backbuffer; here the stage is
// the display root; the player sets its size and pointer.
class Stage extends DisplayObjectContainer {

    constructor() {
        super();
        this.isStage = true;
        this.stageWidth = 960;
        this.stageHeight = 550;
        // Pointer position in stage coordinates, published by the input router.
        this.pointer = null;
        this.frameRate = 24;
        this.align = "TL";
        this.scaleMode = "noScale";
        this.quality = "high";
        this.displayState = "normal";
        this.fullScreenSourceRect = null;
        this.focus = null;
        this.softKeyboardRect = null;
    }

    get fullScreenWidth() {
        return this.stageWidth;
    }

    get fullScreenHeight() {
        return this.stageHeight;
    }

    invalidate() {}

    isValid() {
        return true;
    }
}

export default Stage;
