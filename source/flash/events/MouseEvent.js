import Event from "./Event.js";

// flash.events.MouseEvent.
class MouseEvent extends Event {

    static CLICK = "click";
    static DOUBLE_CLICK = "doubleClick";
    static MOUSE_DOWN = "mouseDown";
    static MOUSE_UP = "mouseUp";
    static MOUSE_MOVE = "mouseMove";
    static MOUSE_OVER = "mouseOver";
    static MOUSE_OUT = "mouseOut";
    static ROLL_OVER = "rollOver";
    static ROLL_OUT = "rollOut";
    static MOUSE_WHEEL = "mouseWheel";
    static MIDDLE_CLICK = "middleClick";
    static MIDDLE_MOUSE_DOWN = "middleMouseDown";
    static MIDDLE_MOUSE_UP = "middleMouseUp";
    static RIGHT_CLICK = "rightClick";
    static RIGHT_MOUSE_DOWN = "rightMouseDown";
    static RIGHT_MOUSE_UP = "rightMouseUp";
    static CONTEXT_MENU = "contextMenu";

    constructor(
        type,
        bubbles = false, cancelable = false,
        localX = 0, localY = 0, relatedObject = null,
        ctrlKey = false, altKey = false, shiftKey = false, buttonDown = false, delta = 0,
    ) {
        super(type, bubbles, cancelable);
        this.localX = localX;
        this.localY = localY;
        this.stageX = localX;
        this.stageY = localY;
        this.relatedObject = relatedObject;
        this.ctrlKey = ctrlKey;
        this.altKey = altKey;
        this.shiftKey = shiftKey;
        this.buttonDown = buttonDown;
        this.delta = delta;
    }

    updateAfterEvent() {}
}

export default MouseEvent;
