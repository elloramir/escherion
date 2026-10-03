import DisplayObject from "./DisplayObject.js";

// flash.display.InteractiveObject.
class InteractiveObject extends DisplayObject {

    constructor() {
        super();
        this.mouseEnabled = true;
        this.mouseChildren = true;
        this.tabEnabled = false;
        this.tabIndex = -1;
        this.focusRect = null;
        this.doubleClickEnabled = false;
        this.contextMenu = null;
    }
}

export default InteractiveObject;
