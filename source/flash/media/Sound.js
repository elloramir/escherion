import EventDispatcher from "../events/EventDispatcher.js";
import SoundChannel from "./SoundChannel.js";

// flash.media.Sound — playback is not implemented yet (no audio backend).
class Sound extends EventDispatcher {

    constructor(stream = null, context = null) {
        super();
        this.bytesLoaded = 0;
        this.bytesTotal = 0;
        this.length = 0;
        this.id3 = null;
        this.url = null;
        void stream;
        void context;
    }

    load(stream, context = null) {
        void stream;
        void context;
        console.warn("flash.media.Sound.load: no audio backend");
    }

    play(startTime = 0, loops = 0, soundTransform = null) {
        void startTime;
        void loops;
        void soundTransform;
        console.warn("flash.media.Sound.play: no audio backend");
        return new SoundChannel();
    }

    close() {}

    extract(target, length, startPosition) {
        void target;
        void length;
        void startPosition;
        return 0;
    }
}

export default Sound;
