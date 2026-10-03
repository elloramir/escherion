import EventDispatcher from "../events/EventDispatcher.js";

// flash.media.SoundChannel — playback is not implemented yet.
class SoundChannel extends EventDispatcher {

    constructor() {
        super();
        this.position = 0;
        this.soundTransform = null;
    }

    stop() {}

    get leftPeak() {
        return 0;
    }

    get rightPeak() {
        return 0;
    }
}

export default SoundChannel;
