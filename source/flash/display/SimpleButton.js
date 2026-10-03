import Sprite from "./Sprite.js";

// flash.display.SimpleButton. A SWF button is really three (up/over/down) plus a
// hit-test state; the player builds those state sub-trees from the DefineButton2
// records and keeps the active one visible, so the button renders like Flash.
class SimpleButton extends Sprite {

    constructor(upState = null, overState = null, downState = null, hitTestState = null) {
        super();
        this.upState = upState;
        this.overState = overState;
        this.downState = downState;
        this.hitTestState = hitTestState;
        this.enabled = true;
        this.useHandCursor = true;
        this.trackAsMenu = false;
        this.soundTransform = null;
        this.__state = "up";
        this.__buttonTag = null;
    }

    // Shows one state's sub-tree and hides the others.
    __setState(state) {
        this.__state = state;
        const states = { up: this.upState, over: this.overState, down: this.downState };
        for (const [key, container] of Object.entries(states)) {
            if (container) container.visible = key === state;
        }
    }
}

export default SimpleButton;
