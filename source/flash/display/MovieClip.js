import Sprite from "./Sprite.js";
import Timeline from "./Timeline.js";

// flash.display.MovieClip. The timeline itself
// is driven by Timeline; this holds the frame state the game reads and routes
// goto requests to it.
class MovieClip extends Sprite {

    // A timeline plays as soon as it exists; a stop() on its first frame (or any
    // frame) is what holds it, matching the Flash default of "playing".
    #playing = true;
    #totalFrames = 1;
    #framesLoaded = 0;
    #frameScripts = new Map();
    #labels = [];

    constructor() {
        super();
        this.enabled = true;
        // `__currentFrame` is the requested 0-based frame (mirrors goto at once);
        // `__syncedFrame` is the last materialized one; `__gotoFrame` is a pending
        // exact request. Timeline owns the advance state machine.
        this.__currentFrame = 0;
        this.__syncedFrame = -1;
        this.__gotoFrame = null;
        this.__needsInitialFrame = true;
        // A symbol-linked class materializes its timeline before its own
        // constructor body runs.
        Timeline.bindSymbol(this);
    }

    // 1-based, matching Flash's public `currentFrame`.
    get currentFrame() {
        return (this.__currentFrame ?? 0) + 1;
    }

    set currentFrame(value) {
        this.#gotoFrame(value, this.#playing);
    }

    get totalFrames() {
        return this.#totalFrames;
    }

    get framesLoaded() {
        return this.#framesLoaded;
    }

    get isPlaying() {
        return this.#playing;
    }

    get currentFrameLabel() {
        for (const label of this.#labels) {
            if (label.frame === this.__currentFrame) return label.name;
            if (label.frame > this.__currentFrame) break;
        }
        return null;
    }

    get currentLabel() {
        let found = null;
        for (const label of this.#labels) {
            if (label.frame <= this.__currentFrame) found = label.name;
            else break;
        }
        return found;
    }

    play() {
        this.#playing = true;
    }

    stop() {
        this.#playing = false;
    }

    gotoAndPlay(frame) {
        this.#gotoFrame(frame, true);
    }

    gotoAndStop(frame) {
        this.#gotoFrame(frame, false);
    }

    nextFrame() {
        this.#setFrame(Math.min(this.#totalFrames - 1, (this.__currentFrame ?? 0) + 1), false);
        Timeline.gotoNow(this);
    }

    prevFrame() {
        this.#setFrame(Math.max(0, (this.__currentFrame ?? 0) - 1), false);
        Timeline.gotoNow(this);
    }

    // `__gotoFrame` is the exact 0-based request the timeline materializes next.

    nextScene() {}

    prevScene() {}

    addFrameScript(...pairs) {
        for (let index = 0; index + 1 < pairs.length; index += 2) {
            this.#frameScripts.set(pairs[index], pairs[index + 1]);
        }
    }

    getFrameScript(frame) {
        return this.#frameScripts.get(frame) ?? null;
    }

    // The player owns totalFrames, labels and framesLoaded once it binds a timeline.
    setTimeline({ totalFrames = 1, labels = [], framesLoaded = 1 } = {}) {
        this.#totalFrames = totalFrames;
        this.#labels = labels;
        this.#framesLoaded = framesLoaded;
    }

    stopAllMovieClips() {
        const stopTree = (node) => {
            if (typeof node.stop === "function") node.stop();
            if (Array.isArray(node.children)) for (const child of node.children) stopTree(child);
        };
        stopTree(this);
    }

    toString() {
        return "[object MovieClip]";
    }

    #setFrame(target, playing) {
        this.__gotoFrame = target;
        this.__currentFrame = target;
        this.#playing = playing;
    }

    // A numeric frame is 1-based; a label resolves to a 0-based frame.
    #gotoFrame(frame, playing) {
        const target = typeof frame === "string"
            ? this.#labels.find((label) => label.name === frame)?.frame ?? null
            : (Number.isInteger(frame) ? frame - 1 : null);
        if (!Number.isInteger(target) || target < 0) return;
        this.#setFrame(target, playing);
        Timeline.gotoNow(this);
    }
}

export default MovieClip;
